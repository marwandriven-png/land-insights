import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.49.1";
import { runFeasibility } from "./feasibility.ts";
import { hashKey } from "./auth.ts";

// ── v1.6.0 — Always-enrich with DDA GIS when local data is partial ──────────

const VERSION = "1.6.0";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type, x-land-os-api-key",
};

const json = (body: unknown, status = 200) =>
  new Response(JSON.stringify(body), { status, headers: { ...corsHeaders, "Content-Type": "application/json" } });

const isUUID = (s: string) => /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(s);

const DDA_GIS_BASE = "https://gis.dda.gov.ae/server/rest/services/DDA/BASIC_LAND_BASE/MapServer";

// ── Default FAR by land use ──────────────────────────────────────────────────
const DEFAULT_FAR: Record<string, number> = {
  residential: 3.5, villa: 1.2, mixed: 4.0, commercial: 5.0, retail: 2.0, industrial: 1.5,
};

function parseFloors(f: string | null | undefined): number {
  if (!f) return 0;
  const s = String(f).trim();
  // G+P+14 → 16, G+2 → 3, B+G+14 → 16
  const parts = s.match(/(\d+)/g);
  if (!parts) return 0;
  const m = s.match(/[Gg]\s*\+?\s*[Pp]?\s*\+?\s*(\d+)/);
  if (m) {
    let total = parseInt(m[1], 10) + 1; // +1 for ground
    if (/[Pp]/.test(s)) total += 1; // podium
    if (/[Bb]/.test(s)) total += 1; // basement
    return total;
  }
  const n = parseInt(parts[parts.length - 1], 10);
  return isNaN(n) ? 0 : n;
}

function estimateGFA(areaSqm: number, floors: string | null | undefined, landUse?: string | null): number | null {
  const fc = parseFloors(floors);
  if (fc > 0) {
    const coverage = fc <= 3 ? 0.60 : fc <= 10 ? 0.65 : 0.70;
    return Math.round(areaSqm * coverage * fc);
  }
  // Fallback: use default FAR if no floors
  if (areaSqm > 0) {
    const cat = detectCategory(landUse);
    const far = DEFAULT_FAR[cat] ?? 3.5;
    return Math.round(areaSqm * far);
  }
  return null;
}

function detectCategory(landUse?: string | null): string {
  const u = (landUse || "").toLowerCase();
  if (u.includes("villa")) return "villa";
  if (u.includes("retail")) return "retail";
  if (u.includes("commercial") || u.includes("office")) return "commercial";
  if (u.includes("mixed")) return "mixed";
  if (u.includes("industrial")) return "industrial";
  return "residential";
}

function deriveLandUse(zoning: string): string {
  const z = zoning.toLowerCase();
  if (z.includes("villa") || z.includes("residential")) return "Residential";
  if (z.includes("commercial") || z.includes("retail")) return "Commercial";
  if (z.includes("mixed")) return "Mixed Use";
  if (z.includes("industrial")) return "Industrial";
  if (z.includes("hotel") || z.includes("hospitality")) return "Hospitality";
  return "Residential";
}

/** Merge two objects, preferring non-null values from primary */
function mergeEnrich(primary: Record<string, any>, secondary: Record<string, any>): Record<string, any> {
  const merged: Record<string, any> = { ...secondary };
  for (const [k, v] of Object.entries(primary)) {
    if (v !== null && v !== undefined && v !== "") merged[k] = v;
  }
  return merged;
}

/** Check if local data has critical nulls that need GIS enrichment */
function needsGISEnrichment(data: Record<string, any>): boolean {
  const critical = ["gfa_sqm", "zoning", "floors", "land_use"];
  const nullCount = critical.filter(k => !data[k] || data[k] === null || data[k] === "").length;
  return nullCount >= 2; // if 2+ critical fields are null, query GIS
}

