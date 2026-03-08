import { serve } from "https://deno.land/std@0.168.0/http/server.ts";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version",
};

serve(async (req) => {
  if (req.method === "OPTIONS") return new Response(null, { headers: corsHeaders });

  try {
    const { plotA, plotB, marketContext } = await req.json();
    const LOVABLE_API_KEY = Deno.env.get("LOVABLE_API_KEY");
    if (!LOVABLE_API_KEY) throw new Error("LOVABLE_API_KEY is not configured");

    const systemPrompt = `You are a Dubai real estate land investment analyst AI. You analyze two plots for comparative investment analysis.

Return ONLY valid JSON (no markdown, no code fences) with this exact structure:
{
  "plotScores": {
    "plotA": { "overall": number, "demandStrength": number, "supplyRisk": number, "priceTrend": number, "developmentPotential": number, "exitLiquidity": number },
    "plotB": { "overall": number, "demandStrength": number, "supplyRisk": number, "priceTrend": number, "developmentPotential": number, "exitLiquidity": number }
  },
  "demandHeatmap": {
    "distribution": { "studio": number, "oneBR": number, "twoBR": number, "threeBR": number },
    "plotABenefit": string,
    "plotBBenefit": string,
    "sellOutTimeline": { "plotA": string, "plotB": string }
  },
  "risks": {
    "plotA": [{ "risk": string, "severity": "low"|"medium"|"high", "detail": string }],
    "plotB": [{ "risk": string, "severity": "low"|"medium"|"high", "detail": string }]
  },
  "valuationOpportunity": {
    "plotA": { "marketPSF": number, "plotPSF": number, "undervaluation": number, "classification": "Strong Opportunity"|"Moderate Opportunity"|"Fair Value"|"Overpriced" },
    "plotB": { "marketPSF": number, "plotPSF": number, "undervaluation": number, "classification": "Strong Opportunity"|"Moderate Opportunity"|"Fair Value"|"Overpriced" }
  },
  "landAssembly": {
    "plotA": { "detected": boolean, "adjacentPlots": number, "totalPotentialSqft": number, "potentialUse": string, "valueIncrease": string },
    "plotB": { "detected": boolean, "adjacentPlots": number, "totalPotentialSqft": number, "potentialUse": string, "valueIncrease": string }
  },
  "exitStrategies": {
    "sellLand": { "plotA": string, "plotB": string },
    "developProject": { "plotA": string, "plotB": string },
    "jointVenture": { "plotA": string, "plotB": string },
    "bestStrategyA": string,
    "bestStrategyB": string
  },
  "verdict": {
    "winner": "plotA"|"plotB",
    "reasoning": [string, string, string],
    "recommendedAction": string,
    "confidenceLevel": "High"|"Medium"|"Low"
  }
}

All scores 0-10. Percentages as numbers (e.g. 48 not "48%"). Use the market data provided to make realistic assessments for Dubai real estate.`;

    const userPrompt = `Analyze these two Dubai land plots:

PLOT A:
- ID: ${plotA.id}
- Location: ${plotA.location || 'N/A'}
- Area: ${plotA.areaSqft} sqft
- GFA: ${plotA.gfaSqft} sqft
- Zoning: ${plotA.zoning}
- Status: ${plotA.status}
- Floors: ${plotA.floors || 'N/A'}
- Developer: ${plotA.developer || 'N/A'}

PLOT B:
- ID: ${plotB.id}
- Location: ${plotB.location || 'N/A'}
- Area: ${plotB.areaSqft} sqft
- GFA: ${plotB.gfaSqft} sqft
- Zoning: ${plotB.zoning}
- Status: ${plotB.status}
- Floors: ${plotB.floors || 'N/A'}
- Developer: ${plotB.developer || 'N/A'}

MARKET CONTEXT:
${marketContext || 'Use general Dubai market knowledge for the areas mentioned.'}

Provide a comprehensive investment comparison.`;

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
    
    // Strip markdown code fences if present
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
    console.error("plot-comparison error:", e);
    return new Response(JSON.stringify({ error: e instanceof Error ? e.message : "Unknown error" }), {
      status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});
