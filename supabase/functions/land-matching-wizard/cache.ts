// ============================================
// PLOT DATA CACHE — Production Implementation
// supabase/functions/land-matching-wizard/cache.ts
//
// BUGS FIXED vs. submitted version:
//  C1  memoryCache was module-level (shared/unbounded) → per-instance LRU
//  C2  Cache key used raw landNumber → normalised uppercase key
//  C3  setPlotData wrote raw area → normalizeArea applied before every write
//  C4  Table name mismatch (dld_property_cache vs plot_data_cache) → unified
//  C5  getStats() TS type didn't match SQL output → aligned; added by_area/by_source
//  C6  cache_warming_log upsert always inserted new rows → UNIQUE(area) + ON CONFLICT
//  C7  searchByRadius returned data 2× older than max_age_hours → strict TTL
//  C8  revalidateAsync was a silent no-op → marks needs_revalidation=true in DB
//  C9  No LRU eviction → LRU with 500-entry cap
//  C10 warmCacheForArea called a stub that always returned [] → wired to real APIs
// ============================================

import { createClient, SupabaseClient } from "https://esm.sh/@supabase/supabase-js@2.39.0";
import { normalizeArea } from "./index.ts";

// ============================================
// CACHE CONFIGURATION
// ============================================
export const CACHE_CONFIG = {
    TTL: {
        PLOT_DATA: 7 * 24 * 60 * 60 * 1_000,   // 7 days  — general plot data
        LAND_STATUS: 30 * 24 * 60 * 60 * 1_000,   // 30 days — status rarely changes
        COORDINATES: 90 * 24 * 60 * 60 * 1_000,   // 90 days — static
    },
    STALE_WHILE_REVALIDATE: {
        ENABLED: true,
        MAX_STALE_AGE: 24 * 60 * 60 * 1_000,       // serve stale up to 24 h past TTL
    },
    MEMORY: {
        MAX_ENTRIES: 500,                            // fix C9: LRU cap
    },
    WARMING: {
        MIN_INTERVAL_MS: 24 * 60 * 60 * 1_000,     // don't re-warm area within 24 h
        RATE_LIMIT_BATCH: 10,                        // flush every N plots
        RATE_LIMIT_DELAY_MS: 1_000,                  // pause between batches
    },
};

// ============================================
// LRU MEMORY CACHE  (fixes C1 + C9)
// ============================================
interface MemoryEntry<T> {
    value: T;
    timestamp: number;
    hits: number;
}

/**
 * Simple bounded LRU cache.  When the cap is reached the least-recently-used
 * entry is evicted.  Each PlotDataCache instance gets its own LRU — no
 * cross-instance data leakage (fixes C1).
 */
export class LruCache<T> {
    private readonly map = new Map<string, MemoryEntry<T>>();
    private readonly max: number;

    constructor(maxEntries: number) {
        this.max = maxEntries;
    }

    get(key: string): MemoryEntry<T> | undefined {
        const entry = this.map.get(key);
        if (!entry) return undefined;
        // Move to end (most recently used)
        this.map.delete(key);
        this.map.set(key, entry);
        entry.hits++;
        return entry;
    }

    set(key: string, value: T): void {
        if (this.map.has(key)) this.map.delete(key); // refresh position
        else if (this.map.size >= this.max) {
            // Evict LRU (first entry)
            const oldest = this.map.keys().next().value;
            if (oldest) this.map.delete(oldest);
        }
        this.map.set(key, { value, timestamp: Date.now(), hits: 0 });
    }

    delete(key: string): void { this.map.delete(key); }
    clear(): void { this.map.clear(); }
    get size(): number { return this.map.size; }
}

// ============================================
// TYPES
// ============================================
export interface CachedPlot {
    id?: string;
    land_number: string;
    area: string;            // always normalised on write
    latitude: number;
    longitude: number;
    land_status?: string;
    property_type?: string;
    last_certificate_no?: string;
    size_sqft?: number;
    size_sqm?: number;
    data_source: 'GIS/DDA' | 'Property Status / GIS';
    cache_version: number;
    last_verified: string;   // ISO timestamp
    verification_source: 'user_search' | 'api_webhook' | 'manual_import';
    needs_revalidation: boolean;
    search_count?: number;
    raw_data?: unknown;
}

export interface CacheStats {
    total_cached: number;
    fresh_count: number;
    stale_count: number;
    needs_revalidation_count: number;
    avg_age_hours: number;
    by_area: Record<string, number>;    // fix C5: now actually populated
    by_source: Record<string, number>;  // fix C5: now actually populated
}

export interface RadiusSearchResult {
    plots: (CachedPlot & { distance_m: number; is_fresh: boolean })[];
    total: number;
    fresh_count: number;
    stale_count: number;
}

// ============================================
// CACHE KEY HELPERS  (fixes C2)
// ============================================
/** Stable, normalised cache key for a single plot. */
export function plotCacheKey(landNumber: string): string {
    return `plot:${landNumber.trim().toUpperCase()}`;
}

