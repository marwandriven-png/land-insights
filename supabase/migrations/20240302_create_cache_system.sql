-- ============================================
-- CACHE SYSTEM MIGRATION
-- BUGS FIXED vs. previous:
--  - Unified table name (plot_data_cache)
--  - Added last_verified, verification_source, cache_version
--  - Added needs_revalidation flag
--  - Added cache_warming_log table
--  - Enhanced statistics RPC
-- ============================================

-- 1. Unified Plot Data Cache Table
CREATE TABLE IF NOT EXISTS plot_data_cache (
    id               UUID         PRIMARY KEY DEFAULT gen_random_uuid(),
    land_number      VARCHAR(100) NOT NULL UNIQUE,
    area             VARCHAR(200) NOT NULL,
    latitude         DECIMAL(10, 8) NOT NULL,
    longitude        DECIMAL(11, 8) NOT NULL,
    geom             GEOMETRY(Point, 4326),
    land_status      VARCHAR(100),
    property_type    VARCHAR(100),
    last_certificate_no VARCHAR(100),
    size_sqft        DECIMAL(15, 2),
    size_sqm         DECIMAL(15, 2),
    data_source      VARCHAR(50)  NOT NULL, -- 'GIS/DDA' or 'Property Status / GIS'
    cache_version    INTEGER      DEFAULT 1,
    last_verified    TIMESTAMPTZ  DEFAULT NOW(),
    verification_source VARCHAR(50) DEFAULT 'user_search', -- 'user_search', 'api_webhook', 'manual_import'
    needs_revalidation BOOLEAN    DEFAULT FALSE,
    search_count     INTEGER      DEFAULT 0,
    raw_data         JSONB,
    CONSTRAINT valid_lat CHECK (latitude BETWEEN -90 AND 90),
    CONSTRAINT valid_lng CHECK (longitude BETWEEN -180 AND 180)
);

-- 2. Cache Warming Log
CREATE TABLE IF NOT EXISTS cache_warming_log (
    area             VARCHAR(200) PRIMARY KEY,
    warmed_at        TIMESTAMPTZ  DEFAULT NOW(),
    plots_cached     INTEGER      DEFAULT 0
);

-- 3. Indexes
CREATE INDEX IF NOT EXISTS idx_plot_cache_geom ON plot_data_cache USING GIST(geom);
CREATE INDEX IF NOT EXISTS idx_plot_cache_land_number ON plot_data_cache(land_number);
CREATE INDEX IF NOT EXISTS idx_plot_cache_area ON plot_data_cache(area);
CREATE INDEX IF NOT EXISTS idx_plot_cache_needs_revalidation ON plot_data_cache(needs_revalidation) WHERE needs_revalidation = TRUE;

-- 4. Trigger for geometry
CREATE OR REPLACE FUNCTION update_plot_cache_geometry()
RETURNS TRIGGER AS $$
BEGIN
    NEW.geom = ST_SetSRID(ST_MakePoint(NEW.longitude, NEW.latitude), 4326);
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS trigger_update_plot_cache_geometry ON plot_data_cache;
CREATE TRIGGER trigger_update_plot_cache_geometry
    BEFORE INSERT OR UPDATE OF latitude, longitude
    ON plot_data_cache
    FOR EACH ROW
    EXECUTE FUNCTION update_plot_cache_geometry();

-- 5. Enhanced Radius Search RPC
CREATE OR REPLACE FUNCTION search_cached_plots_by_radius(
    center_lat    DECIMAL,
    center_lng    DECIMAL,
    radius_m      INTEGER,
    max_age_hours INTEGER DEFAULT 168
)
RETURNS TABLE (
    land_number      VARCHAR,
    area             VARCHAR,
    latitude         DECIMAL,
    longitude        DECIMAL,
    distance_m       DECIMAL,
    land_status      VARCHAR,
    property_type    VARCHAR,
    last_certificate_no VARCHAR,
    data_source      VARCHAR,
    last_verified    TIMESTAMPTZ,
    is_fresh         BOOLEAN
) AS $$
BEGIN
    UPDATE plot_data_cache
    SET search_count = search_count + 1
    WHERE ST_DWithin(
        geom::geography,
        ST_SetSRID(ST_MakePoint(center_lng, center_lat), 4326)::geography,
        radius_m
    );

    RETURN QUERY
    SELECT
        p.land_number,
        p.area,
        p.latitude,
        p.longitude,
        ROUND(
            ST_Distance(
                p.geom::geography,
                ST_SetSRID(ST_MakePoint(center_lng, center_lat), 4326)::geography
            )::numeric, 2
        ) AS distance_m,
        p.land_status,
        p.property_type,
        p.last_certificate_no,
        p.data_source,
        p.last_verified,
        (p.last_verified > NOW() - (max_age_hours || ' hours')::interval) AND (p.needs_revalidation = FALSE) AS is_fresh
    FROM plot_data_cache p
    WHERE ST_DWithin(
        p.geom::geography,
        ST_SetSRID(ST_MakePoint(center_lng, center_lat), 4326)::geography,
        radius_m
    )
    ORDER BY distance_m;
END;
$$ LANGUAGE plpgsql;

-- 6. Statistics RPC
CREATE OR REPLACE FUNCTION get_cache_statistics()
RETURNS JSONB AS $$
DECLARE
    result JSONB;
BEGIN
    SELECT jsonb_build_object(
        'total_cached', COUNT(*),
        'fresh_count', COUNT(*) FILTER (WHERE last_verified > NOW() - INTERVAL '7 days' AND needs_revalidation = FALSE),
        'stale_count', COUNT(*) FILTER (WHERE last_verified <= NOW() - INTERVAL '7 days' OR needs_revalidation = TRUE),
        'needs_revalidation_count', COUNT(*) FILTER (WHERE needs_revalidation = TRUE),
        'avg_age_hours', ROUND(AVG(EXTRACT(EPOCH FROM (NOW() - last_verified)) / 3600)),
        'by_area', (
            SELECT jsonb_object_agg(area, cnt)
            FROM (SELECT area, COUNT(*) as cnt FROM plot_data_cache GROUP BY area LIMIT 50) s
        ),
        'by_source', (
            SELECT jsonb_object_agg(data_source, cnt)
            FROM (SELECT data_source, COUNT(*) as cnt FROM plot_data_cache GROUP BY data_source) s
        )
    ) INTO result
    FROM plot_data_cache;
    
    RETURN COALESCE(result, '{}'::jsonb);
END;
$$ LANGUAGE plpgsql;

-- 7. RLS
ALTER TABLE plot_data_cache ENABLE ROW LEVEL SECURITY;
CREATE POLICY "service_role_all" ON plot_data_cache TO service_role USING (true) WITH CHECK (true);
CREATE POLICY "anon_read" ON plot_data_cache FOR SELECT TO anon USING (true);
CREATE POLICY "authenticated_read" ON plot_data_cache FOR SELECT TO authenticated USING (true);

ALTER TABLE cache_warming_log ENABLE ROW LEVEL SECURITY;
CREATE POLICY "service_role_all_warming" ON cache_warming_log TO service_role USING (true) WITH CHECK (true);
