// ============================================
// LAND MATCHING WIZARD - EXTENDED & FIXED
// Parallel GIS/DDA + Property Status Integration
// ============================================

import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.39.0";
import { PlotDataCache } from "./cache.ts";

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version',
  'Access-Control-Allow-Methods': 'POST, OPTIONS',
};

const CONFIG = {
  TIMEOUTS: { GIS_DDA: 10_000, PROPERTY_STATUS: 8_000 },
  GIS_BASE_URL: 'https://gis.dda.gov.ae/server/rest/services/DDA/BASIC_LAND_BASE/MapServer',
  RADIUS: { MIN_METERS: 1, MAX_METERS: 50_000 },
  CONFIDENCE: { GIS_DDA: 1.00, FALLBACK: 0.65 },
};

const AREA_NORMALIZATION: Record<string, string> = {
  'majan': 'Wadi Al Safa 3',
  'dubai industrial city': 'Saih Shuaib 2',
  'dic': 'Saih Shuaib 2',
  'dubai industrial': 'Saih Shuaib 2',
  'dlrc': 'Dubai Land Residential Complex',
  'al satwa': 'Jumeirah Garden City',
};

export function normalizeArea(area: string | null | undefined): string {
  if (!area?.trim()) return 'Unknown';
  const lower = area.trim().toLowerCase();
  return AREA_NORMALIZATION[lower] ?? area.trim();
}

function generatePlotId(source: 'GIS' | 'DLD', landNumber: string): string {
  const input = `${source}::${(landNumber || 'UNKNOWN').trim().toUpperCase()}`;
  let hash = 2_166_136_261;
  for (let i = 0; i < input.length; i++) {
    hash ^= input.charCodeAt(i);
    hash = (hash * 16_777_619) >>> 0;
  }
  return `${source}-${hash.toString(16).padStart(8, '0').toUpperCase()}`;
}

function buildMatchKey(landNumber: string, area: string): string {
  return `${landNumber.trim()}-${normalizeArea(area)}`.toLowerCase().replace(/\s+/g, '');
}

function calculateDistance(lat1: number, lon1: number, lat2: number, lon2: number): number {
  const R = 6_371_000;
  const φ1 = lat1 * Math.PI / 180;
  const φ2 = lat2 * Math.PI / 180;
  const Δφ = (lat2 - lat1) * Math.PI / 180;
  const Δλ = (lon2 - lon1) * Math.PI / 180;
  const a = Math.sin(Δφ / 2) ** 2 + Math.cos(φ1) * Math.cos(φ2) * Math.sin(Δλ / 2) ** 2;
  return Math.round(R * 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a)));
}

function withTimeout<T>(promise: Promise<T>, ms: number, label: string): Promise<T> {
  const timeout = new Promise<never>((_, reject) =>
    setTimeout(() => reject(new Error(`${label} timed out after ${ms}ms`)), ms),
  );
  return Promise.race([promise, timeout]);
}

interface SearchRequest {
  latitude: number;
  longitude: number;
  radius_meters: number;
}

interface PlotResult {
  plot_id: string;
  land_number: string;
  area: string;
  latitude: number;
  longitude: number;
  distance_from_center_m: number;
  land_status?: string;
  land_status_source?: 'Property Status / GIS';
  geometry?: unknown;
  data_source_master: 'GIS/DDA' | 'Property Status / GIS';
  is_fallback: boolean;
  confidence_score: number;
  last_certificate_no?: string;
  property_type?: string;
  // GIS-specific fields carried through
  area_sqm?: number;
  gfa_sqm?: number;
  max_height_floors?: string;
  main_landuse?: string;
  sub_landuse?: string;
  entity_name?: string;
  project_name?: string;
  plot_coverage?: number;
  is_frozen?: boolean;
  freeze_reason?: string;
  construction_status?: string;
  site_status?: string;
}

interface APIResponse {
  source: 'GIS/DDA' | 'Property Status / GIS';
  success: boolean;
  plots: PlotResult[];
  error?: string;
  response_time_ms: number;
}