// ── DDA GIS Query ────────────────────────────────────────────────────────────
async function queryDDAGIS(plotNumber: string): Promise<Record<string, any> | null> {
  try {
    const sanitized = plotNumber.replace(/[^a-zA-Z0-9_\-]/g, "");
    const params = new URLSearchParams({
      where: `PLOT_NUMBER='${sanitized}'`,
      outFields: "*",
      returnGeometry: "true",
      outSR: "4326",
      f: "json",
    });
    console.log(`[land-os-api] DDA GIS query: ${sanitized}`);
    const resp = await fetch(`${DDA_GIS_BASE}/2/query?${params}`, {
      method: "GET",
      headers: { Accept: "application/json", "User-Agent": "LandOS-API/1.6" },
    });
    if (!resp.ok) {
      console.log(`[land-os-api] DDA GIS HTTP ${resp.status}`);
      return null;
    }
    const data = await resp.json();
    const features = data?.features;
    if (!features || features.length === 0) {
      console.log(`[land-os-api] DDA GIS: no features for ${sanitized}`);
      return null;
    }
    const f = features[0];
    const attrs = f.attributes || {};
    const geom = f.geometry || {};

    const areaSqm = parseFloat(attrs.AREA_SQM) || null;
    const areaSqft = parseFloat(attrs.AREA_SQFT) || (areaSqm ? Math.round(areaSqm * 10.7639) : null);
    const floors = attrs.MAX_HEIGHT_FLOORS || attrs.FLOORS || null;
    const zoning = attrs.LANDUSE_DETAILS || attrs.LANDUSE_CATEGORY || attrs.MAIN_LANDUSE || null;
    const landUse = attrs.MAIN_LANDUSE || (zoning ? deriveLandUse(zoning) : null);
    const gfaSqm = parseFloat(attrs.GFA_SQM) || null;

    // ENTITY_NAME is the developer/owner entity, NOT the area name
    // COMMUNITY_NAME or PROJECT_NAME is the actual area/community
    const resolvedAreaName = attrs.COMMUNITY_NAME || attrs.PROJECT_NAME || attrs.COMMON_NAME || null;
    const resolvedDeveloper = attrs.ENTITY_NAME || attrs.DEVELOPER_NAME || attrs.OWNER_NAME || null;

    return {
      municipality_number: sanitized,
      area_name: resolvedAreaName,
      area_code: attrs.AREA_CODE || null,
      common_name: attrs.COMMON_NAME || null,
      plot_area_sqm: areaSqm,
      plot_area_sqft: areaSqft,
      gfa_sqm: gfaSqm,
      zoning,
      floors: floors ? String(floors) : null,
      land_use: landUse,
      sub_land_use: attrs.SUB_LANDUSE || null,
      developer: resolvedDeveloper,
      project_name: attrs.PROJECT_NAME || attrs.COMMON_NAME || null,
      status: attrs.SITE_STATUS || attrs.CONSTRUCTION_STATUS || null,
      latitude: geom.y || geom.latitude || null,
      longitude: geom.x || geom.longitude || null,
      max_plot_coverage: parseFloat(attrs.MAX_PLOT_COVERAGE) || null,
      plot_coverage: parseFloat(attrs.PLOT_COVERAGE) || null,
      far: parseFloat(attrs.FAR) || null,
      max_height: attrs.MAX_HEIGHT || null,
      is_frozen: attrs.IS_FROZEN === "Yes" || attrs.IS_FROZEN === true,
      data_source: "DDA_GIS_Live",
    };
  } catch (err) {
    console.error(`[land-os-api] DDA GIS error:`, err);
    return null;
  }
}

