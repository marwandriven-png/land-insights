import { serve } from "https://deno.land/std@0.168.0/http/server.ts";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version",
};

serve(async (req) => {
  if (req.method === "OPTIONS") return new Response(null, { headers: corsHeaders });

  try {
    const { selectedPlot, nearbyPlots } = await req.json();
    const LOVABLE_API_KEY = Deno.env.get("LOVABLE_API_KEY");
    if (!LOVABLE_API_KEY) throw new Error("LOVABLE_API_KEY is not configured");

    const systemPrompt = `You are a Dubai urban planning and real estate environment analyst AI.

You analyze a selected plot and its surrounding plots within 1km to evaluate urban context, environmental quality, and development attractiveness.

Return ONLY valid JSON (no markdown, no code fences) with this exact structure:
{
  "utilities": [
    { "type": string, "distance": string, "impact": "Positive"|"Neutral"|"Negative", "detail": string }
  ],
  "greenSpaces": [
    { "name": string, "type": string, "distance": string, "impact": string }
  ],
  "streetFacing": {
    "plotType": string,
    "roadWidth": string,
    "frontage": string,
    "streetHierarchy": string,
    "insight": string
  },
  "viewOrientation": {
    "facing": string,
    "direction": string,
    "impact": string,
    "premiumEstimate": string
  },
  "urbanScore": {
    "overall": number,
    "greenSpace": number,
    "roadAccess": number,
    "infrastructureImpact": number,
    "amenities": number,
    "walkability": number
  },
  "positiveSignals": [string],
  "negativeSignals": [string],
  "valueImpact": [
    { "factor": string, "impact": string, "detail": string }
  ],
  "aiInsight": string
}

CRITICAL RULES:

1. **Utilities & Infrastructure** — ONLY report facilities you can CONFIRM from the nearby plots data.
   - Look at the "LandUse" field of EVERY nearby plot. If a plot's LandUse contains keywords like "COMMUNITY PARK", "PARK", "GARDEN", "MASJID", "MOSQUE", "SCHOOL", "HOSPITAL", "CLINIC", "RETAIL", "COMMERCIAL", "SUBSTATION", "UTILITY", "FACILITIES", "PETROL", "GAS STATION", "FIRE STATION", "POLICE" etc., report that as a real utility/infrastructure/green space.
   - Include the actual plot ID of the source plot for each utility (e.g. "Community Park (Plot 6457687)").
   - Do NOT invent or assume utilities that are not evidenced in the nearby plots data.

2. **Green Spaces** — Extract ONLY from nearby plots whose LandUse contains "PARK", "GARDEN", "GREEN", "OPEN SPACE", "COMMUNITY PARK", "LANDSCAPE" etc. Reference the actual plot IDs.

3. **Street Facing Analysis** — This is CRITICAL. Do NOT guess whether a plot is a "corner plot".
   - A corner plot is one that has roads on TWO adjacent sides (not just one road frontage).
   - To determine this: look at the plots that are ADJACENT to the selected plot (sharing a boundary). If there is a neighboring plot on a side, that side faces another plot, NOT a road.
   - If adjacent plots exist on all sides, the selected plot is an INTERIOR plot (not corner, not road-facing on that side).
   - Only if a side has NO adjacent plot can you infer it faces a road or open space.
   - Use setback values as supporting evidence: larger setbacks usually indicate main road frontage, but setbacks alone do NOT confirm a corner plot.
   - Be precise: say "Interior plot" or "Single road frontage" or "Corner plot" ONLY based on actual adjacent plot analysis.

All scores 0-10. Distances should include units (e.g. "350m"). Be specific and data-driven. Never fabricate infrastructure that isn't evidenced in the provided data.`;

    // Categorize nearby plots by land use for better analysis
    const allNearby = nearbyPlots || [];
    const facilitiesPlots = allNearby.filter((p: any) => {
      const lu = (p.landUseDetails || '').toUpperCase();
      return lu.includes('PARK') || lu.includes('GARDEN') || lu.includes('MASJID') || lu.includes('MOSQUE') ||
        lu.includes('SCHOOL') || lu.includes('HOSPITAL') || lu.includes('CLINIC') || lu.includes('RETAIL') ||
        lu.includes('FACILITIES') || lu.includes('SUBSTATION') || lu.includes('UTILITY') || lu.includes('PETROL') ||
        lu.includes('FIRE') || lu.includes('POLICE') || lu.includes('COMMUNITY') || lu.includes('OPEN SPACE');
    });

    const nearbyDesc = allNearby.map((p: any, i: number) =>
      `${i + 1}. Plot ${p.id}: ${p.areaSqft} sqft, Zoning: ${p.zoning}, Status: ${p.status}, Floors: ${p.floors || 'N/A'}, Developer: ${p.developer || 'N/A'}, Location: ${p.location || 'N/A'}, Construction: ${p.constructionStatus || 'N/A'}, LandUse: ${p.landUseDetails || 'N/A'}, Lat: ${p.lat || 'N/A'}, Lng: ${p.lng || 'N/A'}`
    ).join('\n');

    const facilitiesDesc = facilitiesPlots.length > 0
      ? `\n\nCONFIRMED FACILITIES/AMENITIES IN NEARBY PLOTS (extracted from GIS land use data):\n` +
        facilitiesPlots.map((p: any) => `- Plot ${p.id}: LandUse="${p.landUseDetails}", Location="${p.location || 'N/A'}"`).join('\n')
      : '\n\nNo confirmed facilities/amenities found in nearby plot land use data.';

    // Build setback info from real GIS data
    const setbackInfo = selectedPlot.buildingSetbacks
      ? `\nBUILDING SETBACKS (from DDA Affection Plan):
- Side 1: ${selectedPlot.buildingSetbacks.side1 || 'N/A'}m
- Side 2: ${selectedPlot.buildingSetbacks.side2 || 'N/A'}m
- Side 3: ${selectedPlot.buildingSetbacks.side3 || 'N/A'}m
- Side 4: ${selectedPlot.buildingSetbacks.side4 || 'N/A'}m

PODIUM SETBACKS:
- Side 1: ${selectedPlot.podiumSetbacks?.side1 || 'N/A'}m
- Side 2: ${selectedPlot.podiumSetbacks?.side2 || 'N/A'}m
- Side 3: ${selectedPlot.podiumSetbacks?.side3 || 'N/A'}m
- Side 4: ${selectedPlot.podiumSetbacks?.side4 || 'N/A'}m`
      : '\nNo building setback data available from DDA.';

    const userPrompt = `Analyze the urban environment context for this Dubai plot:

SELECTED PLOT:
- ID: ${selectedPlot.id}
- Location: ${selectedPlot.location || 'N/A'}
- Area: ${selectedPlot.areaSqft} sqft
- GFA: ${selectedPlot.gfaSqft} sqft
- Zoning: ${selectedPlot.zoning}
- Status: ${selectedPlot.status}
- Floors: ${selectedPlot.floors || 'N/A'}
- Developer: ${selectedPlot.developer || 'N/A'}
- Construction Status: ${selectedPlot.constructionStatus || 'N/A'}
- Land Use Details: ${selectedPlot.landUseDetails || 'N/A'}
- Coordinates: Lat ${selectedPlot.lat || 'N/A'}, Lng ${selectedPlot.lng || 'N/A'}
${setbackInfo}

SURROUNDING PLOTS WITHIN 1KM (${allNearby.length} plots):
${nearbyDesc || 'No nearby plots data available.'}
${facilitiesDesc}

IMPORTANT for Street Facing Analysis: Use the EXACT building setback values from the DDA Affection Plan data above. The setback values represent the mandatory distance (in meters) from each side of the plot boundary to the building line. Larger setbacks on a side typically indicate a main road frontage. A side with 0m podium setback means the podium can extend to the plot boundary on that side. Use these real values to determine road widths, frontage quality, and street hierarchy.

Based on the plot location, zoning patterns, and surrounding development context, generate a comprehensive urban environment analysis.`;

    const response = await fetch("https://ai.gateway.lovable.dev/v1/chat/completions", {
      method: "POST",
      headers: {
        Authorization: `Bearer ${LOVABLE_API_KEY}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        model: "google/gemini-3-flash-preview",
        messages: [
          { role: "system", content: systemPrompt },
          { role: "user", content: userPrompt },
        ],
        stream: false,
      }),
    });

    if (!response.ok) {
      const status = response.status;
      if (status === 429) {
        return new Response(JSON.stringify({ error: "Rate limit exceeded. Please try again shortly." }), {
          status: 429, headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      }
      if (status === 402) {
        return new Response(JSON.stringify({ error: "AI credits exhausted. Please top up your workspace." }), {
          status: 402, headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      }
      const t = await response.text();
      console.error("AI gateway error:", status, t);
      return new Response(JSON.stringify({ error: "AI analysis failed" }), {
        status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const result = await response.json();
    let content = result.choices?.[0]?.message?.content || "";
    content = content.replace(/```json\s*/g, '').replace(/```\s*/g, '').trim();

    try {
      const parsed = JSON.parse(content);
      return new Response(JSON.stringify(parsed), {
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    } catch {
      console.error("Failed to parse AI response:", content);
      return new Response(JSON.stringify({ error: "Failed to parse AI analysis", raw: content }), {
        status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }
  } catch (e) {
    console.error("urban-context error:", e);
    return new Response(JSON.stringify({ error: e instanceof Error ? e.message : "Unknown error" }), {
      status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});
