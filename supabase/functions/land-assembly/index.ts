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

    const systemPrompt = `You are a Dubai real estate land assembly and development intelligence analyst AI.

You are given a selected plot and all nearby plots from the same area/community (within 5km radius + area name search). Analyze them to produce structured intelligence.

Return ONLY valid JSON (no markdown, no code fences) with this exact structure:
{
  "sizeCluster": {
    "selectedSizeSqft": number,
    "ranges": [
      { "label": string, "minSqft": number, "maxSqft": number, "count": number }
    ],
    "matchingScaleCount": number,
    "insight": string
  },
  "completedBenchmarks": [
    { "plotSizeSqft": number, "buildingType": string, "gfaSqft": number, "units": number, "developer": string, "floors": string }
  ],
  "gfaComparison": {
    "higherGfaPct": number,
    "similarGfaPct": number,
    "lowerGfaPct": number,
    "assessment": string
  },
  "assemblyOpportunity": {
    "detected": boolean,
    "plotCount": number,
    "totalCombinedSqft": number,
    "potentialScale": string,
    "criteria": string
  },
  "developmentPattern": {
    "dominantType": string,
    "patterns": [{ "type": string, "count": number, "pct": number }],
    "recommendation": string
  },
  "absorptionRate": {
    "studio": string,
    "oneBR": string,
    "twoBR": string,
    "threeBR": string,
    "expectedSellOut": string
  },
  "comparablePlots": [
    { "plotId": string, "sizeSqft": number, "gfaSqft": number, "zoning": string, "status": string, "sizeDiffPct": number, "gfaDiffPct": number }
  ],
  "alternativeAreas": [
    { "area": string, "demandScore": "High"|"Medium"|"Low", "absorption": "Fast"|"Stable"|"Slow", "reason": string }
  ],
  "aiInsight": string
}

All percentages as numbers (e.g. 48 not "48%"). Use real Dubai market knowledge. Be specific and data-driven.

CRITICAL INSTRUCTIONS:
- For "comparablePlots": You MUST find plots from the NEARBY PLOTS data that are COMPARABLE to the selected plot based on BOTH plot size (area sqft within ±30%) AND GFA (sqft within ±30%). Include their real plot IDs, sizes, GFA, zoning, and status. Add "sizeDiffPct" and "gfaDiffPct" showing how much they differ from the selected plot. Rank by closest combined match. Do NOT invent fake plot IDs.
- For "developmentPattern": ONLY analyze plots with Residential or Mixed Use zoning/land use from the nearby plots data. Classify building types based on the FLOORS data — if floors indicate multi-story (G+3 or higher), classify as "Residential Building/Tower", NOT "Residential Villa". Villas are ONLY G+1 or G+2 with very small unit counts. Group by GFA range and plot size range to identify the dominant development scale and type. Count real occurrences. Ignore commercial-only, industrial, or infrastructure plots.
- For "completedBenchmarks": ONLY include plots from the SAME AREA/COMMUNITY as the selected plot that have construction status "Completed" or similar. Filter to plots with GFA within ±50% of the selected plot's GFA. Include their real data (plot size, GFA, floors, developer, building type). Classify building type correctly based on floors data — multi-story = Building/Tower, not Villa. Do NOT invent benchmarks.
- Always reference the area name (entity/project/location) in your insights.`;

    const areaName = selectedPlot.location || selectedPlot.developer || 'Unknown Area';

    const nearbyDesc = (nearbyPlots || []).map((p: any, i: number) => 
      `${i+1}. Plot ${p.id}: ${p.areaSqft} sqft, GFA ${p.gfaSqft} sqft, Zoning: ${p.zoning}, Status: ${p.status}, Floors: ${p.floors || 'N/A'}, Developer: ${p.developer || 'N/A'}, Location: ${p.location || 'N/A'}, Construction: ${p.constructionStatus || 'N/A'}, LandUse: ${p.landUseDetails || 'N/A'}`
    ).join('\n');

    const userPrompt = `Analyze this selected plot and its ${(nearbyPlots || []).length} nearby plots in the same area of ${areaName}:

SELECTED PLOT:
- ID: ${selectedPlot.id}
- Area Name: ${areaName}
- Location: ${selectedPlot.location || 'N/A'}
- Area: ${selectedPlot.areaSqft} sqft
- GFA: ${selectedPlot.gfaSqft} sqft
- Zoning: ${selectedPlot.zoning}
- Status: ${selectedPlot.status}
- Floors: ${selectedPlot.floors || 'N/A'}
- Developer: ${selectedPlot.developer || 'N/A'}
- Construction Status: ${selectedPlot.constructionStatus || 'N/A'}

NEARBY PLOTS IN ${areaName.toUpperCase()} (same area/community, up to 5km + area search):
${nearbyDesc || 'No nearby plots found.'}

Generate a comprehensive land assembly and development intelligence report for ${areaName}. For comparable plots, size clusters, and development patterns, use ONLY the real data from the nearby plots listed above. The "sizeCluster" section should analyze plot sizes across the ENTIRE area, not just immediate neighbors.`;

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
    console.error("land-assembly error:", e);
    return new Response(JSON.stringify({ error: e instanceof Error ? e.message : "Unknown error" }), {
      status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});
