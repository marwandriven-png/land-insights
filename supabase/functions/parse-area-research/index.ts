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

    const systemPrompt = `You are a Dubai real estate market data extraction specialist. Given area research/feasibility study content, extract structured market data. Return ONLY a JSON object using this exact tool call.`;

    const userPrompt = `Extract market data for "${areaName}" from this area research document:

${fileContent}

Extract the following if available:
- Average selling PSF per unit type (studio, 1BR, 2BR, 3BR)
- Average unit sizes in sqft per type
- Average rental PSF per year per type
- Construction cost PSF
- Land cost PSF
- Any market trends or notes

If specific data is not found, omit that field (don't guess).`;

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
        tools: [{
          type: "function",
          function: {
            name: "extract_market_data",
            description: "Extract structured market data from area research document",
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