// ============================================
// PlotDataCache CLASS
// ============================================
export class PlotDataCache {
    // fix C1: per-instance LRU — no module-level shared map
    private readonly mem = new LruCache<CachedPlot>(CACHE_CONFIG.MEMORY.MAX_ENTRIES);
    private readonly supabase: SupabaseClient;

    constructor(supabaseUrl: string, supabaseKey: string) {
        this.supabase = createClient(supabaseUrl, supabaseKey);
    }

    // ──────────────────────────────────────────────────────────────────────────
    // PUBLIC: READ
    // ──────────────────────────────────────────────────────────────────────────

    /**
     * Retrieve a single plot with three-tier priority:
     *   1. In-memory LRU (sub-ms)
     *   2. Supabase DB (single-row lookup)
     *   3. Returns null → caller should fetch from live API
     *
     * Stale-while-revalidate: if enabled and plot is within the stale window,
     * the stale value is returned immediately while a background flag is set.
     */
    async getPlotData(
        landNumber: string,
        opts: { forceRefresh?: boolean; allowStale?: boolean } = {},
    ): Promise<CachedPlot | null> {
        const key = plotCacheKey(landNumber);  // fix C2: normalised key
        const now = Date.now();

        if (!opts.forceRefresh) {
            // 1. Memory
            const mem = this.mem.get(key);
            if (mem) {
                const age = now - mem.timestamp;
                if (age < CACHE_CONFIG.TTL.PLOT_DATA) {
                    return mem.value;
                }
                if (
                    opts.allowStale &&
                    CACHE_CONFIG.STALE_WHILE_REVALIDATE.ENABLED &&
                    age < CACHE_CONFIG.TTL.PLOT_DATA + CACHE_CONFIG.STALE_WHILE_REVALIDATE.MAX_STALE_AGE
                ) {
                    void this._markNeedsRevalidation(landNumber); // fix C8: no-op → DB flag
                    return mem.value;
                }
            }

            // 2. Database
            const db = await this._getFromDB(landNumber);
            if (db) {
                const age = now - new Date(db.last_verified).getTime();
                if (age < CACHE_CONFIG.TTL.PLOT_DATA) {
                    this.mem.set(key, db); // warm memory
                    return db;
                }
                if (
                    opts.allowStale &&
                    CACHE_CONFIG.STALE_WHILE_REVALIDATE.ENABLED &&
                    age < CACHE_CONFIG.TTL.PLOT_DATA + CACHE_CONFIG.STALE_WHILE_REVALIDATE.MAX_STALE_AGE
                ) {
                    this.mem.set(key, db);
                    void this._markNeedsRevalidation(landNumber); // fix C8
                    return db;
                }
            }
        }

        return null; // caller must hit live API
    }

    /**
     * Spatial radius query against the DB cache.
     * Returns ONLY plots fresher than max_age_hours (fix C7 — was returning
     * 2× max_age plots silently).
     */
    async searchByRadius(
        latitude: number,
        longitude: number,
        radiusMeters: number,
        maxAgeHours = 168,
    ): Promise<RadiusSearchResult> {
        const { data, error } = await this.supabase.rpc(
            'search_cached_plots_by_radius',
            {
                center_lat: latitude,
                center_lng: longitude,
                radius_m: radiusMeters,
                max_age_hours: maxAgeHours,
            },
        );

        if (error) {
            console.error('[Cache] searchByRadius RPC error:', error);
            return { plots: [], total: 0, fresh_count: 0, stale_count: 0 };
        }

        const plots = (data ?? []) as (CachedPlot & { distance_m: number; is_fresh: boolean })[];
        return {
            plots,
            total: plots.length,
            fresh_count: plots.filter(p => p.is_fresh).length,
            stale_count: plots.filter(p => !p.is_fresh).length,
        };
    }

    // ──────────────────────────────────────────────────────────────────────────
    // PUBLIC: WRITE
    // ──────────────────────────────────────────────────────────────────────────

    /**
     * Store a plot from a live API response.
     * Area is normalised before write (fixes C3).
     * source tracking ensures provenance is never lost.
     */
    async setPlotData(
        landNumber: string,
        data: Partial<CachedPlot> & { area?: string; latitude: number; longitude: number },
        source: 'GIS/DDA' | 'Property Status / GIS',
        verificationSource: CachedPlot['verification_source'] = 'user_search',
    ): Promise<void> {
        // fix C3: always normalise area on write
        const normalisedArea = normalizeArea(data.area);

        const record: CachedPlot = {
            land_number: landNumber.trim().toUpperCase(),
            area: normalisedArea,               // fix C3
            latitude: data.latitude,
            longitude: data.longitude,
            land_status: data.land_status,
            property_type: data.property_type,
            last_certificate_no: data.last_certificate_no,
            size_sqft: data.size_sqft,
            size_sqm: data.size_sqm,
            data_source: source,
            cache_version: (data.cache_version ?? 0) + 1,
            last_verified: new Date().toISOString(),
            verification_source: verificationSource,
            needs_revalidation: false,
            raw_data: data.raw_data,
        };

        const key = plotCacheKey(landNumber);
        this.mem.set(key, record);          // update LRU
        await this._saveToDB(record);       // persist
    }

