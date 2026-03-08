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

All scores 0-10. Distances should include units (e.g. "350m"). Use realistic Dubai urban planning knowledge. Be specific about infrastructure types commonly found near Dubai development plots. Infer urban context from plot location, zoning, nearby development patterns, and construction statuses.`;

    const nearbyDesc = (nearbyPlots || []).map((p: any, i: number) =>
      `${i + 1}. Plot ${p.id}: ${p.areaSqft} sqft, Zoning: ${p.zoning}, Status: ${p.status}, Floors: ${p.floors || 'N/A'}, Developer: ${p.developer || 'N/A'}, Location: ${p.location || 'N/A'}, Construction: ${p.constructionStatus || 'N/A'}, LandUse: ${p.landUseDetails || 'N/A'}`
    ).join('\n');

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

SURROUNDING PLOTS WITHIN 1KM (${(nearbyPlots || []).length} plots):
${nearbyDesc || 'No nearby plots data available.'}

Based on the plot location, zoning patterns, and surrounding development context, generate a comprehensive urban environment analysis. Infer likely nearby infrastructure (substations, water facilities, parks, roads, mosques, schools) based on the area's development maturity and Dubai urban planning standards.`;

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
