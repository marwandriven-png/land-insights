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

serve(async (req) => {
  if (req.method === "OPTIONS") return new Response(null, { headers: corsHeaders });

  try {
    const apiKey = req.headers.get("x-land-os-api-key") || req.headers.get("authorization")?.replace("Bearer ", "");
    const supabase = createClient(Deno.env.get("SUPABASE_URL")!, Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!);

    if (!apiKey) return json({ error: "Unauthorized. Provide a valid API key via x-land-os-api-key header or Bearer token." }, 401);

    // Auth: legacy env key or DB hash
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
    // Normalize keys to lowercase to handle uppercase payloads (e.g. "ACTION", "PLOTID")
    const body: Record<string, unknown> = {};
    for (const [k, v] of Object.entries(raw)) body[k.toLowerCase()] = v;
    const action = (typeof body.action === "string" ? body.action : "feasibility").toLowerCase();

    // Also support "lookup" as alias for "plots"
    const resolvedAction = action === "lookup" ? "plots" : action;

    // ── Feasibility ──
    if (resolvedAction === "feasibility") {
      const plotId = (body.plotid || body.plot_id || body.query) as string;
      const areaSqft = (body.areasqft || body.area_sqft || body.area) as number;
      if (!plotId || !areaSqft) return json({ error: "Required fields: plotId, areaSqft" }, 400);
      const feasBody = { ...body, plotId, areaSqft };
      if (body.allstrategies) {
        const strategies: Record<string, unknown> = {};
        for (const key of ["investor", "balanced", "family"]) strategies[key] = runFeasibility({ ...feasBody, mixStrategy: key });
        return json({ action: "feasibility", strategies });
      }
      return json({ action: "feasibility", result: runFeasibility(feasBody) });
    }

    // ── Plots (also handles "lookup" alias) ──
    if (resolvedAction === "plots") {
      const plotId = body.plotid || body.plot_id;
      const municipalityNumber = body.municipalitynumber || body.municipality_number || body.plotnumber || body.plot_number || body.query || body.q;
      const areaName = body.areaname || body.area_name;
      const lat = body.lat;
      const lng = body.lng;
      const radiusMeters = body.radiusmeters || body.radius_meters;
      const ql = body.limit as number | undefined;
      const lim = Math.min(ql || 50, 200);

      // Search by ID or Municipality Number
      const searchVal = plotId || municipalityNumber;
      if (searchVal) {
        // Try exact ID match first
        const { data: idMatch, error: idErr } = await supabase.from("fallback_plots").select("*").eq("id", searchVal.toString()).maybeSingle();
        if (idMatch) return json({ action: "plots", plot: idMatch });

        // Fallback to municipality_number or municipality_number_original
        const { data, error } = await supabase.from("fallback_plots")
          .select("*")
          .or(`municipality_number.eq.${searchVal},municipality_number_original.eq.${searchVal},id.eq.${searchVal}`)
          .limit(lim);
        if (error) throw error;
        if (data && data.length > 0) return json({ action: "plots", count: data.length, plots: data });

        return json({ error: "Plot not found", searched: searchVal }, 404);
      }
      if (lat && lng) {
        const { data, error } = await supabase.rpc("search_fallback_plots_by_radius", { center_lat: lat, center_lng: lng, radius_meters: radiusMeters || 2000 });
        if (error) throw error;
        const limited = (data || []).slice(0, lim);
        return json({ action: "plots", count: limited.length, plots: limited });
      }
      if (areaName) {
        const { data, error } = await supabase.from("fallback_plots").select("*").ilike("area_name", `%${areaName}%`).limit(lim);
        if (error) throw error;
        return json({ action: "plots", count: data?.length || 0, plots: data });
      }
      return json({ error: "Provide plotId, municipalityNumber, areaName, query, or lat+lng" }, 400);
    }

    // ── DLD Lookup ──
    if (resolvedAction === "dld-lookup") {
      const landNumber = (body.landnumber || body.land_number || body.plotnumber || body.plot_number || body.plotid || body.plot_id || body.query || body.q || "") as string;
      const lat = body.lat as number | undefined;
      const lng = body.lng as number | undefined;
      const radiusMeters = (body.radiusmeters || body.radius_meters) as number | undefined;
      const ql = body.limit as number | undefined;
      const lim = Math.min(ql || 50, 200);

      if (landNumber && landNumber.trim()) {
        const normalized = landNumber.trim().toUpperCase();
        const { data, error } = await supabase.from("dld_property_cache")
          .select("*")
          .or(`land_number.eq.${normalized},land_number.eq.${landNumber}`)
          .limit(lim);
        if (error) throw error;
        return json({ action: "dld-lookup", count: data?.length || 0, properties: data });
      }
      if (lat && lng) {
        const { data, error } = await supabase.rpc("search_dld_plots_by_radius", { center_lat: lat, center_lng: lng, radius_meters: radiusMeters || 2000 });
        if (error) throw error;
        const results = (data || []).slice(0, lim);
        return json({ action: "dld-lookup", count: results.length, properties: results });
      }
      return json({ error: "Provide landNumber, query, or lat+lng for DLD lookup" }, 400);
    }

    // ── Market ──
    if (resolvedAction === "market") {
      const areaCode = body.areacode || body.area_code || body.query || body.q;
      const areaName = body.areaname || body.area_name;
      if (areaCode || areaName) {
        let q = supabase.from("v_area_snapshot_latest").select("*");
        if (areaCode) {
          // If areaCode is a number-ish string, assume code, otherwise name
          if (/^\d+$/.test(areaCode.toString())) {
            q = q.eq("area_code", areaCode);
          } else {
            q = q.ilike("area_name", `%${areaCode}%`);
          }
        }
        else q = q.ilike("area_name", `%${areaName}%`);
        const { data, error } = await q.limit(20);
        if (error) throw error;
        return json({ action: "market", count: data?.length || 0, snapshots: data });
      }
      return json({ error: "Provide areaCode, areaName, or query" }, 400);
    }

    // ── Health ──
    if (resolvedAction === "health") {
      return json({ status: "ok", version: "1.3.0", timestamp: new Date().toISOString(), actions: ["feasibility", "plots", "lookup", "dld-lookup", "market", "health"] });
    }

    return json({ error: `Unknown action: ${action}. Supported: feasibility, plots, lookup, dld-lookup, market, health` }, 400);
  } catch (e) {
    console.error("land-os-api error:", e);
    return json({ error: e instanceof Error ? e.message : "Unknown error" }, 500);
  }
});
