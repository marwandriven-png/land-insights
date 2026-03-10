import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.49.1";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type, x-land-os-api-key",
};

// ─── Feasibility constants ─────────────────
const TXN_AVG_PSF = { studio: 1796, br1: 1531, br2: 1368, br3: 1449 };
const UNIT_SIZES = { studio: 426, br1: 771, br2: 1208, br3: 1680 };
const RENT_PSF_YR = { studio: 90, br1: 86, br2: 83, br3: 78 };

const MIX_TEMPLATES: Record<string, { mix: Record<string, number>; payPlan: Record<string, number> }> = {
  investor: {
    mix: { studio: 0.50, br1: 0.30, br2: 0.15, br3: 0.05 },
    payPlan: { booking: 5, construction: 45, handover: 50 },
  },
  balanced: {
    mix: { studio: 0.35, br1: 0.35, br2: 0.25, br3: 0.05 },
    payPlan: { booking: 10, construction: 40, handover: 50 },
  },
  family: {
    mix: { studio: 0.15, br1: 0.30, br2: 0.40, br3: 0.15 },
    payPlan: { booking: 20, construction: 40, handover: 40 },
  },
};

interface PlotParams {
  plotId: string;
  plotName?: string;
  areaSqft: number;
  gfaSqft?: number;
  far?: number;
  zoning?: string;
  area?: string;
  floors?: string;
  mixStrategy?: string;
  overrides?: {
    landCostPsf?: number;
    landCost?: number;
    constructionPsf?: number;
    efficiency?: number;
    buaMultiplier?: number;
    contingencyPct?: number;
    financePct?: number;
    unitPsf?: { studio?: number; br1?: number; br2?: number; br3?: number };
    unitSizes?: { studio?: number; br1?: number; br2?: number; br3?: number };
    unitRents?: { studio?: number; br1?: number; br2?: number; br3?: number };
    mix?: { studio?: number; br1?: number; br2?: number; br3?: number };
  };
}

// Simple hash function for API key validation
async function hashKey(key: string): Promise<string> {
  const encoder = new TextEncoder();
  const data = encoder.encode(key);
  const hashBuffer = await crypto.subtle.digest("SHA-256", data);
  const hashArray = Array.from(new Uint8Array(hashBuffer));
  return hashArray.map(b => b.toString(16).padStart(2, "0")).join("");
}

