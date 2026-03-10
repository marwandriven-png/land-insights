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
    if (action === "feasibility") {
      if (!body.plotId || !body.areaSqft) return json({ error: "Required fields: plotId, areaSqft" }, 400);
      if (body.allStrategies) {
        const strategies: Record<string, unknown> = {};
        for (const key of ["investor", "balanced", "family"]) strategies[key] = runFeasibility({ ...body, mixStrategy: key });
        return json({ action: "feasibility", strategies });
      }
      return json({ action: "feasibility", result: runFeasibility(body) });
    }

    // ── Plots ──
    if (action === "plots") {
      const { plotId, municipalityNumber, areaName, lat, lng, radiusMeters, limit: ql } = body;
      const lim = Math.min(ql || 50, 200);

      if (plotId) {
        const { data, error } = await supabase.from("fallback_plots").select("*").eq("id", plotId).maybeSingle();
        if (error) throw error;
        if (!data) return json({ error: "Plot not found" }, 404);
        return json({ action: "plots", plot: data });
      }
      if (municipalityNumber) {
        const { data, error } = await supabase.from("fallback_plots").select("*").or(`municipality_number.eq.${municipalityNumber},municipality_number_original.eq.${municipalityNumber}`).limit(lim);
        if (error) throw error;
        return json({ action: "plots", count: data?.length || 0, plots: data });
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
      return json({ error: "Provide plotId, municipalityNumber, areaName, or lat+lng" }, 400);
    }

    // ── DLD Lookup ──
    if (action === "dld-lookup") {
      const { landNumber, lat, lng, radiusMeters, limit: ql } = body;
      const lim = Math.min(ql || 50, 200);
      if (landNumber) {
        const { data, error } = await supabase.from("dld_property_cache").select("*").eq("land_number", landNumber).limit(lim);
        if (error) throw error;
        return json({ action: "dld-lookup", count: data?.length || 0, properties: data });
      }
      if (lat && lng) {
        const { data, error } = await supabase.rpc("search_dld_plots_by_radius", { center_lat: lat, center_lng: lng, radius_meters: radiusMeters || 2000 });
        if (error) throw error;
        return json({ action: "dld-lookup", count: (data || []).slice(0, lim).length, properties: (data || []).slice(0, lim) });
      }
      return json({ error: "Provide landNumber or lat+lng for DLD lookup" }, 400);
    }

    // ── Market ──
    if (action === "market") {
      const { areaCode, areaName } = body;
      if (areaCode || areaName) {
        let q = supabase.from("v_area_snapshot_latest").select("*");
        if (areaCode) q = q.eq("area_code", areaCode);
        else q = q.ilike("area_name", `%${areaName}%`);
        const { data, error } = await q.limit(20);
        if (error) throw error;
        return json({ action: "market", count: data?.length || 0, snapshots: data });
      }
      return json({ error: "Provide areaCode or areaName" }, 400);
    }

    // ── Health ──
    if (action === "health") {
      return json({ status: "ok", version: "1.2.0", timestamp: new Date().toISOString(), actions: ["feasibility", "plots", "dld-lookup", "market", "health"] });
    }

    return json({ error: `Unknown action: ${action}. Supported: feasibility, plots, dld-lookup, market, health` }, 400);
  } catch (e) {
    console.error("land-os-api error:", e);
    return json({ error: e instanceof Error ? e.message : "Unknown error" }, 500);
  }
});