/** Build fully enriched plot with auto-calculations and data quality flag */
function buildEnrichedPlot(merged: Record<string, any>): Record<string, any> {
  const areaSqm = parseFloat(merged.plot_area_sqm || merged.size_sqm || merged.area_sqm) || null;
  const areaSqft = parseFloat(merged.plot_area_sqft || merged.size_sqft) || (areaSqm ? Math.round(areaSqm * 10.7639) : null);
  const zoning = merged.zoning || merged.property_type || null;
  const floors = merged.floors || null;
  const landUse = merged.land_use || (zoning ? deriveLandUse(zoning) : null);

  // GFA: prefer DB value, then estimate from floors, then estimate from FAR
  let gfaSqm = parseFloat(merged.gfa_sqm) || null;
  let gfaSource = gfaSqm ? "database" : null;
  if (!gfaSqm && areaSqm) {
    gfaSqm = estimateGFA(areaSqm, floors, landUse);
    gfaSource = floors ? "estimated_from_floors" : "estimated_from_far";
  }
  const gfaSqft = gfaSqm ? Math.round(gfaSqm * 10.7639) : null;

  // FAR
  const far = parseFloat(merged.far) || (areaSqm && gfaSqm ? +(gfaSqm / areaSqm).toFixed(2) : null);

  // Area name: prefer GIS entity name over fallback
  const areaName = merged.area_name || merged.area || merged.district || merged.community || null;

  const criticalFields = [areaSqm, areaSqft, gfaSqm, zoning, floors, landUse];
  const filledCount = criticalFields.filter(f => f !== null && f !== undefined).length;
  const dataQuality = filledCount >= 5 ? "complete" : filledCount >= 3 ? "partial" : "fallback";

  return {
    ...merged,
    area_name: areaName,
    plot_area_sqm: areaSqm,
    plot_area_sqft: areaSqft,
    gfa_sqm: gfaSqm,
    gfa_sqft: gfaSqft,
    far,
    zoning,
    floors,
    land_use: landUse,
    land_status: merged.status || merged.land_status || "Available",
    municipality_number: merged.municipality_number || merged.land_number,
    developer: merged.developer || null,
    project_name: merged.project_name || merged.common_name || null,
    data_quality: dataQuality,
    gfa_source: gfaSource,
  };
}

/** Attach feasibility calculation to plot */
function enrichWithFeasibility(plot: any, searchVal?: string) {
  const areaSqft = plot.plot_area_sqft || (plot.plot_area_sqm ? plot.plot_area_sqm * 10.764 : 0);
  if (areaSqft) {
    try {
      const f = runFeasibility({
        plotId: plot.municipality_number || searchVal || "unknown",
        areaSqft,
        gfaSqft: plot.gfa_sqft || (plot.gfa_sqm ? plot.gfa_sqm * 10.764 : undefined),
        zoning: plot.zoning,
        floors: plot.floors,
        area: plot.area_name,
      });
      plot.estimatedGDV = f?.revenue?.grossDevelopmentValue;
      plot.targetIRR = f?.profitability?.roiPct;
      plot.feasibility = f;
    } catch (e) {
      console.error("[land-os-api] Feasibility error:", e);
    }
  }
  return plot;
}

