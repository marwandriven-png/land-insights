import { serve } from "https://deno.land/std@0.168.0/http/server.ts";

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

const DDA_GIS_BASE_URL = 'https://gis.dda.gov.ae/server/rest/services/DDA/BASIC_LAND_BASE/MapServer';

serve(async (req) => {
  // Handle CORS preflight requests
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const url = new URL(req.url);
    const action = url.searchParams.get('action');

    console.log(`DDA GIS Proxy - Action: ${action}`);

    if (action === 'test') {
      // Test connection to DDA GIS
      const params = new URLSearchParams({
        where: '1=1',
        returnCountOnly: 'true',
        f: 'json'
      });

      const response = await fetch(`${DDA_GIS_BASE_URL}/2/query?${params}`, {
        method: 'GET',
        headers: {
          'Accept': 'application/json',
          'User-Agent': 'HyperPlot-AI/1.0'
        }
      });

      if (!response.ok) {
        throw new Error(`GIS API returned ${response.status}`);
      }

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
      // Fetch plots from DDA GIS
      const limit = url.searchParams.get('limit') || '100';
      
      const params = new URLSearchParams({
        where: '1=1',
        outFields: [
          'OBJECTID', 'PLOT_NUMBER', 'ENTITY_NAME', 'DEVELOPER_NAME',
          'PROJECT_NAME', 'AREA_SQM', 'AREA_SQFT', 'GFA_SQM', 'GFA_SQFT',
          'MAX_HEIGHT_FLOORS', 'MAX_HEIGHT_METERS', 'MAIN_LANDUSE', 'SUB_LANDUSE',
          'LANDUSE_DETAILS', 'LANDUSE_CATEGORY', 'CONSTRUCTION_STATUS', 'SITE_STATUS',
          'MAX_PLOT_COVERAGE', 'PLOT_COVERAGE', 'IS_FROZEN', 'FREEZE_REASON'
        ].join(','),
        returnGeometry: 'true',
        outSR: '3997',
        f: 'json',
        resultRecordCount: limit
      });

      console.log(`Fetching plots with limit: ${limit}`);

      const response = await fetch(`${DDA_GIS_BASE_URL}/2/query?${params}`, {
        method: 'GET',
        headers: {
          'Accept': 'application/json',
          'User-Agent': 'HyperPlot-AI/1.0'
        }
      });

      if (!response.ok) {
        throw new Error(`GIS API returned ${response.status}`);
      }

      const data = await response.json();
      console.log(`Fetched ${data.features?.length || 0} features`);

      return new Response(JSON.stringify(data), {
        headers: { ...corsHeaders, 'Content-Type': 'application/json' }
      });
    }

    if (action === 'plot') {
      // Fetch specific plot by ID
      const plotId = url.searchParams.get('plotId');
      
      if (!plotId) {
        return new Response(JSON.stringify({ error: 'plotId required' }), {
          status: 400,
          headers: { ...corsHeaders, 'Content-Type': 'application/json' }
        });
      }

      const params = new URLSearchParams({
        where: `PLOT_NUMBER='${plotId}'`,
        outFields: '*',
        returnGeometry: 'true',
        outSR: '3997',
        f: 'json'
      });

      const response = await fetch(`${DDA_GIS_BASE_URL}/2/query?${params}`, {
        method: 'GET',
        headers: {
          'Accept': 'application/json',
          'User-Agent': 'HyperPlot-AI/1.0'
        }
      });

      if (!response.ok) {
        throw new Error(`GIS API returned ${response.status}`);
      }

      const data = await response.json();
      console.log(`Fetched plot ${plotId}:`, data.features?.length || 0);

      return new Response(JSON.stringify(data), {
        headers: { ...corsHeaders, 'Content-Type': 'application/json' }
      });
    }

    return new Response(JSON.stringify({ 
      error: 'Invalid action. Use: test, fetch, or plot' 
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
