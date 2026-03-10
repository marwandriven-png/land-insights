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
        version: "1.3.7",
        timestamp: new Date().toISOString(),
        actions: ["feasibility", "plots", "lookup", "dld-lookup", "market", "health"]
      });
    }

    // ── Feasibility ──
    if (resolvedAction === "feasibility") {
      const plotId = (body.plotid || body.plot_id || body.query || body.search || body.q) as string;
      const areaSqft = (body.areasqft || body.area_sqft || body.area_sq_ft || body.area) as number;
      if (!plotId || !areaSqft) return json({ error: "Required fields: plotId, areaSqft (supported aliases: query, search, q)" }, 400);

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

    // ── Plots ──
    if (resolvedAction === "plots") {
      const plotId = body.plotid || body.plot_id || body.query || body.search || body.q;
      const municipalityNumber = body.municipalitynumber || body.municipality_number || body.plotnumber || body.plot_number || body.query || body.q;
      const areaName = body.areaname || body.area_name;
      const lat = body.lat;
      const lng = body.lng;
      const radiusMeters = body.radiusmeters || body.radius_meters;
      const lim = Math.min((body.limit as number) || 50, 200);

      const searchVal = (plotId || municipalityNumber)?.toString();
      if (searchVal) {
        // Guarded exact ID lookup
        if (isUUID(searchVal)) {
          const { data: idMatch } = await supabase.from("fallback_plots").select("*").eq("id", searchVal).maybeSingle();
          if (idMatch) return json({ action: "plots", plot: idMatch });
        }

        // Search OR filter with guarded ID
        let filter = `municipality_number.eq.${searchVal},municipality_number_original.eq.${searchVal}`;
        if (isUUID(searchVal)) filter += `,id.eq.${searchVal}`;

        const { data, error } = await supabase.from("fallback_plots").select("*").or(filter).limit(lim);
        if (error) throw error;
        if (data && data.length > 0) return json({ action: "plots", count: data.length, plots: data });

        return json({ error: "Plot not found", searched: searchVal, suggestion: "Check plotId or municipalityNumber" }, 404);
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

    // ── DLD Lookup ──
    if (resolvedAction === "dld-lookup") {
      const landNumber = (body.landnumber || body.land_number || body.plotnumber || body.plot_number || body.plotid || body.plot_id || body.query || body.search || body.q || "") as string;
      const lat = body.lat;
      const lng = body.lng;
      const radiusMeters = body.radiusmeters || body.radius_meters;
      const lim = Math.min((body.limit as number) || 50, 200);

      if (landNumber && landNumber.trim()) {
        const val = landNumber.trim();
        const normalized = val.toUpperCase();

        let filter = `land_number.eq.${normalized},certificate_no.eq.${normalized},land_number.eq.${val}`;
        if (isUUID(val)) filter += `,id.eq.${val}`;

        const { data, error } = await supabase.from("dld_property_cache").select("*").or(filter).limit(lim);
        if (error) throw error;
        return json({ action: "dld-lookup", count: data?.length || 0, properties: data });
      }

      if (lat && lng) {
        const { data, error } = await supabase.rpc("search_dld_plots_by_radius", {
          center_lat: lat, center_lng: lng, radius_meters: radiusMeters || 2000
        });
        if (error) throw error;
        const sliced = (data || []).slice(0, lim);
        return json({ action: "dld-lookup", count: sliced.length, properties: sliced });
      }
      return json({ error: "Provide landNumber, query, or lat+lng (supported keys: landNumber, plotNumber, query)" }, 400);
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
