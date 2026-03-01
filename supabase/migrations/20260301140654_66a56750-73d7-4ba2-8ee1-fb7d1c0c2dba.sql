
-- PostGIS extension (idempotent)
CREATE EXTENSION IF NOT EXISTS postgis;

-- DLD Property Status Cache table
CREATE TABLE IF NOT EXISTS dld_property_cache (
    id               UUID         PRIMARY KEY DEFAULT gen_random_uuid(),
    land_number      VARCHAR(100) NOT NULL,
    title_deed_no    VARCHAR(100),
    certificate_no   VARCHAR(100),
    area             VARCHAR(200),
    district         VARCHAR(200),
    community        VARCHAR(200),
    latitude         DECIMAL(10, 8) NOT NULL,
    longitude        DECIMAL(11, 8) NOT NULL,
    geom             GEOMETRY(Point, 4326),
    property_type    VARCHAR(50),
    land_status      VARCHAR(50),
    ownership_type   VARCHAR(50),
    size_sqft        DECIMAL(15, 2),
    size_sqm         DECIMAL(15, 2),
    last_updated     TIMESTAMPTZ  DEFAULT NOW(),
    data_source      VARCHAR(50)  DEFAULT 'DLD Property Status',
    raw_data         JSONB,
    CONSTRAINT valid_latitude  CHECK (latitude  BETWEEN -90  AND  90),
    CONSTRAINT valid_longitude CHECK (longitude BETWEEN -180 AND 180),
    CONSTRAINT uq_dld_land_number UNIQUE (land_number)
);

-- Indexes
CREATE INDEX IF NOT EXISTS idx_dld_property_geom ON dld_property_cache USING GIST(geom);
CREATE INDEX IF NOT EXISTS idx_dld_property_land_number ON dld_property_cache(land_number);
CREATE INDEX IF NOT EXISTS idx_dld_property_area ON dld_property_cache(area);
CREATE INDEX IF NOT EXISTS idx_dld_property_status ON dld_property_cache(land_status) WHERE land_status IS NOT NULL;
CREATE INDEX IF NOT EXISTS idx_dld_property_lookup ON dld_property_cache(land_number, area);

-- Trigger: auto-maintain PostGIS geometry
CREATE OR REPLACE FUNCTION update_dld_cache_geometry()
RETURNS TRIGGER
LANGUAGE plpgsql
SET search_path = public
AS $$
BEGIN
    NEW.geom = ST_SetSRID(ST_MakePoint(NEW.longitude, NEW.latitude), 4326);
    RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trigger_update_dld_geometry ON dld_property_cache;
CREATE TRIGGER trigger_update_dld_geometry
    BEFORE INSERT OR UPDATE OF latitude, longitude
    ON dld_property_cache
    FOR EACH ROW
    EXECUTE FUNCTION update_dld_cache_geometry();

-- RPC: search_dld_plots_by_radius
CREATE OR REPLACE FUNCTION search_dld_plots_by_radius(
    center_lat    DECIMAL,
    center_lng    DECIMAL,
    radius_meters INTEGER
)
RETURNS TABLE (
    plot_id          UUID,
    land_number      VARCHAR,
    area             VARCHAR,
    latitude         DECIMAL,
    longitude        DECIMAL,
    distance_m       DECIMAL,
    land_status      VARCHAR,
    certificate_number VARCHAR,
    property_type    VARCHAR
)
LANGUAGE plpgsql
STABLE
SET search_path = public
AS $$
BEGIN
    RETURN QUERY
    SELECT
        d.id                AS plot_id,
        d.land_number,
        d.area,
        d.latitude,
        d.longitude,
        ROUND(
            ST_Distance(
                d.geom::geography,
                ST_SetSRID(ST_MakePoint(center_lng, center_lat), 4326)::geography
            )::numeric, 2
        )                   AS distance_m,
        d.land_status,
        d.certificate_no    AS certificate_number,
        d.property_type
    FROM dld_property_cache d
    WHERE ST_DWithin(
        d.geom::geography,
        ST_SetSRID(ST_MakePoint(center_lng, center_lat), 4326)::geography,
        radius_meters
    )
    ORDER BY distance_m;
END;
$$;

-- Upsert function for batch import
CREATE OR REPLACE FUNCTION upsert_dld_property(
    p_land_number   VARCHAR,
    p_latitude      DECIMAL,
    p_longitude     DECIMAL,
    p_area          VARCHAR  DEFAULT NULL,
    p_land_status   VARCHAR  DEFAULT NULL,
    p_title_deed_no VARCHAR  DEFAULT NULL,
    p_property_type VARCHAR  DEFAULT NULL,
    p_raw_data      JSONB    DEFAULT NULL
)
RETURNS UUID
LANGUAGE plpgsql
SET search_path = public
AS $$
DECLARE v_id UUID;
BEGIN
    INSERT INTO dld_property_cache (
        land_number, latitude, longitude,
        area, land_status, title_deed_no,
        property_type, raw_data, last_updated
    ) VALUES (
        p_land_number, p_latitude, p_longitude,
        p_area, p_land_status, p_title_deed_no,
        p_property_type, p_raw_data, NOW()
    )
    ON CONFLICT ON CONSTRAINT uq_dld_land_number
    DO UPDATE SET
        latitude      = EXCLUDED.latitude,
        longitude     = EXCLUDED.longitude,
        area          = EXCLUDED.area,
        land_status   = EXCLUDED.land_status,
        title_deed_no = EXCLUDED.title_deed_no,
        property_type = EXCLUDED.property_type,
        raw_data      = EXCLUDED.raw_data,
        last_updated  = NOW()
    RETURNING id INTO v_id;
    RETURN v_id;
END;
$$;

-- Freehold view
CREATE OR REPLACE VIEW v_dld_freehold_plots AS
SELECT * FROM dld_property_cache WHERE land_status = 'Freehold';

-- RLS
ALTER TABLE dld_property_cache ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "allow_read_anon" ON dld_property_cache;
CREATE POLICY "allow_read_anon"
    ON dld_property_cache FOR SELECT
    TO anon USING (true);

DROP POLICY IF EXISTS "allow_read_authenticated" ON dld_property_cache;
CREATE POLICY "allow_read_authenticated"
    ON dld_property_cache FOR SELECT
    TO authenticated USING (true);

DROP POLICY IF EXISTS "allow_write_service_role" ON dld_property_cache;
CREATE POLICY "allow_write_service_role"
    ON dld_property_cache FOR ALL
    TO service_role USING (true) WITH CHECK (true);

-- Seed test data
SELECT upsert_dld_property('WAS3-001', 25.083456, 55.283456, 'Wadi Al Safa 3', 'Freehold',  NULL, 'Land', NULL);
SELECT upsert_dld_property('WAS3-002', 25.084567, 55.284567, 'Wadi Al Safa 3', 'Freehold',  NULL, 'Land', NULL);
SELECT upsert_dld_property('WAS3-003', 25.085678, 55.285678, 'Wadi Al Safa 3', 'Leasehold', NULL, 'Land', NULL);
SELECT upsert_dld_property('SS2-001',  25.100000, 55.300000, 'Saih Shuaib 2',  'Freehold',  NULL, 'Land', NULL);