function runFeasibility(params: PlotParams) {
  const mixKey = params.mixStrategy || "balanced";
  const tmpl = MIX_TEMPLATES[mixKey] || MIX_TEMPLATES.balanced;
  const ov = params.overrides || {};

  const areaSqft = params.areaSqft;
  const far = params.far || (params.gfaSqft ? params.gfaSqft / areaSqft : 4.5);
  const gfa = params.gfaSqft || areaSqft * far;
  const efficiency = ov.efficiency || 0.95;
  const sellableArea = gfa * efficiency;
  const buaMultiplier = ov.buaMultiplier || 1.45;
  const bua = gfa * buaMultiplier;

  const mix = { ...tmpl.mix, ...ov.mix };

  const sizes = {
    studio: ov.unitSizes?.studio || UNIT_SIZES.studio,
    br1: ov.unitSizes?.br1 || UNIT_SIZES.br1,
    br2: ov.unitSizes?.br2 || UNIT_SIZES.br2,
    br3: ov.unitSizes?.br3 || UNIT_SIZES.br3,
  };
  const psf = {
    studio: ov.unitPsf?.studio || TXN_AVG_PSF.studio,
    br1: ov.unitPsf?.br1 || TXN_AVG_PSF.br1,
    br2: ov.unitPsf?.br2 || TXN_AVG_PSF.br2,
    br3: ov.unitPsf?.br3 || TXN_AVG_PSF.br3,
  };
  const rents = {
    studio: ov.unitRents?.studio || RENT_PSF_YR.studio,
    br1: ov.unitRents?.br1 || RENT_PSF_YR.br1,
    br2: ov.unitRents?.br2 || RENT_PSF_YR.br2,
    br3: ov.unitRents?.br3 || RENT_PSF_YR.br3,
  };

  const avgUnitSize = mix.studio * sizes.studio + mix.br1 * sizes.br1 + mix.br2 * sizes.br2 + mix.br3 * sizes.br3;
  const totalUnits = Math.round(sellableArea / avgUnitSize);
  const units = {
    studio: Math.round(totalUnits * mix.studio),
    br1: Math.round(totalUnits * mix.br1),
    br2: Math.round(totalUnits * mix.br2),
    br3: Math.round(totalUnits * mix.br3),
    total: 0,
  };
  units.total = units.studio + units.br1 + units.br2 + units.br3;

  const prices = {
    studio: sizes.studio * psf.studio,
    br1: sizes.br1 * psf.br1,
    br2: sizes.br2 * psf.br2,
    br3: sizes.br3 * psf.br3,
  };

  const grossSales =
    units.studio * prices.studio +
    units.br1 * prices.br1 +
    units.br2 * prices.br2 +
    units.br3 * prices.br3;

  const avgPsfDerived = sellableArea > 0 ? grossSales / sellableArea : 0;

  const landCostPsf = ov.landCostPsf || 148.23;
  const landCost = ov.landCost || gfa * landCostPsf;
  const constructionPsf = ov.constructionPsf || 420;
  const constructionCost = bua * constructionPsf;
  const authorityFees = landCost * 0.04;
  const consultantFees = constructionCost * 0.03;
  const marketing = grossSales * 0.02;
  const contingencyPct = ov.contingencyPct ?? 0.05;
  const financePct = ov.financePct ?? 0.03;
  const contingency = constructionCost * contingencyPct;
  const financing = grossSales * financePct;
  const totalCost = landCost + constructionCost + authorityFees + consultantFees + marketing + contingency + financing;

  const grossProfit = grossSales - totalCost;
  const grossMargin = grossSales > 0 ? grossProfit / grossSales : 0;
  const roi = totalCost > 0 ? grossProfit / totalCost : 0;
  const breakEvenPsf = sellableArea > 0 ? totalCost / sellableArea : 0;

  const annualRent =
    units.studio * (sizes.studio * rents.studio) +
    units.br1 * (sizes.br1 * rents.br1) +
    units.br2 * (sizes.br2 * rents.br2) +
    units.br3 * (sizes.br3 * rents.br3);
  const grossYield = grossSales > 0 ? annualRent / grossSales : 0;

  const sensitivity = [-0.10, -0.05, 0, 0.05, 0.10].map(delta => {
    const rev = grossSales * (1 + delta);
    const prof = rev - totalCost;
    return {
      psfChange: `${delta >= 0 ? "+" : ""}${(delta * 100).toFixed(0)}%`,
      revenue: Math.round(rev),
      profit: Math.round(prof),
      margin: +(prof / rev * 100).toFixed(1),
      roi: +(prof / totalCost * 100).toFixed(1),
    };
  });

  return {
    plot: {
      id: params.plotId,
      name: params.plotName || params.plotId,
      areaSqft,
      zoning: params.zoning || "N/A",
      area: params.area || "N/A",
      floors: params.floors || "N/A",
    },
    mixStrategy: mixKey,
    mix,
    paymentPlan: tmpl.payPlan,
    buildMetrics: {
      gfaSqft: Math.round(gfa),
      sellableAreaSqft: Math.round(sellableArea),
      buaSqft: Math.round(bua),
      far: +far.toFixed(2),
      efficiency,
      buaMultiplier,
      floorPlateSqft: Math.round(areaSqft * efficiency),
      residentialFloors: Math.ceil(gfa / (areaSqft * efficiency)),
    },
    units,
    unitPricing: {
      avgSellingPrices: prices,
      psfUsed: psf,
      unitSizesUsed: sizes,
    },
    revenue: {
      grossDevelopmentValue: Math.round(grossSales),
      avgPsf: Math.round(avgPsfDerived),
      revenueByType: {
        studio: Math.round(units.studio * prices.studio),
        br1: Math.round(units.br1 * prices.br1),
        br2: Math.round(units.br2 * prices.br2),
        br3: Math.round(units.br3 * prices.br3),
      },
    },
    costs: {
      landCost: Math.round(landCost),
      landCostPsf: +landCostPsf.toFixed(2),
      constructionCost: Math.round(constructionCost),
      constructionPsf,
      authorityFees: Math.round(authorityFees),
      consultantFees: Math.round(consultantFees),
      marketing: Math.round(marketing),
      contingency: Math.round(contingency),
      financing: Math.round(financing),
      totalDevelopmentCost: Math.round(totalCost),
    },
    profitability: {
      grossProfit: Math.round(grossProfit),
      grossMarginPct: +(grossMargin * 100).toFixed(1),
      roiPct: +(roi * 100).toFixed(1),
      breakEvenPsf: Math.round(breakEvenPsf),
    },
    rentalAnalysis: {
      annualRentalIncome: Math.round(annualRent),
      grossYieldPct: +(grossYield * 100).toFixed(2),
      rentPsfUsed: rents,
    },
    sensitivity,
    generatedAt: new Date().toISOString(),
  };
}

