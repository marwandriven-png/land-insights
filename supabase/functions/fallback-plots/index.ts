import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.39.0";

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version',
};

function getSupabase() {
  return createClient(
    Deno.env.get('SUPABASE_URL')!,
    Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!,
  );
}

/** Normalize municipality number: strip dashes/spaces, remove leading zeros */
function normalizeMunicipality(v: string): string {
  return v.toString().trim().replace(/[^0-9a-zA-Z]/g, '').replace(/^0+(?=\d)/, '');
}

/** Parse CSV text into array of objects using first row as headers */
function parseCSV(text: string): Record<string, string>[] {
  const lines = text.split(/\r?\n/).filter(l => l.trim());
  if (lines.length < 2) return [];

  // Handle both comma and tab delimiters
  const delimiter = lines[0].includes('\t') ? '\t' : ',';
  const headers = lines[0].split(delimiter).map(h => h.trim().replace(/^["']|["']$/g, ''));

  return lines.slice(1).map(line => {
    const values = line.split(delimiter).map(v => v.trim().replace(/^["']|["']$/g, ''));
    const obj: Record<string, string> = {};
    headers.forEach((h, i) => { obj[h] = values[i] || ''; });
    return obj;
  });
}

/** Map CSV row to fallback_plots insert */
function mapRow(row: Record<string, string>) {
  // Flexible header matching
  const get = (keys: string[]): string => {
    for (const k of keys) {
      const found = Object.keys(row).find(h => h.toLowerCase().replace(/[^a-z0-9]/g, '') === k.toLowerCase().replace(/[^a-z0-9]/g, ''));
      if (found && row[found]) return row[found];
    }
    return '';
  };

  const municipalityNumber = get(['MunicipalityNumber', 'Municipality Number', 'municipality_number', 'MunicipalityNo', 'PlotNumber', 'Plot Number', 'LandNumber', 'Land Number']);
  const municipalityOriginal = get(['MunicipalityNumberOriginal', 'Municipality Number (Original)', 'municipality_number_original', 'OriginalNumber']);
  const areaName = get(['AreaName', 'Area Name', 'Area Name (DLD Official)', 'area_name', 'AreaNameDLDOfficial']);
  const areaCode = get(['AreaCode', 'Area Code', 'area_code']);
  const commonName = get(['CommonName', 'Common Name', 'Old / Common Name', 'OldCommonName', 'common_name']);
  const lat = get(['Latitude', 'latitude', 'lat']);
  const lng = get(['Longitude', 'longitude', 'lng', 'lon']);
  const plotArea = get(['PlotAreaSqm', 'Plot Area Sqm', 'plot_area_sqm', 'AreaSqm', 'SizeSqm']);
  const gfa = get(['GFASqm', 'GFA Sqm', 'gfa_sqm', 'GFA']);
  const zoning = get(['Zoning', 'zoning', 'LandUse', 'Land Use']);
  const floors = get(['Floors', 'floors', 'MaxFloors', 'Max Floors']);
  const developer = get(['Developer', 'developer', 'DeveloperName']);
  const projectName = get(['ProjectName', 'Project Name', 'project_name', 'Project']);
  const status = get(['Status', 'status', 'LandStatus']);
  const notes = get(['Notes', 'notes']);

  if (!municipalityNumber || !lat || !lng) return null;

  const latNum = parseFloat(lat);
  const lngNum = parseFloat(lng);
  if (isNaN(latNum) || isNaN(lngNum)) return null;

  return {
    municipality_number: normalizeMunicipality(municipalityNumber),
    municipality_number_original: municipalityOriginal || null,
    area_name: areaName || null,
    area_code: areaCode || null,
    common_name: commonName || null,
    latitude: latNum,
    longitude: lngNum,
    plot_area_sqm: plotArea ? parseFloat(plotArea) || null : null,
    gfa_sqm: gfa ? parseFloat(gfa) || null : null,
    zoning: zoning || null,
    floors: floors || null,
    developer: developer || null,
    project_name: projectName || null,
    status: status || 'Available',
    notes: notes || null,
    data_source: 'Bulk Import',
  };
}

serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  const url = new URL(req.url);
  const action = url.searchParams.get('action');

  try {
    const supabase = getSupabase();

    // ── LOOKUP: find a single plot by municipality number ──
    if (action === 'lookup') {
      const plotNum = url.searchParams.get('municipality_number') || '';
      if (!plotNum) {
        return new Response(JSON.stringify({ error: 'municipality_number required' }), {
          status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        });
      }

      const normalized = normalizeMunicipality(plotNum);
      const { data, error } = await supabase
        .from('fallback_plots')
        .select('*')
        .eq('municipality_number', normalized)
        .limit(1)
        .maybeSingle();

      if (error) throw error;

      return new Response(JSON.stringify({ success: true, found: !!data, plot: data }), {
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    // ── SPATIAL: find plots near a point ──
    if (action === 'spatial') {
      const lat = parseFloat(url.searchParams.get('lat') || '');
      const lng = parseFloat(url.searchParams.get('lng') || '');
      const radius = parseFloat(url.searchParams.get('radius') || '1000');

      if (isNaN(lat) || isNaN(lng)) {
        return new Response(JSON.stringify({ error: 'lat and lng required' }), {
          status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        });
      }

      const { data, error } = await supabase.rpc('search_fallback_plots_by_radius', {
        center_lat: lat,
        center_lng: lng,
        radius_meters: radius,
      });

      if (error) throw error;

      return new Response(JSON.stringify({ success: true, plots: data || [] }), {
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    // ── STATS: count total records ──
    if (action === 'stats') {
      const { count, error } = await supabase
        .from('fallback_plots')
        .select('*', { count: 'exact', head: true });

      if (error) throw error;

      return new Response(JSON.stringify({ success: true, total_plots: count || 0 }), {
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    // ── LIST: return all fallback plots (for map display) ──
    if (action === 'list') {
      const limit = parseInt(url.searchParams.get('limit') || '500', 10);
      const { data, error } = await supabase
        .from('fallback_plots')
        .select('*')
        .limit(Math.min(limit, 1000));

      if (error) throw error;

      return new Response(JSON.stringify({ success: true, plots: data || [] }), {
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    // ── UPDATE: edit a single fallback plot ──
    if (action === 'update' && req.method === 'POST') {
      const body = await req.json();
      const plotId = body.id as string;

      if (!plotId) {
        return new Response(JSON.stringify({ error: 'id required' }), {
          status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        });
      }

      // Build update object from allowed fields
      const allowedFields = [
        'area_name', 'area_code', 'common_name', 'zoning', 'floors',
        'land_use', 'developer', 'project_name', 'status', 'notes',
        'plot_area_sqm', 'plot_area_sqft', 'gfa_sqm', 'latitude', 'longitude',
        'municipality_number_original'
      ];

      const updates: Record<string, unknown> = { updated_at: new Date().toISOString() };
      for (const field of allowedFields) {
        if (field in body) {
          updates[field] = body[field];
        }
      }

      const { data, error } = await supabase
        .from('fallback_plots')
        .update(updates)
        .eq('id', plotId)
        .select('*')
        .maybeSingle();

      if (error) throw error;

      return new Response(JSON.stringify({ success: true, plot: data }), {
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    // ── BULK IMPORT (POST without action) ──
    if (req.method === 'POST' && !action) {
      const body = await req.json();
      const csvText = body.csv_data as string;

      if (!csvText) {
        return new Response(JSON.stringify({ error: 'csv_data required in POST body' }), {
          status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        });
      }

      const rows = parseCSV(csvText);
      console.log(`[FallbackPlots] Parsed ${rows.length} CSV rows`);

      const mapped = rows.map(mapRow).filter(Boolean);
      console.log(`[FallbackPlots] ${mapped.length} valid rows after mapping`);

      if (mapped.length === 0) {
        return new Response(JSON.stringify({ success: false, error: 'No valid rows found. Check CSV headers.' }), {
          status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        });
      }

      // Batch upsert in chunks of 500
      let inserted = 0;
      let updated = 0;
      let errors = 0;
      const CHUNK_SIZE = 500;

      for (let i = 0; i < mapped.length; i += CHUNK_SIZE) {
        const chunk = mapped.slice(i, i + CHUNK_SIZE);
        const { data, error } = await supabase
          .from('fallback_plots')
          .upsert(chunk as any[], { onConflict: 'municipality_number', ignoreDuplicates: false })
          .select('id');

        if (error) {
          console.error(`[FallbackPlots] Chunk ${i} error:`, error.message);
          errors += chunk.length;
        } else {
          inserted += (data?.length || 0);
        }
      }

      return new Response(JSON.stringify({
        success: true,
        summary: {
          total_parsed: rows.length,
          valid_mapped: mapped.length,
          upserted: inserted,
          errors,
        },
      }), {
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    // ── RESET: delete all fallback plots (requires reset key) ──
    if (action === 'reset' && req.method === 'POST') {
      const body = await req.json();
      const resetKey = body.reset_key as string;
      const expectedKey = Deno.env.get('FALLBACK_DB_RESET_KEY');

      if (!expectedKey || resetKey !== expectedKey) {
        return new Response(JSON.stringify({ error: 'Invalid or missing reset key' }), {
          status: 403, headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        });
      }

      const { error, count } = await supabase
        .from('fallback_plots')
        .delete()
        .neq('id', '00000000-0000-0000-0000-000000000000'); // delete all rows

      if (error) throw error;

      console.log(`[FallbackPlots] RESET: deleted ${count ?? 'all'} rows`);
      return new Response(JSON.stringify({ success: true, deleted: count ?? 'all' }), {
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    return new Response(JSON.stringify({ error: 'Invalid action. Use: lookup, spatial, stats, list, update, reset, or POST for bulk import' }), {
      status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });

  } catch (err) {
    console.error('[FallbackPlots] Error:', err);
    return new Response(JSON.stringify({ error: err instanceof Error ? err.message : String(err) }), {
      status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  }
});