// ── GIS/DDA via our existing dda-gis-proxy spatial endpoint ──
async function queryGIS_DDA(request: SearchRequest): Promise<APIResponse> {
  const t0 = Date.now();
  try {
    const params = new URLSearchParams({
      where: '1=1',
      geometry: `${request.longitude},${request.latitude}`,
      geometryType: 'esriGeometryPoint',
      spatialRel: 'esriSpatialRelIntersects',
      inSR: '4326',
      distance: String(request.radius_meters),
      units: 'esriSRUnit_Meter',
      outFields: '*',
      returnGeometry: 'true',
      outSR: '4326',
      f: 'json',
      resultRecordCount: '200'
    });

    const resp = await fetch(`${CONFIG.GIS_BASE_URL}/2/query?${params}`, {
      method: 'GET',
      headers: { 'Accept': 'application/json', 'User-Agent': 'HyperPlot-AI/1.0' }
    });

    if (!resp.ok) throw new Error(`GIS/DDA HTTP ${resp.status}`);
    const data = await resp.json();
    if (data.error) throw new Error(data.error.message || JSON.stringify(data.error));

    const features: unknown[] = data.features ?? [];

    const plots: PlotResult[] = features.flatMap((item: any) => {
      const attrs = item.attributes || {};
      const geom = item.geometry;

      // Calculate centroid from rings for distance
      let lat = request.latitude, lng = request.longitude;
      if (geom?.rings?.[0]?.length > 0) {
        // ArcGIS returns in outSR=4326
        const ring = geom.rings[0];
        const sumX = ring.reduce((a: number, c: number[]) => a + c[0], 0);
        const sumY = ring.reduce((a: number, c: number[]) => a + c[1], 0);
        lng = sumX / ring.length;
        lat = sumY / ring.length;
      } else if (geom?.x && geom?.y) {
        lng = geom.x;
        lat = geom.y;
      }

      const dist = calculateDistance(request.latitude, request.longitude, lat, lng);
      if (dist > request.radius_meters * 1.1) return []; // small tolerance for centroid offset

      const landNumber = attrs.PLOT_NUMBER || `UNKNOWN_${Date.now()}`;
      const area = normalizeArea(attrs.PROJECT_NAME || attrs.ENTITY_NAME);

      return [{
        plot_id: generatePlotId('GIS', landNumber),
        land_number: landNumber,
        area,
        latitude: lat,
        longitude: lng,
        distance_from_center_m: dist,
        land_status: undefined,
        land_status_source: undefined,
        geometry: geom,
        data_source_master: 'GIS/DDA' as const,
        is_fallback: false,
        confidence_score: CONFIG.CONFIDENCE.GIS_DDA,
        area_sqm: attrs.AREA_SQM,
        gfa_sqm: attrs.GFA_SQM,
        max_height_floors: attrs.MAX_HEIGHT_FLOORS,
        main_landuse: attrs.MAIN_LANDUSE,
        sub_landuse: attrs.SUB_LANDUSE,
        entity_name: attrs.ENTITY_NAME,
        project_name: attrs.PROJECT_NAME,
        plot_coverage: attrs.MAX_PLOT_COVERAGE,
        is_frozen: attrs.IS_FROZEN === 1,
        freeze_reason: attrs.FREEZE_REASON,
        construction_status: attrs.CONSTRUCTION_STATUS,
        site_status: attrs.SITE_STATUS,
      }];
    });

    console.log(`[GIS/DDA] ✓ ${plots.length} plot(s) in ${Date.now() - t0}ms`);
    return { source: 'GIS/DDA', success: true, plots, response_time_ms: Date.now() - t0 };
  } catch (err) {
    const msg = err instanceof Error ? err.message : String(err);
    console.error('[GIS/DDA] ✗', msg);
    return { source: 'GIS/DDA', success: false, plots: [], error: msg, response_time_ms: Date.now() - t0 };
  }
}

// ── Property Status from DLD cache (PostGIS) ──
async function queryPropertyStatus(request: SearchRequest): Promise<APIResponse> {
  const t0 = Date.now();
  try {
    const supabaseUrl = Deno.env.get('SUPABASE_URL');
    const supabaseKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY');
    if (!supabaseUrl || !supabaseKey) {
      console.warn('[Property Status] Supabase env vars missing — skipping');
      return { source: 'Property Status / GIS', success: false, plots: [], error: 'Not configured', response_time_ms: Date.now() - t0 };
    }

    const supabase = createClient(supabaseUrl, supabaseKey);
    const { data, error } = await supabase.rpc('search_dld_plots_by_radius', {
      center_lat: request.latitude,
      center_lng: request.longitude,
      radius_meters: request.radius_meters,
    });

    if (error) {
      console.error('[Property Status] RPC error:', error);
      return { source: 'Property Status / GIS', success: false, plots: [], error: error.message, response_time_ms: Date.now() - t0 };
    }

    const plots: PlotResult[] = ((data ?? []) as any[]).map((row) => {
      const landNumber = row.land_number ?? 'UNKNOWN';
      return {
        plot_id: generatePlotId('DLD', landNumber),
        land_number: landNumber,
        area: normalizeArea(row.area),
        latitude: parseFloat(row.latitude),
        longitude: parseFloat(row.longitude),
        distance_from_center_m: Math.round(parseFloat(row.distance_m)),
        land_status: row.land_status ?? undefined,
        land_status_source: 'Property Status / GIS' as const,
        data_source_master: 'Property Status / GIS' as const,
        is_fallback: true,
        confidence_score: CONFIG.CONFIDENCE.FALLBACK,
        last_certificate_no: row.certificate_number ?? undefined,
        property_type: row.property_type ?? undefined,
      };
    });

    console.log(`[Property Status] ✓ cache ${plots.length} plot(s) in ${Date.now() - t0}ms`);
    return { source: 'Property Status / GIS', success: true, plots, response_time_ms: Date.now() - t0 };
  } catch (err) {
    const msg = err instanceof Error ? err.message : String(err);
    console.error('[Property Status] ✗', msg);
    return { source: 'Property Status / GIS', success: false, plots: [], error: msg, response_time_ms: Date.now() - t0 };
  }
}

