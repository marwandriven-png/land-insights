import { serve } from "https://deno.land/std@0.168.0/http/server.ts";

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

// In-memory cache for DLD responses (per instance)
const dldCache = new Map<string, { data: DLDResponse; timestamp: number }>();
const CACHE_TTL_MS = 30 * 60 * 1000; // 30 minutes

interface DLDResponse {
  plotNumber: string;
  municipalityNumber: string;
  subNumber: string;
  status: string | null;
  location: string | null;
  registrationConfirmed: boolean;
  verificationDate: string;
  source: 'DLD';
}

/**
 * Parse plot number into municipality and sub numbers
 * Example: 6850767 -> { municipality: "685", sub: "0767" }
 */
function parsePlotNumber(plotNumber: string): { municipality: string; sub: string } {
  const cleaned = plotNumber.replace(/[^0-9]/g, '');
  
  if (cleaned.length === 7) {
    // Format: 3 digit municipality + 4 digit sub
    return {
      municipality: cleaned.substring(0, 3),
      sub: cleaned.substring(3, 7)
    };
  } else if (cleaned.length === 6) {
    // Format: 3 digit municipality + 3 digit sub (with leading zero)
    return {
      municipality: cleaned.substring(0, 3),
      sub: '0' + cleaned.substring(3, 6)
    };
  } else if (cleaned.length >= 4 && cleaned.length <= 10) {
    // Generic split - first 3 chars as municipality, rest as sub
    const municipality = cleaned.substring(0, 3);
    const sub = cleaned.substring(3).padStart(4, '0');
    return { municipality, sub };
  }
  
  return { municipality: cleaned, sub: '' };
}

/**
 * Simulate DLD Property Status lookup
 * In production, this would call the actual DLD API
 * Currently returns mock data based on known plot patterns
 */
async function queryDLDStatus(plotNumber: string, municipality: string, sub: string): Promise<DLDResponse> {
  // Check cache first
  const cached = dldCache.get(plotNumber);
  if (cached && Date.now() - cached.timestamp < CACHE_TTL_MS) {
    console.log(`DLD Cache hit for plot ${plotNumber}`);
    return cached.data;
  }

  console.log(`Querying DLD for plot ${plotNumber} (Municipality: ${municipality}, Sub: ${sub})`);

  // Known plot patterns and their expected areas
  const knownAreas: Record<string, string> = {
    '685': 'Dubai Production City',
    '315': 'Dubai Healthcare City',
    '344': 'Business Bay',
    '371': 'Dubai Marina',
    '419': 'Jumeirah Lake Towers',
    '298': 'Dubai South',
    '425': 'Palm Jumeirah',
    '501': 'Dubai Silicon Oasis',
  };

  const locationFromMunicipality = knownAreas[municipality] || 'Dubai';

  // Simulate DLD response with realistic data
  const response: DLDResponse = {
    plotNumber,
    municipalityNumber: municipality,
    subNumber: sub,
    status: 'Registered', // DLD typically confirms registration status
    location: locationFromMunicipality,
    registrationConfirmed: true,
    verificationDate: new Date().toISOString(),
    source: 'DLD'
  };

  // Cache the response
  dldCache.set(plotNumber, { data: response, timestamp: Date.now() });
  
  return response;
}

serve(async (req) => {
  // Handle CORS preflight requests
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const url = new URL(req.url);
    const action = url.searchParams.get('action');

    console.log(`DLD Status Proxy - Action: ${action}`);

    if (action === 'lookup') {
      const plotNumber = url.searchParams.get('plotNumber');
      
      if (!plotNumber) {
        return new Response(JSON.stringify({ 
          error: 'plotNumber parameter required' 
        }), {
          status: 400,
          headers: { ...corsHeaders, 'Content-Type': 'application/json' }
        });
      }

      // Parse plot number into municipality and sub numbers
      const { municipality, sub } = parsePlotNumber(plotNumber);
      
      console.log(`Parsed plot ${plotNumber}: Municipality=${municipality}, Sub=${sub}`);

      // Query DLD status
      const dldData = await queryDLDStatus(plotNumber, municipality, sub);

      return new Response(JSON.stringify({
        success: true,
        data: dldData
      }), {
        headers: { ...corsHeaders, 'Content-Type': 'application/json' }
      });
    }

    if (action === 'parse') {
      // Just parse the plot number without lookup
      const plotNumber = url.searchParams.get('plotNumber');
      
      if (!plotNumber) {
        return new Response(JSON.stringify({ 
          error: 'plotNumber parameter required' 
        }), {
          status: 400,
          headers: { ...corsHeaders, 'Content-Type': 'application/json' }
        });
      }

      const { municipality, sub } = parsePlotNumber(plotNumber);
      
      return new Response(JSON.stringify({
        success: true,
        plotNumber,
        municipalityNumber: municipality,
        subNumber: sub
      }), {
        headers: { ...corsHeaders, 'Content-Type': 'application/json' }
      });
    }

    if (action === 'cache-stats') {
      // Return cache statistics
      return new Response(JSON.stringify({
        success: true,
        cacheSize: dldCache.size,
        cacheTTL: CACHE_TTL_MS / 1000 / 60 + ' minutes'
      }), {
        headers: { ...corsHeaders, 'Content-Type': 'application/json' }
      });
    }

    return new Response(JSON.stringify({ 
      error: 'Invalid action. Use: lookup, parse, or cache-stats' 
    }), {
      status: 400,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' }
    });

  } catch (error: unknown) {
    console.error('DLD Status Proxy Error:', error);
    
    const errorMessage = error instanceof Error ? error.message : 'Unknown error';
    
    return new Response(JSON.stringify({
      error: errorMessage,
      success: false
    }), {
      status: 500,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' }
    });
  }
});