// ── Main handler ─────────────────────────────────────────────────────────────
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

    // ── Health ──
    if (resolvedAction === "health") {
      return json({
        status: "ok",
        version: VERSION,
        timestamp: new Date().toISOString(),
        actions: ["feasibility", "plots", "lookup", "dld-lookup", "market", "health"],
        features: ["always_enrich_gis", "gfa_estimation", "data_quality_flag", "far_fallback"],
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

    // ── Plots (multi-source enrichment) ──
    if (resolvedAction === "plots") {
      const searchInput = body.plotid || body.plot_id || body.municipalitynumber || body.municipality_number ||
        body.plotnumber || body.plot_number || body.query || body.search || body.q;
      const areaName = body.areaname || body.area_name;
      const lat = body.lat;
      const lng = body.lng;
      const lim = Math.min((body.limit as number) || 50, 200);

      const searchVal = searchInput?.toString();
      if (searchVal) {
        console.log(`[land-os-api] Plot search: ${searchVal}`);

        // 1. Search fallback_plots
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

        // 2. Search dld_property_cache
        let dldData: any = null;
        {
          const { data } = await supabase.from("dld_property_cache").select("*")
            .or(`land_number.eq.${searchVal},land_number.eq.${searchVal.toUpperCase()}`)
            .limit(1).maybeSingle();
          dldData = data;
        }

        // 3. ALWAYS query DDA GIS for enrichment (key fix: don't skip when local data exists)
        let gisData: any = null;
        const localData = fallbackData || dldData;
        if (!localData || needsGISEnrichment(localData)) {
          gisData = await queryDDAGIS(searchVal);
          console.log(`[land-os-api] GIS enrichment: ${gisData ? "HIT" : "MISS"} for ${searchVal}`);
        }

        // 4. Merge all sources (GIS overrides local nulls)
        if (localData || gisData) {
          let merged: Record<string, any> = {};
          if (dldData) merged = mergeEnrich(dldData, merged);
          if (fallbackData) merged = mergeEnrich(fallbackData, merged);
          if (gisData) merged = mergeEnrich(gisData, merged); // GIS takes priority for non-null fields

          const enriched = enrichWithFeasibility(buildEnrichedPlot(merged), searchVal);

          const sources = { fallback: !!fallbackData, dld: !!dldData, gis: !!gisData };
          console.log(`[land-os-api] Plot found: ${searchVal} | quality=${enriched.data_quality} | sources=${JSON.stringify(sources)}`);
          return json({ action: "plots", plot: enriched, data_quality: enriched.data_quality, sources });
        }

        console.log(`[land-os-api] Plot not found: ${searchVal}`);
        return json({ error: "Plot not found", searched: searchVal, sources_checked: ["fallback_plots", "dld_property_cache", "dda_gis"] }, 404);
      }

      if (lat && lng) {
        const { data, error } = await supabase.rpc("search_fallback_plots_by_radius", {
          center_lat: lat, center_lng: lng, radius_meters: body.radiusmeters || body.radius_meters || 2000
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
      const lim = Math.min((body.limit as number) || 50, 200);

      if (landNumber && landNumber.trim()) {
        const val = landNumber.trim();
        const normalized = val.toUpperCase();

        const { data: dldData, error: dldErr } = await supabase.from("dld_property_cache").select("*")
          .or(`land_number.eq.${normalized},certificate_no.eq.${normalized},land_number.eq.${val}`)
          .limit(lim);
        if (dldErr) throw dldErr;

        const { data: fallbackData } = await supabase.from("fallback_plots").select("*")
          .or(`municipality_number.eq.${val},municipality_number_original.eq.${val}`)
          .limit(lim);

        // Always try GIS
        let gisData: any = null;
        const hasLocalData = (dldData?.length || 0) > 0 || (fallbackData?.length || 0) > 0;
        const localSample = dldData?.[0] || fallbackData?.[0];
        if (!hasLocalData || (localSample && needsGISEnrichment(localSample))) {
          gisData = await queryDDAGIS(val);
        }

        let enrichedProperties = (dldData || []).map((dld: any) => {
          const fb = (fallbackData || []).find((f: any) =>
            f.municipality_number === val || f.municipality_number_original === val
          );
          let merged = fb ? mergeEnrich(fb, dld) : { ...dld };
          if (gisData) merged = mergeEnrich(gisData, merged);
          return enrichWithFeasibility(buildEnrichedPlot(merged), val);
        });

        if (enrichedProperties.length === 0 && (fallbackData || []).length > 0) {
          enrichedProperties = fallbackData!.map((fb: any) => {
            let merged = { ...fb };
            if (gisData) merged = mergeEnrich(gisData, merged);
            return enrichWithFeasibility(buildEnrichedPlot(merged), val);
          });
        }

        if (enrichedProperties.length === 0 && gisData) {
          const enriched = enrichWithFeasibility(buildEnrichedPlot(gisData), val);
          return json({ action: "dld-lookup", count: 1, properties: [enriched], sources: { dld: false, fallback: false, gis: true } });
        }

        if (enrichedProperties.length > 0) {
          return json({
            action: "dld-lookup", count: enrichedProperties.length, properties: enrichedProperties,
            sources: { dld: !!(dldData?.length), fallback: !!(fallbackData?.length), gis: !!gisData }
          });
        }

        return json({ action: "dld-lookup", count: 0, properties: [], sources_checked: ["dld_property_cache", "fallback_plots", "dda_gis"] });
      }

      if (lat && lng) {
        const { data, error } = await supabase.rpc("search_dld_plots_by_radius", {
          center_lat: lat, center_lng: lng, radius_meters: body.radiusmeters || body.radius_meters || 2000
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