// ── CONSOLIDATION ENGINE ──
function consolidateResults(gisDDA: APIResponse, propertyStatus: APIResponse, request: SearchRequest) {
  const t0 = Date.now();

  const psIndex = new Map<string, PlotResult>();
  for (const ps of propertyStatus.plots) {
    psIndex.set(buildMatchKey(ps.land_number, ps.area), ps);
  }

  const consolidated: PlotResult[] = [];
  const processedKeys = new Set<string>();
  let freeholdEnriched = 0;

  // Rule 1 + 3: GIS/DDA is master; extract ONLY land_status from PS
  for (const gis of gisDDA.plots) {
    const key = buildMatchKey(gis.land_number, gis.area);
    processedKeys.add(key);
    const ps = psIndex.get(key);

    if (ps?.land_status) {
      freeholdEnriched++;
      consolidated.push({
        ...gis,
        land_status: ps.land_status,
        land_status_source: 'Property Status / GIS',
      });
    } else {
      consolidated.push(gis);
    }
  }

  // Rule 2: PS-only records → full fallback
  for (const ps of propertyStatus.plots) {
    const key = buildMatchKey(ps.land_number, ps.area);
    if (!processedKeys.has(key)) {
      consolidated.push({
        ...ps,
        is_fallback: true,
        confidence_score: CONFIG.CONFIDENCE.FALLBACK,
        data_source_master: 'Property Status / GIS',
      });
    }
  }

  consolidated.sort((a, b) => a.distance_from_center_m - b.distance_from_center_m);
  const final = consolidated.filter(p => p.distance_from_center_m <= request.radius_meters * 1.1);

  return {
    plots: final,
    metadata: {
      total_count: final.length,
      gis_dda_count: gisDDA.plots.length,
      property_status_count: propertyStatus.plots.length,
      fallback_count: final.filter(p => p.is_fallback).length,
      freehold_enriched_count: freeholdEnriched,
      search_radius_m: request.radius_meters,
      execution_time_ms: Date.now() - t0,
    },
  };
}

// ── INPUT VALIDATION ──
function validateRequest(body: Record<string, unknown>): string | null {
  if (typeof body.latitude !== 'number') return 'latitude must be a number';
  if (typeof body.longitude !== 'number') return 'longitude must be a number';
  if (body.latitude < -90 || body.latitude > 90) return 'latitude out of range';
  if (body.longitude < -180 || body.longitude > 180) return 'longitude out of range';

  const r = body.radius_meters;
  if (r !== undefined) {
    if (typeof r !== 'number') return 'radius_meters must be a number';
    if (r < CONFIG.RADIUS.MIN_METERS) return `radius_meters must be ≥ ${CONFIG.RADIUS.MIN_METERS}`;
    if (r > CONFIG.RADIUS.MAX_METERS) return `radius_meters must be ≤ ${CONFIG.RADIUS.MAX_METERS}`;
  }
  return null;
}

