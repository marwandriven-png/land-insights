import { serve } from "https://deno.land/std@0.168.0/http/server.ts";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version",
};

serve(async (req) => {
  if (req.method === "OPTIONS") return new Response(null, { headers: corsHeaders });

  try {
    const { fileContent, areaName } = await req.json();
    const LOVABLE_API_KEY = Deno.env.get("LOVABLE_API_KEY");
    if (!LOVABLE_API_KEY) throw new Error("LOVABLE_API_KEY is not configured");

    if (!fileContent || !areaName) {
      return new Response(JSON.stringify({ error: "fileContent and areaName are required" }), {
        status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    console.log(`Parsing area research for "${areaName}", content length: ${fileContent.length}`);

    const systemPrompt = `You are a Dubai real estate market data extraction specialist. Given area research/feasibility study content, extract ALL structured market data including transaction averages, comparable developments, rental data, and cost benchmarks. Return ONLY a JSON object using the provided tool call. Extract every number and data point you can find.`;

    const userPrompt = `Extract ALL market data for "${areaName}" from this area research document:

${fileContent}

Extract EVERYTHING available:
1. Average selling PSF per unit type (studio, 1BR, 2BR, 3BR)
2. Average unit sizes in sqft per type
3. Average rental PSF per year per type
4. Construction cost PSF
5. Land cost PSF
6. Transaction counts per unit type and total
7. Median PSF per unit type
8. Average prices per unit type
9. ALL comparable/benchmark developments with their details (name, developer, units, PSF, floors, handover, unit mix percentages, payment plan, plot size, BUA, service charge, density)
10. Market average PSF, market floor PSF, market ceiling PSF
11. Any market trends or notes

IMPORTANT: Extract ALL developments/projects mentioned as comparables. Include every numeric data point found.`;

    const response = await fetch("https://ai.gateway.lovable.dev/v1/chat/completions", {
      method: "POST",
      headers: {
        Authorization: `Bearer ${LOVABLE_API_KEY}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        model: "google/gemini-2.5-flash",
        messages: [
          { role: "system", content: systemPrompt },
          { role: "user", content: userPrompt },
        ],
        tools: [{
          type: "function",
          function: {
            name: "extract_market_data",
            description: "Extract comprehensive structured market data from area research document",
            parameters: {
              type: "object",
              properties: {
                unitPsf: {
                  type: "object",
                  description: "Average selling price per sqft by unit type",
                  properties: {
                    studio: { type: "number" },
                    br1: { type: "number" },
                    br2: { type: "number" },
                    br3: { type: "number" },
                  },
                },
                unitSizes: {
                  type: "object",
                  description: "Average unit sizes in sqft by type",
                  properties: {
                    studio: { type: "number" },
                    br1: { type: "number" },
                    br2: { type: "number" },
                    br3: { type: "number" },
                  },
                },
                unitRents: {
                  type: "object",
                  description: "Average annual rental PSF by unit type",
                  properties: {
                    studio: { type: "number" },
                    br1: { type: "number" },
                    br2: { type: "number" },
                    br3: { type: "number" },
                  },
                },
                constructionPsf: { type: "number", description: "Construction cost per sqft" },
                landCostPsf: { type: "number", description: "Land cost per sqft" },
                txnCount: {
                  type: "object",
                  description: "Transaction counts by unit type",
                  properties: {
                    studio: { type: "number" },
                    br1: { type: "number" },
                    br2: { type: "number" },
                    br3: { type: "number" },
                    total: { type: "number" },
                  },
                },
                medianPsf: {
                  type: "object",
                  description: "Median PSF by unit type",
                  properties: {
                    studio: { type: "number" },
                    br1: { type: "number" },
                    br2: { type: "number" },
                    br3: { type: "number" },
                  },
                },
                avgPrices: {
                  type: "object",
                  description: "Average unit prices by type",
                  properties: {
                    studio: { type: "number" },
                    br1: { type: "number" },
                    br2: { type: "number" },
                    br3: { type: "number" },
                  },
                },
                comparables: {
                  type: "array",
                  description: "Comparable/benchmark development projects in the area",
                  items: {
                    type: "object",
                    properties: {
                      name: { type: "string" },
                      developer: { type: "string" },
                      plotSqft: { type: "number" },
                      units: { type: "number" },
                      bua: { type: "number" },
                      floors: { type: "string" },
                      handover: { type: "string" },
                      priceFrom: { type: "number" },
                      psf: { type: "number" },
                      studioP: { type: "number" },
                      br1P: { type: "number" },
                      br2P: { type: "number" },
                      br3P: { type: "number" },
                      payPlan: { type: "string" },
                      svc: { type: "number" },
                      density: { type: "number" },
                    },
                  },
                },
                marketFloorPsf: { type: "number", description: "Market floor PSF" },
                marketAvgPsf: { type: "number", description: "Market average PSF" },
                marketCeilingPsf: { type: "number", description: "Market ceiling/premium PSF" },
                marketNotes: { type: "string", description: "Key market insights or trends" },
              },
              required: [],
              additionalProperties: false,
            },
          },
        }],
        tool_choice: { type: "function", function: { name: "extract_market_data" } },
      }),
    });

    if (!response.ok) {
      if (response.status === 429) {
        return new Response(JSON.stringify({ error: "Rate limit exceeded. Please try again later." }), {
          status: 429, headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      }
      if (response.status === 402) {
        return new Response(JSON.stringify({ error: "AI usage limit reached. Please add credits." }), {
          status: 402, headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      }
      const t = await response.text();
      console.error("AI gateway error:", response.status, t);
      return new Response(JSON.stringify({ error: "AI processing failed" }), {
        status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const aiResult = await response.json();
    const toolCall = aiResult.choices?.[0]?.message?.tool_calls?.[0];
    
    if (!toolCall?.function?.arguments) {
      console.error("No tool call in AI response:", JSON.stringify(aiResult));
      return new Response(JSON.stringify({ error: "AI could not extract structured data" }), {
        status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const marketData = JSON.parse(toolCall.function.arguments);
    console.log(`Extracted market data for "${areaName}":`, JSON.stringify(marketData).slice(0, 500));

    return new Response(JSON.stringify({ success: true, areaName, marketData }), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  } catch (e) {
    console.error("parse-area-research error:", e);
    return new Response(JSON.stringify({ error: e instanceof Error ? e.message : "Unknown error" }), {
      status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});
