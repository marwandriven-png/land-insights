import { serve } from "https://deno.land/std@0.168.0/http/server.ts";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version",
};

serve(async (req) => {
  if (req.method === "OPTIONS") return new Response(null, { headers: corsHeaders });

  try {
    const { plotA, plotB, marketContext, nearbyPlotsA, nearbyPlotsB, dcContextA, dcContextB } = await req.json();
    const LOVABLE_API_KEY = Deno.env.get("LOVABLE_API_KEY");
    if (!LOVABLE_API_KEY) throw new Error("LOVABLE_API_KEY is not configured");

    const nearbyDescA = (nearbyPlotsA || []).slice(0, 30).map((p: any, i: number) =>
      `${i+1}. Plot ${p.id}: ${p.areaSqft}sqft, GFA ${p.gfaSqft}sqft, Zoning: ${p.zoning}, Status: ${p.status}, Floors: ${p.floors || 'N/A'}, Dev: ${p.developer || 'N/A'}`
    ).join('\n');

    const nearbyDescB = (nearbyPlotsB || []).slice(0, 30).map((p: any, i: number) =>
      `${i+1}. Plot ${p.id}: ${p.areaSqft}sqft, GFA ${p.gfaSqft}sqft, Zoning: ${p.zoning}, Status: ${p.status}, Floors: ${p.floors || 'N/A'}, Dev: ${p.developer || 'N/A'}`
    ).join('\n');

    // Format DC context for AI prompt
    const formatDCContext = (dc: any, label: string) => {
      if (!dc) return `No Decision Confidence data available for ${label}.`;
      let text = `\n=== DECISION CONFIDENCE DATA FOR ${label} ===\n`;
      text += `Area: ${dc.areaName} | Market Tier: ${dc.marketTier}\n`;

      if (dc.feasibility) {
        text += `\nFEASIBILITY (3 strategies):\n`;
        for (const [key, val] of Object.entries(dc.feasibility) as any) {
          text += `  ${key}: GDV ${Math.round(val.grossSales/1e6)}M AED, Cost ${Math.round(val.totalCost/1e6)}M AED, Profit ${Math.round(val.grossProfit/1e6)}M AED, Margin ${val.grossMargin}, ROI ${val.roi}, Break-Even PSF ${val.breakEvenPsf}, Avg PSF ${val.avgPsf}, Yield ${val.grossYield}, Units: ${val.totalUnits}\n`;
          text += `    Unit mix: Studio ${val.unitBreakdown.studio}, 1BR ${val.unitBreakdown.br1}, 2BR ${val.unitBreakdown.br2}, 3BR ${val.unitBreakdown.br3}\n`;
          if (val.sensitivity) {
            text += `    Sensitivity: ${val.sensitivity.map((s: any) => `${s.delta}: ROI ${s.roi}, Margin ${s.margin}`).join(' | ')}\n`;
          }
        }
      }

      if (dc.transactions) {
        text += `\nTRANSACTIONS (${dc.transactions.total} total):\n`;
        text += `  By type: Studio ${dc.transactions.byType.studio}, 1BR ${dc.transactions.byType.br1}, 2BR ${dc.transactions.byType.br2}, 3BR ${dc.transactions.byType.br3}\n`;
        text += `  Avg PSF: Studio ${dc.transactions.avgPsf.studio}, 1BR ${dc.transactions.avgPsf.br1}, 2BR ${dc.transactions.avgPsf.br2}, 3BR ${dc.transactions.avgPsf.br3}\n`;
        text += `  Share %: Studio ${dc.transactions.sharePct.studio}%, 1BR ${dc.transactions.sharePct.br1}%, 2BR ${dc.transactions.sharePct.br2}%, 3BR ${dc.transactions.sharePct.br3}%\n`;
      }

      if (dc.rental) {
        text += `\nRENTAL DATA:\n`;
        text += `  Avg Rent PSF/yr: Studio ${dc.rental.avgRentPsf.studio}, 1BR ${dc.rental.avgRentPsf.br1}, 2BR ${dc.rental.avgRentPsf.br2}, 3BR ${dc.rental.avgRentPsf.br3}\n`;
        text += `  Gross Yields: Studio ${(dc.rental.yields.studio*100).toFixed(1)}%, 1BR ${(dc.rental.yields.br1*100).toFixed(1)}%, 2BR ${(dc.rental.yields.br2*100).toFixed(1)}%, 3BR ${(dc.rental.yields.br3*100).toFixed(1)}%\n`;
      }

      if (dc.competitors && dc.competitors.length > 0) {
        text += `\nBENCHMARKS (${dc.competitors.length} competitors):\n`;
        for (const c of dc.competitors) {
          text += `  ${c.name} (${c.developer}): ${c.totalUnits} units, Studio ${c.studioP}%, 1BR ${c.oneBRP}%, 2BR ${c.twoBRP}%, 3BR ${c.threeBRP}%, Price from ${c.priceFrom || 'N/A'} AED, Completion ${c.completion || 'N/A'}\n`;
        }
      }

      if (dc.framework) {
        text += `\nDEVELOPMENT FRAMEWORK:\n`;
        text += `  Construction PSF: ${dc.framework.constructionPSF} AED, Yield range: ${dc.framework.yieldRange.min}-${dc.framework.yieldRange.max}%, Service charge: ${dc.framework.serviceCharge.min}-${dc.framework.serviceCharge.max} PSF\n`;
      }

      if (dc.insights && dc.insights.length > 0) {
        text += `\nAREA INSIGHTS:\n`;
        dc.insights.forEach((ins: string) => { text += `  • ${ins}\n`; });
      }

      return text;
    };

    const dcTextA = formatDCContext(dcContextA, 'PLOT A');
    const dcTextB = formatDCContext(dcContextB, 'PLOT B');

    const systemPrompt = `You are a Dubai real estate land investment analyst AI. You analyze two plots using comprehensive Decision Confidence data including feasibility projections, real transaction data, competitive benchmarks, sensitivity analysis, rental yields, and spatial context.

CRITICAL: Base your analysis on the ACTUAL feasibility numbers, transaction data, and benchmarks provided. Do NOT use generic estimates when real data is available. Use the sensitivity analysis to assess risk tolerance. Use competitor data to validate pricing assumptions.

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
  "landAssemblyIntelligence": {
    "plotA": {
      "sizeClusterInsight": string,
      "matchingScaleCount": number,
      "dominantDevType": string,
      "gfaAssessment": string,
      "assemblyPotentialScale": string,
      "absorptionRate": { "studio": string, "oneBR": string, "twoBR": string, "threeBR": string, "expectedSellOut": string },
      "alternativeAreas": [{ "area": string, "demandScore": "High"|"Medium"|"Low", "reason": string }]
    },
    "plotB": {
      "sizeClusterInsight": string,
      "matchingScaleCount": number,
      "dominantDevType": string,
      "gfaAssessment": string,
      "assemblyPotentialScale": string,
      "absorptionRate": { "studio": string, "oneBR": string, "twoBR": string, "threeBR": string, "expectedSellOut": string },
      "alternativeAreas": [{ "area": string, "demandScore": "High"|"Medium"|"Low", "reason": string }]
    }
  },
  "urbanContext": {
    "plotA": {
      "urbanScore": { "overall": number, "greenSpace": number, "roadAccess": number, "infrastructureImpact": number, "amenities": number, "walkability": number },
      "streetFacing": { "plotType": string, "roadWidth": string, "insight": string },
      "viewOrientation": { "facing": string, "premiumEstimate": string },
      "positiveSignals": [string],
      "negativeSignals": [string]
    },
    "plotB": {
      "urbanScore": { "overall": number, "greenSpace": number, "roadAccess": number, "infrastructureImpact": number, "amenities": number, "walkability": number },
      "streetFacing": { "plotType": string, "roadWidth": string, "insight": string },
      "viewOrientation": { "facing": string, "premiumEstimate": string },
      "positiveSignals": [string],
      "negativeSignals": [string]
    }
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

All scores 0-10. Percentages as numbers (e.g. 48 not "48%"). Use the feasibility data, transaction volumes, competitor benchmarks, sensitivity analysis, and rental yields to make precise, data-backed assessments. Reference specific numbers from the DC data in your reasoning.`;

    const userPrompt = `Analyze these two Dubai land plots with full Decision Confidence data:

PLOT A:
- ID: ${plotA.id}
- Location: ${plotA.location || 'N/A'}
- Area: ${plotA.areaSqft} sqft
- GFA: ${plotA.gfaSqft} sqft
- Zoning: ${plotA.zoning}
- Status: ${plotA.status}
- Floors: ${plotA.floors || 'N/A'}
- Developer: ${plotA.developer || 'N/A'}

${dcTextA}

NEARBY PLOTS WITHIN 2KM OF PLOT A (${(nearbyPlotsA || []).length} plots):
${nearbyDescA || 'No nearby data available.'}

PLOT B:
- ID: ${plotB.id}
- Location: ${plotB.location || 'N/A'}
- Area: ${plotB.areaSqft} sqft
- GFA: ${plotB.gfaSqft} sqft
- Zoning: ${plotB.zoning}
- Status: ${plotB.status}
- Floors: ${plotB.floors || 'N/A'}
- Developer: ${plotB.developer || 'N/A'}

${dcTextB}

NEARBY PLOTS WITHIN 1KM OF PLOT B (${(nearbyPlotsB || []).length} plots):
${nearbyDescB || 'No nearby data available.'}

MARKET CONTEXT:
${marketContext || 'Use general Dubai market knowledge for the areas mentioned.'}

IMPORTANT ANALYSIS INSTRUCTIONS:
1. Use the ACTUAL feasibility ROI, margin, and break-even PSF from the DC data to score development potential
2. Use REAL transaction share percentages to determine demand distribution (not generic assumptions)
3. Compare competitor pricing benchmarks against each plot's avg PSF to determine valuation opportunity
4. Use sensitivity analysis data to assess downside risk — if -10% scenario still shows positive ROI, that's low risk
5. Use rental yield data to evaluate exit liquidity and investor attractiveness
6. Reference specific competitor projects when discussing benchmarks
7. Base sell-out timeline on actual transaction volume and absorption patterns from the data`;

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
