import { serve } from "https://deno.land/std@0.168.0/http/server.ts";

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version',
};

const DDA_GIS_BASE_URL = 'https://gis.dda.gov.ae/server/rest/services/DDA/BASIC_LAND_BASE/MapServer';

const STANDARD_OUT_FIELDS = [
  'OBJECTID', 'PLOT_NUMBER', 'ENTITY_NAME', 'DEVELOPER_NAME',
  'PROJECT_NAME', 'AREA_SQM', 'AREA_SQFT', 'GFA_SQM', 'GFA_SQFT',
  'MAX_HEIGHT_FLOORS', 'MAX_HEIGHT_METERS', 'MAIN_LANDUSE', 'SUB_LANDUSE',
  'LANDUSE_DETAILS', 'LANDUSE_CATEGORY', 'CONSTRUCTION_STATUS', 'SITE_STATUS',
  'MAX_PLOT_COVERAGE', 'PLOT_COVERAGE', 'IS_FROZEN', 'FREEZE_REASON'
].join(',');

serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const url = new URL(req.url);
    const action = url.searchParams.get('action');

    console.log(`DDA GIS Proxy - Action: ${action}`);

    if (action === 'test') {
      const params = new URLSearchParams({
        where: '1=1',
        returnCountOnly: 'true',
        f: 'json'
      });

      const response = await fetch(`${DDA_GIS_BASE_URL}/2/query?${params}`, {
        method: 'GET',
        headers: { 'Accept': 'application/json', 'User-Agent': 'HyperPlot-AI/1.0' }
      });

      if (!response.ok) throw new Error(`GIS API returned ${response.status}`);

      const data = await response.json();
      console.log('GIS Test Response:', JSON.stringify(data));

      return new Response(JSON.stringify({
        connected: data.count !== undefined,
        count: data.count || 0
      }), {
        headers: { ...corsHeaders, 'Content-Type': 'application/json' }
      });
    }

    if (action === 'fetch') {
      const limit = url.searchParams.get('limit') || '100';

      // Try with specific fields first, fall back to wildcard
      let data: Record<string, unknown> | null = null;

      for (const fields of [STANDARD_OUT_FIELDS, '*']) {
        const params = new URLSearchParams({
          where: '1=1',
          outFields: fields,
          returnGeometry: 'true',
          outSR: '3997',
          f: 'json',
          resultRecordCount: limit
        });

        console.log(`Fetching plots with limit: ${limit}, fields: ${fields === '*' ? 'wildcard' : 'standard'}`);

        const response = await fetch(`${DDA_GIS_BASE_URL}/2/query?${params}`, {
          method: 'GET',
          headers: { 'Accept': 'application/json', 'User-Agent': 'HyperPlot-AI/1.0' }
        });

        if (!response.ok) throw new Error(`GIS API returned ${response.status}`);

        data = await response.json();

        // If ArcGIS returns an error in body, try fallback
        if (data?.error) {
          console.log(`Query failed with ${fields === '*' ? 'wildcard' : 'standard'} fields:`, JSON.stringify(data.error));
          if (fields !== '*') continue;
        } else {
          break;
        }
      }

      console.log(`Fetched ${(data as any)?.features?.length || 0} features`);

      return new Response(JSON.stringify(data), {
        headers: { ...corsHeaders, 'Content-Type': 'application/json' }
      });
    }

    if (action === 'plot') {
      const plotId = url.searchParams.get('plotId');

      if (!plotId) {
        return new Response(JSON.stringify({ error: 'plotId required' }), {
          status: 400,
          headers: { ...corsHeaders, 'Content-Type': 'application/json' }
        });
      }

      // Sanitize plotId - only allow alphanumeric, underscores, dashes
      const sanitizedPlotId = plotId.replace(/[^a-zA-Z0-9_\-]/g, '');

      const params = new URLSearchParams({
        where: `PLOT_NUMBER='${sanitizedPlotId}'`,
        outFields: '*',
        returnGeometry: 'true',
        outSR: '3997',
        f: 'json'
      });

      const response = await fetch(`${DDA_GIS_BASE_URL}/2/query?${params}`, {
        method: 'GET',
        headers: { 'Accept': 'application/json', 'User-Agent': 'HyperPlot-AI/1.0' }
      });

      if (!response.ok) throw new Error(`GIS API returned ${response.status}`);

      const data = await response.json();
      console.log(`Fetched plot ${sanitizedPlotId}:`, data.features?.length || 0);

      return new Response(JSON.stringify(data), {
        headers: { ...corsHeaders, 'Content-Type': 'application/json' }
      });
    }

    if (action === 'affection') {
      const plotId = url.searchParams.get('plotId');

      if (!plotId) {
        return new Response(JSON.stringify({ error: 'plotId required' }), {
          status: 400,
          headers: { ...corsHeaders, 'Content-Type': 'application/json' }
        });
      }

      const sanitizedPlotId = plotId.replace(/[^a-zA-Z0-9_\-]/g, '');

      const affectionFields = [
        'PLOT_NUMBER', 'ENTITY_NAME', 'PROJECT_NAME', 'LAND_NAME',
        'AREA_SQM', 'GFA_SQM', 'MAX_HEIGHT_FLOORS', 'MAX_HEIGHT_METERS', 'MAX_HEIGHT', 'HEIGHT_CATEGORY',
        'MAX_PLOT_COVERAGE', 'MIN_PLOT_COVERAGE', 'PLOT_COVERAGE',
        'BUILDING_SETBACK_SIDE1', 'BUILDING_SETBACK_SIDE2', 'BUILDING_SETBACK_SIDE3', 'BUILDING_SETBACK_SIDE4',
        'PODIUM_SETBACK_SIDE1', 'PODIUM_SETBACK_SIDE2', 'PODIUM_SETBACK_SIDE3', 'PODIUM_SETBACK_SIDE4',
        'MAIN_LANDUSE', 'SUB_LANDUSE', 'LANDUSE_DETAILS', 'LANDUSE_CATEGORY',
        'GENERAL_NOTES', 'SITEPLAN_ISSUE_DATE', 'SITEPLAN_EXPIRY_DATE',
        'SITE_STATUS', 'IS_FROZEN', 'FREEZE_REASON', 'GFA_TYPE'
      ].join(',');

      const params = new URLSearchParams({
        where: `PLOT_NUMBER='${sanitizedPlotId}'`,
        outFields: affectionFields,
        returnGeometry: 'true',
        outSR: '3997',
        f: 'json'
      });

      console.log(`Fetching affection plan for plot ${sanitizedPlotId}`);

      const response = await fetch(`${DDA_GIS_BASE_URL}/2/query?${params}`, {
        method: 'GET',
        headers: { 'Accept': 'application/json', 'User-Agent': 'HyperPlot-AI/1.0' }
      });

      if (!response.ok) throw new Error(`GIS API returned ${response.status}`);

      const data = await response.json();
      console.log(`Affection plan for ${sanitizedPlotId}: ${data.features?.length || 0} features`);

      return new Response(JSON.stringify(data), {
        headers: { ...corsHeaders, 'Content-Type': 'application/json' }
      });
    }

    if (action === 'search') {
      // Search by area range or project name
      const minArea = url.searchParams.get('minArea');
      const maxArea = url.searchParams.get('maxArea');
      const projectName = url.searchParams.get('project');
      const limit = url.searchParams.get('limit') || '100';

      const conditions: string[] = [];

      if (minArea) {
        const min = parseFloat(minArea);
        if (!isNaN(min)) conditions.push(`AREA_SQM >= ${min}`);
      }
      if (maxArea) {
        const max = parseFloat(maxArea);
        if (!isNaN(max)) conditions.push(`AREA_SQM <= ${max}`);
      }
      if (projectName) {
        const sanitized = projectName.replace(/[^a-zA-Z0-9\s_\-]/g, '').toUpperCase();
        // Split into significant words and match each for fuzzy matching
        const words = sanitized.split(/\s+/).filter(w => w.length > 2);
        if (words.length > 0) {
          const wordConditions = words.map(w =>
            `(UPPER(PROJECT_NAME) LIKE '%${w}%' OR UPPER(ENTITY_NAME) LIKE '%${w}%')`
          );
          conditions.push(`(${wordConditions.join(' AND ')})`);
        } else {
          conditions.push(`(UPPER(PROJECT_NAME) LIKE '%${sanitized}%' OR UPPER(ENTITY_NAME) LIKE '%${sanitized}%')`);
        }
      }

      const whereClause = conditions.length > 0 ? conditions.join(' AND ') : '1=1';

      // Try with specific fields first, fall back to wildcard
      let data: Record<string, unknown> | null = null;

      for (const fields of [STANDARD_OUT_FIELDS, '*']) {
        const params = new URLSearchParams({
          where: whereClause,
          outFields: fields,
          returnGeometry: 'true',
          outSR: '3997',
          f: 'json',
          resultRecordCount: limit
        });

        console.log(`Searching plots: ${whereClause}, fields: ${fields === '*' ? 'wildcard' : 'standard'}`);

        const response = await fetch(`${DDA_GIS_BASE_URL}/2/query?${params}`, {
          method: 'GET',
          headers: { 'Accept': 'application/json', 'User-Agent': 'HyperPlot-AI/1.0' }
        });

        if (!response.ok) throw new Error(`GIS API returned ${response.status}`);

        data = await response.json();

        if (data?.error) {
          console.log(`Search query failed with ${fields === '*' ? 'wildcard' : 'standard'} fields:`, JSON.stringify(data.error));
          if (fields !== '*') continue;
        } else {
          break;
        }
      }

      console.log(`Search returned ${(data as any)?.features?.length || 0} features`);

      return new Response(JSON.stringify(data), {
        headers: { ...corsHeaders, 'Content-Type': 'application/json' }
      });
    }

    if (action === 'spatial') {
      const lat = url.searchParams.get('lat');
      const lng = url.searchParams.get('lng');
      const radius = url.searchParams.get('radius') || '1000'; // Default 1km
      const limit = url.searchParams.get('limit') || '100';

      if (!lat || !lng) {
        return new Response(JSON.stringify({ error: 'lat and lng required for spatial search' }), {
          status: 400,
          headers: { ...corsHeaders, 'Content-Type': 'application/json' }
        });
      }

      // Use point geometry with inSR=4326 and distance buffer
      // Try with standard fields first, then wildcard fallback
      let data: Record<string, unknown> | null = null;

      for (const fields of [STANDARD_OUT_FIELDS, '*']) {
        const params = new URLSearchParams({
          where: '1=1',
          geometry: `${lng},${lat}`,
          geometryType: 'esriGeometryPoint',
          spatialRel: 'esriSpatialRelIntersects',
          inSR: '4326',
          distance: radius,
          units: 'esriSRUnit_Meter',
          outFields: fields,
          returnGeometry: 'true',
          outSR: '3997',
          f: 'json',
          resultRecordCount: limit
        });

        console.log(`Fetching spatial ${radius}m at [${lat}, ${lng}], fields: ${fields === '*' ? 'wildcard' : 'standard'}`);

        const response = await fetch(`${DDA_GIS_BASE_URL}/2/query?${params}`, {
          method: 'GET',
          headers: { 'Accept': 'application/json', 'User-Agent': 'HyperPlot-AI/1.0' }
        });

        if (!response.ok) throw new Error(`GIS API returned ${response.status}`);

        data = await response.json();

        if (data?.error) {
          console.log(`Spatial query failed with ${fields === '*' ? 'wildcard' : 'standard'} fields:`, JSON.stringify(data.error));
          if (fields !== '*') continue;
        } else {
          break;
        }
      }

      console.log(`Spatial search returned ${(data as any)?.features?.length || 0} features`);

      return new Response(JSON.stringify(data), {
        headers: { ...corsHeaders, 'Content-Type': 'application/json' }
      });
    }

    return new Response(JSON.stringify({
      error: 'Invalid action. Use: test, fetch, plot, affection, or search'
    }), {
      status: 400,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' }
    });

  } catch (error: unknown) {
    console.error('DDA GIS Proxy Error:', error);
    const errorMessage = error instanceof Error ? error.message : 'Unknown error';

    return new Response(JSON.stringify({
      error: errorMessage,
      connected: false
    }), {
      status: 500,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' }
    });
  }
});