// ── MAIN HANDLER ──
serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  const url = new URL(req.url);

  // ── TEST ENDPOINT ──
  if (url.pathname.endsWith('/test') && req.method === 'GET') {
    const supabaseUrl = Deno.env.get('SUPABASE_URL') || '';
    const supabaseKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') || '';
    const cache = new PlotDataCache(supabaseUrl, supabaseKey);

    try {
      const stats = await cache.getStats();
      return new Response(JSON.stringify({
        success: true,
        message: 'Cache system active',
        stats,
        test_at: new Date().toISOString()
      }), {
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    } catch (err) {
      return new Response(JSON.stringify({
        success: false,
        error: err instanceof Error ? err.message : String(err)
      }), {
        status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }
  }

  if (req.method !== 'POST') {
    return new Response(JSON.stringify({ error: 'Method not allowed' }), {
      status: 405, headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  }

  const t0 = Date.now();

  try {
    const body = await req.json().catch(() => ({}));

    const validationError = validateRequest(body);
    if (validationError) {
      return new Response(JSON.stringify({ success: false, error: validationError }), {
        status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    const request: SearchRequest = {
      latitude: body.latitude as number,
      longitude: body.longitude as number,
      radius_meters: (body.radius_meters as number | undefined) ?? 1_000,
    };

    console.log(`[LandMatchingWizard] ▶ lat=${request.latitude}, lng=${request.longitude}, r=${request.radius_meters}m`);

    const supabaseUrl = Deno.env.get('SUPABASE_URL') || '';
    const supabaseKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') || '';
    const cache = new PlotDataCache(supabaseUrl, supabaseKey);

    // 1. CHECK CACHE FIRST
    const cached = await cache.searchByRadius(request.latitude, request.longitude, request.radius_meters);
    if (cached.plots.length > 0 && cached.fresh_count === cached.total) {
      console.log(`[LandMatchingWizard] ⚡ Cache HIT: ${cached.total} plots`);
      // Map cached plots back to PlotResult format
      const plots: PlotResult[] = cached.plots.map(p => ({
        plot_id: generatePlotId(p.data_source === 'GIS/DDA' ? 'GIS' : 'DLD', p.land_number),
        land_number: p.land_number,
        area: p.area,
        latitude: p.latitude,
        longitude: p.longitude,
        distance_from_center_m: p.distance_m,
        land_status: p.land_status,
        land_status_source: p.data_source === 'Property Status / GIS' ? 'Property Status / GIS' : undefined,
        data_source_master: p.data_source,
        is_fallback: p.data_source === 'Property Status / GIS',
        confidence_score: p.data_source === 'GIS/DDA' ? CONFIG.CONFIDENCE.GIS_DDA : CONFIG.CONFIDENCE.FALLBACK,
        last_certificate_no: p.last_certificate_no,
        property_type: p.property_type,
        // (Other fields would depend on raw_data if stored)
      }));

      return new Response(JSON.stringify({
        success: true,
        data: { plots, center: { latitude: request.latitude, longitude: request.longitude }, search_parameters: { radius_meters: request.radius_meters } },
        metadata: { total_count: plots.length, source: 'cache', execution_time_ms: Date.now() - t0 }
      }), {
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    // 2. PARALLEL EXECUTION (Cache Miss or Partial Stale)
    const [gisResult, psResult] = await Promise.all([
      withTimeout(queryGIS_DDA(request), CONFIG.TIMEOUTS.GIS_DDA, 'GIS/DDA')
        .catch((err): APIResponse => ({
          source: 'GIS/DDA', success: false, plots: [],
          error: err instanceof Error ? err.message : String(err),
          response_time_ms: CONFIG.TIMEOUTS.GIS_DDA,
        })),
      withTimeout(queryPropertyStatus(request), CONFIG.TIMEOUTS.PROPERTY_STATUS, 'Property Status')
        .catch((err): APIResponse => ({
          source: 'Property Status / GIS', success: false, plots: [],
          error: err instanceof Error ? err.message : String(err),
          response_time_ms: CONFIG.TIMEOUTS.PROPERTY_STATUS,
        })),
    ]);

    console.log(`[LandMatchingWizard] GIS=${gisResult.plots.length}, PS=${psResult.plots.length}`);

    const { plots, metadata } = consolidateResults(gisResult, psResult, request);

    // 3. UPDATE CACHE
    if (plots.length > 0) {
      for (const plot of plots) {
        await cache.setPlotData(plot.land_number, {
          area: plot.area,
          latitude: plot.latitude,
          longitude: plot.longitude,
          land_status: plot.land_status,
          property_type: plot.property_type,
          last_certificate_no: plot.last_certificate_no,
          raw_data: plot // Optional: store full record
        }, plot.data_source_master);
      }
    }

    const responseBody = {
      success: true,
      data: {
        plots,
        center: { latitude: request.latitude, longitude: request.longitude },
        search_parameters: { radius_meters: request.radius_meters },
      },
      metadata: {
        ...metadata,
        api_performance: {
          gis_dda_ms: gisResult.response_time_ms,
          property_status_ms: psResult.response_time_ms,
          total_ms: Date.now() - t0,
        },
        data_sources: {
          gis_dda_available: gisResult.success,
          gis_dda_error: gisResult.error,
          property_status_available: psResult.success,
          property_status_error: psResult.error,
          fallback_used: metadata.fallback_count > 0,
          freehold_enriched: metadata.freehold_enriched_count > 0,
        },
      },
    };

    console.log(`[LandMatchingWizard] ■ ${metadata.total_count} plots (${metadata.freehold_enriched_count} freehold-enriched, ${metadata.fallback_count} fallback) in ${Date.now() - t0}ms`);

    return new Response(JSON.stringify(responseBody), {
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });

  } catch (err) {
    console.error('[LandMatchingWizard] FATAL:', err);
    return new Response(
      JSON.stringify({ success: false, error: err instanceof Error ? err.message : 'Internal error' }),
      { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } },
    );
  }
});