serve(async (req) => {
  if (req.method === "OPTIONS") return new Response(null, { headers: corsHeaders });

  try {
    const apiKey = req.headers.get("x-land-os-api-key") || req.headers.get("authorization")?.replace("Bearer ", "");

    // Validate against database
    const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
    const supabaseServiceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
    const supabase = createClient(supabaseUrl, supabaseServiceKey);

    if (!apiKey) {
      return new Response(JSON.stringify({ error: "Unauthorized. Provide a valid API key via x-land-os-api-key header or Bearer token." }), {
        status: 401, headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    // Also check legacy env-based key
    const envKey = Deno.env.get("LAND_OS_API_KEY");
    let authenticated = false;

    if (envKey && apiKey === envKey) {
      authenticated = true;
    } else {
      // Check against hashed keys in DB
      const keyHash = await hashKey(apiKey);
      const { data: keyRow } = await supabase
        .from("api_keys")
        .select("id, is_active")
        .eq("key_hash", keyHash)
        .eq("is_active", true)
        .maybeSingle();

      if (keyRow) {
        authenticated = true;
        // Update last_used_at
        await supabase.from("api_keys").update({ last_used_at: new Date().toISOString() }).eq("id", keyRow.id);
      }
    }

    if (!authenticated) {
      return new Response(JSON.stringify({ error: "Unauthorized. Invalid API key." }), {
        status: 401, headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    // ── Route by action ──
    const body = await req.json();
    const action = body.action || "feasibility";

    if (action === "feasibility") {
      if (!body.plotId || !body.areaSqft) {
        return new Response(JSON.stringify({ error: "Required fields: plotId, areaSqft" }), {
          status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      }

      if (body.allStrategies) {
        const results: Record<string, ReturnType<typeof runFeasibility>> = {};
        for (const key of ["investor", "balanced", "family"]) {
          results[key] = runFeasibility({ ...body, mixStrategy: key });
        }
        return new Response(JSON.stringify({ action: "feasibility", strategies: results }), {
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      }

      const result = runFeasibility(body);
      return new Response(JSON.stringify({ action: "feasibility", result }), {
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    // ── Plot details: search / get by ID ──
    if (action === "plots") {
      const { plotId, municipalityNumber, areaName, lat, lng, radiusMeters, limit: queryLimit } = body;
      const rowLimit = Math.min(queryLimit || 50, 200);

      // Single plot by ID
      if (plotId) {
        const { data, error } = await supabase
          .from("fallback_plots")
          .select("*")
          .eq("id", plotId)
          .maybeSingle();
        if (error) throw error;
        if (!data) {
          return new Response(JSON.stringify({ error: "Plot not found" }), {
            status: 404, headers: { ...corsHeaders, "Content-Type": "application/json" },
          });
        }
        return new Response(JSON.stringify({ action: "plots", plot: data }), {
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      }

      // Search by municipality number
      if (municipalityNumber) {
        const { data, error } = await supabase
          .from("fallback_plots")
          .select("*")
          .or(`municipality_number.eq.${municipalityNumber},municipality_number_original.eq.${municipalityNumber}`)
          .limit(rowLimit);
        if (error) throw error;
        return new Response(JSON.stringify({ action: "plots", count: data?.length || 0, plots: data }), {
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      }

      // Radius search
      if (lat && lng) {
        const radius = radiusMeters || 2000;
        const { data, error } = await supabase.rpc("search_fallback_plots_by_radius", {
          center_lat: lat,
          center_lng: lng,
          radius_meters: radius,
        });
        if (error) throw error;
        const limited = (data || []).slice(0, rowLimit);
        return new Response(JSON.stringify({ action: "plots", count: limited.length, plots: limited }), {
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      }

      // Search by area name
      if (areaName) {
        const { data, error } = await supabase
          .from("fallback_plots")
          .select("*")
          .ilike("area_name", `%${areaName}%`)
          .limit(rowLimit);
        if (error) throw error;
        return new Response(JSON.stringify({ action: "plots", count: data?.length || 0, plots: data }), {
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      }

      return new Response(JSON.stringify({ error: "Provide plotId, municipalityNumber, areaName, or lat+lng for plot search" }), {
        status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    // ── DLD property lookup ──
    if (action === "dld-lookup") {
      const { landNumber, lat, lng, radiusMeters, limit: queryLimit } = body;
      const rowLimit = Math.min(queryLimit || 50, 200);

      if (landNumber) {
        const { data, error } = await supabase
          .from("dld_property_cache")
          .select("*")
          .eq("land_number", landNumber)
          .limit(rowLimit);
        if (error) throw error;
        return new Response(JSON.stringify({ action: "dld-lookup", count: data?.length || 0, properties: data }), {
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      }

      if (lat && lng) {
        const radius = radiusMeters || 2000;
        const { data, error } = await supabase.rpc("search_dld_plots_by_radius", {
          center_lat: lat,
          center_lng: lng,
          radius_meters: radius,
        });
        if (error) throw error;
        const limited = (data || []).slice(0, rowLimit);
        return new Response(JSON.stringify({ action: "dld-lookup", count: limited.length, properties: limited }), {
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      }

      return new Response(JSON.stringify({ error: "Provide landNumber or lat+lng for DLD lookup" }), {
        status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    // ── Market snapshot ──
    if (action === "market") {
      const { areaCode, areaName } = body;

      if (areaCode || areaName) {
        let query = supabase.from("v_area_snapshot_latest").select("*");
        if (areaCode) query = query.eq("area_code", areaCode);
        else if (areaName) query = query.ilike("area_name", `%${areaName}%`);
        const { data, error } = await query.limit(20);
        if (error) throw error;
        return new Response(JSON.stringify({ action: "market", count: data?.length || 0, snapshots: data }), {
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      }

      return new Response(JSON.stringify({ error: "Provide areaCode or areaName for market data" }), {
        status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    if (action === "health") {
      return new Response(JSON.stringify({ status: "ok", version: "1.2.0", timestamp: new Date().toISOString(), actions: ["feasibility", "plots", "dld-lookup", "market", "health"] }), {
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    return new Response(JSON.stringify({ error: `Unknown action: ${action}. Supported: feasibility, plots, dld-lookup, market, health` }), {
      status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  } catch (e) {
    console.error("land-os-api error:", e);
    return new Response(JSON.stringify({ error: e instanceof Error ? e.message : "Unknown error" }), {
      status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});
