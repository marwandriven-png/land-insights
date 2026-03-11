import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.49.1";
import { runFeasibility } from "./feasibility.ts";
import { hashKey } from "./auth.ts";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type, x-land-os-api-key",
};

const json = (body: unknown, status = 200) =>
  new Response(JSON.stringify(body), { status, headers: { ...corsHeaders, "Content-Type": "application/json" } });

const isUUID = (s: string) => /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(s);

/** Merge two objects, preferring non-null values from the first */
function mergeEnrich(primary: Record<string, any>, secondary: Record<string, any>): Record<string, any> {
  const merged: Record<string, any> = { ...secondary };
  for (const [k, v] of Object.entries(primary)) {
    if (v !== null && v !== undefined && v !== "") merged[k] = v;
  }
  return merged;
}

serve(async (req) => {
  if (req.method === "OPTIONS") return new Response(null, { headers: corsHeaders });

  try {
    const apiKey = req.headers.get("x-land-os-api-key") || req.headers.get("authorization")?.replace("Bearer ", "");
    const supabase = createClient(Deno.env.get("SUPABASE_URL")!, Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!);

    if (!apiKey) return json({ error: "Unauthorized. Provide a valid API key." }, 401);

    let authenticated = false;
    const envKey = Deno.env.get("LAND_OS_API_KEY");
    if (envKey && apiKey === envKey) {
      authenticated = true;
    } else {
      const keyHash = await hashKey(apiKey);
      const { data: keyRow } = await supabase.from("api_keys").select("id, is_active").eq("key_hash", keyHash).eq("is_active", true).maybeSingle();
      if (keyRow) {
        authenticated = true;
        await supabase.from("api_keys").update({ last_used_at: new Date().toISOString() }).eq("id", keyRow.id);
      }
    }
    if (!authenticated) return json({ error: "Unauthorized. Invalid API key." }, 401);

    const raw = await req.json();
    const body: Record<string, any> = {};
    for (const [k, v] of Object.entries(raw)) body[k.toLowerCase()] = v;

    const action = (typeof body.action === "string" ? body.action : "feasibility").toLowerCase();
    const resolvedAction = action === "lookup" ? "plots" : action;

    // ── Health Check ──
    if (resolvedAction === "health") {
      return json({
        status: "ok",
        version: "1.3.8",
        timestamp: new Date().toISOString(),
        actions: ["feasibility", "plots", "lookup", "dld-lookup", "market", "health"]
      });
    }

    // ── Feasibility ──
    if (resolvedAction === "feasibility") {
      const plotId = (body.plotid || body.plot_id || body.query || body.search || body.q) as string;
      const areaSqft = (body.areasqft || body.area_sqft || body.area_sq_ft || body.area) as number;
      if (!plotId || !areaSqft) return json({ error: "Required fields: plotId, areaSqft" }, 400);

      const feasBody = { ...body, plotId, areaSqft };
      if (body.allstrategies) {
        const strategies: Record<string, unknown> = {};
        for (const key of ["investor", "balanced", "family"]) {
          strategies[key] = runFeasibility({ ...feasBody, mixStrategy: key });
        }
        return json({ action: "feasibility", strategies });
      }
      return json({ action: "feasibility", result: runFeasibility(feasBody) });
    }

    // ── Plots (fully enriched) ──
    if (resolvedAction === "plots") {
      const searchInput = body.plotid || body.plot_id || body.municipalitynumber || body.municipality_number ||
        body.plotnumber || body.plot_number || body.query || body.search || body.q;
      const areaName = body.areaname || body.area_name;
      const lat = body.lat;
      const lng = body.lng;
      const radiusMeters = body.radiusmeters || body.radius_meters;
      const lim = Math.min((body.limit as number) || 50, 200);

      const searchVal = searchInput?.toString();
      if (searchVal) {
        // Search in fallback_plots
        let fallbackData: any = null;
        if (isUUID(searchVal)) {
          const { data } = await supabase.from("fallback_plots").select("*").eq("id", searchVal).maybeSingle();
          fallbackData = data;
        }
        if (!fallbackData) {
          const { data } = await supabase.from("fallback_plots").select("*")
            .or(`municipality_number.eq.${searchVal},municipality_number_original.eq.${searchVal}`)
            .limit(1).maybeSingle();
          fallbackData = data;
        }

        // Also search in dld_property_cache for enrichment (area, size_sqft, property_type)
        let dldData: any = null;
        {
          const { data } = await supabase.from("dld_property_cache").select("*")
            .or(`land_number.eq.${searchVal},land_number.eq.${searchVal.toUpperCase()}`)
            .limit(1).maybeSingle();
          dldData = data;
        }

        // Also try plot_data_cache (legacy)
        let legacyData: any = null;
        {
          const { data } = await supabase.from("plot_data_cache").select("*")
            .or(`land_number.eq.${searchVal},land_number.eq.${searchVal.toUpperCase()}`)
            .limit(1).maybeSingle();
          legacyData = data;
        }

        if (fallbackData || dldData || legacyData) {
          // Merge all sources: fallback_plots is primary, enrich with dld + legacy
          let merged: Record<string, any> = {};
          if (legacyData) merged = { ...legacyData, ...(legacyData.raw_data || {}) };
          if (dldData) merged = mergeEnrich(dldData, merged);
          if (fallbackData) merged = mergeEnrich(fallbackData, merged);

          // Resolve core fields
          const areaSqm = parseFloat(merged.plot_area_sqm || merged.size_sqm || merged.area_sqm) || null;
          const areaSqft = parseFloat(merged.plot_area_sqft || merged.size_sqft) || (areaSqm ? Math.round(areaSqm * 10.7639) : null);
          const zoning = merged.zoning || merged.property_type || merged.land_use || null;
          const floors = merged.floors || null;
          const gfaSqm = parseFloat(merged.gfa_sqm) || (areaSqm && floors ? estimateGFA(areaSqm, floors) : null);
          const landUse = merged.land_use || (zoning ? deriveLandUse(zoning) : null);

          // Determine data quality
          const criticalFields = [areaSqm, areaSqft, gfaSqm, zoning, floors];
          const filledCount = criticalFields.filter(f => f !== null && f !== undefined).length;
          const dataQuality = filledCount === criticalFields.length ? "complete" : filledCount >= 3 ? "partial" : "fallback";

          const enriched = {
            ...merged,
            area_name: merged.area_name || merged.area || merged.district || merged.community,
            plot_area_sqm: areaSqm,
            plot_area_sqft: areaSqft,
            gfa_sqm: gfaSqm,
            zoning,
            floors,
            land_use: landUse,
            land_status: merged.status || merged.land_status,
            municipality_number: merged.municipality_number || merged.land_number,
            developer: merged.developer || null,
            project_name: merged.project_name || null,
            data_quality: dataQuality,
          };

          console.log(`[land-os-api] Plot found: ${searchVal} | sources: fb=${!!fallbackData} dld=${!!dldData} legacy=${!!legacyData} | quality=${dataQuality}`);
          return json({ action: "plots", plot: enriched, data_quality: dataQuality, sources: { fallback: !!fallbackData, dld: !!dldData, legacy: !!legacyData } });
        }

        console.log(`[land-os-api] Plot not found: ${searchVal}`);
        return json({ error: "Plot not found", searched: searchVal }, 404);
      }

      if (lat && lng) {
        const { data, error } = await supabase.rpc("search_fallback_plots_by_radius", {
          center_lat: lat, center_lng: lng, radius_meters: radiusMeters || 2000
        });
        if (error) throw error;
        return json({ action: "plots", count: (data || []).length, plots: (data || []).slice(0, lim) });
      }

      if (areaName) {
        const { data, error } = await supabase.from("fallback_plots").select("*").ilike("area_name", `%${areaName}%`).limit(lim);
        if (error) throw error;
        return json({ action: "plots", count: data?.length || 0, plots: data });
      }
      return json({ error: "Provide plotId, municipalityNumber, areaName, query, or lat+lng" }, 400);
    }

    // ── DLD Lookup (enriched) ──
    if (resolvedAction === "dld-lookup") {
      const landNumber = (body.landnumber || body.land_number || body.plotnumber || body.plot_number ||
        body.plotid || body.plot_id || body.query || body.search || body.q || "") as string;
      const lat = body.lat;
      const lng = body.lng;
      const radiusMeters = body.radiusmeters || body.radius_meters;
      const lim = Math.min((body.limit as number) || 50, 200);

      if (landNumber && landNumber.trim()) {
        const val = landNumber.trim();
        const normalized = val.toUpperCase();

        // Search dld_property_cache
        const { data: dldData, error: dldErr } = await supabase.from("dld_property_cache").select("*")
          .or(`land_number.eq.${normalized},certificate_no.eq.${normalized},land_number.eq.${val}`)
          .limit(lim);
        if (dldErr) throw dldErr;

        // Search fallback_plots for enrichment (GFA, floors, zoning)
        const { data: fallbackData } = await supabase.from("fallback_plots").select("*")
          .or(`municipality_number.eq.${val},municipality_number_original.eq.${val}`)
          .limit(lim);

        // Merge enrichment
        const enrichedProperties = (dldData || []).map((dld: any) => {
          const fb = (fallbackData || []).find((f: any) =>
            f.municipality_number === val || f.municipality_number_original === val
          );
          if (!fb) return dld;
          return mergeEnrich(fb, dld);
        });

        // If no dld results but fallback has data, return fallback
        if (enrichedProperties.length === 0 && (fallbackData || []).length > 0) {
          return json({ action: "dld-lookup", count: fallbackData!.length, properties: fallbackData });
        }

        return json({ action: "dld-lookup", count: enrichedProperties.length, properties: enrichedProperties });
      }

      if (lat && lng) {
        const { data, error } = await supabase.rpc("search_dld_plots_by_radius", {
          center_lat: lat, center_lng: lng, radius_meters: radiusMeters || 2000
        });
        if (error) throw error;
        const sliced = (data || []).slice(0, lim);
        return json({ action: "dld-lookup", count: sliced.length, properties: sliced });
      }
      return json({ error: "Provide landNumber, query, or lat+lng" }, 400);
    }

    // ── Market ──
    if (resolvedAction === "market") {
      const areaCode = body.areacode || body.area_code || body.query || body.search || body.q;
      const areaName = body.areaname || body.area_name;
      if (areaCode || areaName) {
        let q = supabase.from("v_area_snapshot_latest").select("*");
        if (areaCode) {
          if (/^\d+$/.test(areaCode.toString())) q = q.eq("area_code", areaCode);
          else q = q.ilike("area_name", `%${areaCode}%`);
        } else {
          q = q.ilike("area_name", `%${areaName}%`);
        }
        const { data, error } = await q.limit(20);
        if (error) throw error;
        return json({ action: "market", count: data?.length || 0, snapshots: data });
      }
      return json({ error: "Provide areaCode, areaName, or query" }, 400);
    }

    return json({ error: `Unknown action: ${resolvedAction}` }, 400);
  } catch (e) {
    console.error("land-os-api error:", e);
    return json({ error: e instanceof Error ? e.message : "Internal Server Error" }, 500);
  }
});