    // ──────────────────────────────────────────────────────────────────────────
    // PUBLIC: CACHE WARMING  (fixes C10 — was calling a stub returning [])
    // ──────────────────────────────────────────────────────────────────────────

    /**
     * Warm the cache for a geographic area using the live GIS/DDA API.
     * Respects a 24-hour cooldown per area to prevent API hammering.
     * Wires to real queryGIS_DDA (fixes C10).
     */
    async warmCacheForArea(
        area: string,
        coords: { lat: number; lng: number },
        radiusMeters = 5_000,
        fetchFn: (req: any) => Promise<any>,  // fix C10: injected
    ): Promise<number> {
        // Check cooldown (fix C6: UNIQUE(area) so this query is reliable)
        const cooldownMs = CACHE_CONFIG.WARMING.MIN_INTERVAL_MS;
        const since = new Date(Date.now() - cooldownMs).toISOString();

        const { data: recent } = await this.supabase
            .from('cache_warming_log')
            .select('warmed_at')
            .eq('area', area)
            .gt('warmed_at', since)
            .maybeSingle();

        if (recent) {
            console.log(`[Cache Warming] Skipped "${area}" — warmed within cooldown window`);
            return 0;
        }

        console.log(`[Cache Warming] Starting for "${area}" (r=${radiusMeters}m)`);

        const result = await fetchFn({         // fix C10: real API call
            latitude: coords.lat,
            longitude: coords.lng,
            radius_meters: radiusMeters,
        });

        let stored = 0;
        for (const plot of result.plots) {
            await this.setPlotData(
                plot.land_number, plot,
                result.source as 'GIS/DDA' | 'Property Status / GIS',
                'manual_import',
            );
            stored++;

            // Rate-limit: pause every N plots
            if (stored % CACHE_CONFIG.WARMING.RATE_LIMIT_BATCH === 0) {
                await new Promise(r => setTimeout(r, CACHE_CONFIG.WARMING.RATE_LIMIT_DELAY_MS));
            }
        }

        // Upsert warming log — fix C6: UNIQUE(area), ON CONFLICT DO UPDATE
        await this.supabase
            .from('cache_warming_log')
            .upsert(
                { area, warmed_at: new Date().toISOString(), plots_cached: stored },
                { onConflict: 'area' },            // fix C6: single unique key
            );

        console.log(`[Cache Warming] Done "${area}": ${stored} plots`);
        return stored;
    }

    // ──────────────────────────────────────────────────────────────────────────
    // PUBLIC: STATS  (fixes C5 — was returning undefined for by_area/by_source)
    // ──────────────────────────────────────────────────────────────────────────

    async getStats(): Promise<CacheStats> {
        const { data, error } = await this.supabase.rpc('get_cache_statistics');
        if (error) throw new Error(`Cache stats RPC failed: ${error.message}`);

        // fix C5: SQL now returns by_area and by_source as JSONB; parse safely
        return {
            total_cached: data.total_cached ?? 0,
            fresh_count: data.fresh_count ?? 0,
            stale_count: data.stale_count ?? 0,
            needs_revalidation_count: data.needs_revalidation_count ?? 0,
            avg_age_hours: data.avg_age_hours ?? 0,
            by_area: typeof data.by_area === 'object' ? data.by_area : {},
            by_source: typeof data.by_source === 'object' ? data.by_source : {},
        };
    }

    /** Invalidate a single plot from memory + mark DB for revalidation. */
    async invalidate(landNumber: string): Promise<void> {
        this.mem.delete(plotCacheKey(landNumber));
        await this._markNeedsRevalidation(landNumber);
    }

    // ──────────────────────────────────────────────────────────────────────────
    // PRIVATE HELPERS
    // ──────────────────────────────────────────────────────────────────────────

    private async _getFromDB(landNumber: string): Promise<CachedPlot | null> {
        const { data, error } = await this.supabase
            .from('plot_data_cache')            // fix C4: unified table name
            .select('*')
            .eq('land_number', landNumber.trim().toUpperCase())
            .maybeSingle();

        if (error) { console.error('[Cache] DB read error:', error); return null; }
        return data ?? null;
    }

    private async _saveToDB(record: CachedPlot): Promise<void> {
        const { error } = await this.supabase
            .from('plot_data_cache')            // fix C4: unified table name
            .upsert(record, { onConflict: 'land_number' });

        if (error) console.error('[Cache] DB write error:', error);
    }

    /**
     * fix C8: Instead of a silent no-op, mark the DB row so a background
     * process (cron or next request) knows to refresh this plot.
     */
    private async _markNeedsRevalidation(landNumber: string): Promise<void> {
        await this.supabase
            .from('plot_data_cache')
            .update({ needs_revalidation: true })
            .eq('land_number', landNumber.trim().toUpperCase());
    }
}
