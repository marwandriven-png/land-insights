
-- ================================================================
-- DUBAI MARKET SNAPSHOT REPORT — POSTGRESQL DDL
-- Version 1.0 | February 2026 | Xestate Properties LLC
-- Areas: Majan, DLRC, Al Satwa, DSC, DIC, Bukadra
-- ================================================================

CREATE EXTENSION IF NOT EXISTS "pgcrypto";

-- FUNCTION: auto-update updated_at
CREATE OR REPLACE FUNCTION fn_set_updated_at()
RETURNS TRIGGER LANGUAGE plpgsql AS $$
BEGIN NEW.updated_at = NOW(); RETURN NEW; END; $$;

-- TABLE: areas
CREATE TABLE IF NOT EXISTS areas (
  area_id        UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  area_code      VARCHAR(20)  NOT NULL UNIQUE,
  area_name      VARCHAR(120) NOT NULL,
  area_name_ar   VARCHAR(120),
  zone_type      VARCHAR(30)  NOT NULL,
  sub_zone       VARCHAR(60),
  emirate        VARCHAR(30)  NOT NULL DEFAULT 'Dubai',
  market_tier    VARCHAR(20),
  is_active      BOOLEAN      NOT NULL DEFAULT TRUE,
  date_added     DATE         NOT NULL DEFAULT CURRENT_DATE,
  notes          TEXT,
  created_at     TIMESTAMPTZ  NOT NULL DEFAULT NOW(),
  updated_at     TIMESTAMPTZ  NOT NULL DEFAULT NOW()
);

CREATE TRIGGER trg_areas_ts BEFORE UPDATE ON areas
  FOR EACH ROW EXECUTE FUNCTION fn_set_updated_at();

-- SEED: 6 Initial Areas
INSERT INTO areas (area_code, area_name, zone_type, sub_zone, market_tier, notes)
VALUES
  ('MAJAN',   'Majan (Dubailand)', 'RESIDENTIAL', 'Dubailand', 'AFFORDABLE',
   'Studio-heavy; AED 880–962 PSF; highest yield 6.5–7.2%; 4 DLD projects; 1,698 units'),
  ('DLRC',    'Dubai Land Residential Complex', 'RESIDENTIAL', 'Dubailand', 'MID_HIGH',
   'CORRECTED from DRC. Volume leader 2,018 txns; 48.2% renewal rate; 5 projects; 1,382 units'),
  ('ALSATWA', 'Al Satwa (Jumeirah Garden City)', 'MIXED_USE', 'Jumeirah Garden City', 'PREMIUM',
   '327 txns; 92% off-plan; AED 2,266 avg PSF; 70.4% renewal; 3,307 rental contracts'),
  ('DSC',     'Dubai Sports City', 'RESIDENTIAL', 'Dubai Sports City', 'MID',
   '809 txns; AED 1,565 avg PSF; 3,191 rental contracts; 6 active projects; 1,332 units'),
  ('DIC',     'Dubai Industrial City', 'MIXED_USE', 'Dubai Industrial City', 'MID',
   '285 txns; 94.7% off-plan; AED 1,498–1,521 PSF; 2,034 rentals; office 51% of rentals'),
  ('BUKADRA', 'Bukadra (Nad Al Sheba / Ras Al Khor Corridor)', 'RESIDENTIAL', 'Nad Al Sheba', 'MID_PREMIUM',
   'No studios; AED 2,019–2,585 1BR PSF; ~911 units pipeline; 10 min to DIFC/Downtown')
ON CONFLICT (area_code) DO UPDATE SET
  area_name   = EXCLUDED.area_name,
  market_tier = EXCLUDED.market_tier,
  notes       = EXCLUDED.notes,
  updated_at  = NOW();

-- TABLE: market_snapshots
CREATE TABLE IF NOT EXISTS market_snapshots (
  snapshot_id        UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  area_id            UUID NOT NULL REFERENCES areas(area_id)
                       ON DELETE RESTRICT ON UPDATE CASCADE,
  period_label       VARCHAR(30)  NOT NULL,
  period_start       DATE,
  period_end         DATE,
  snapshot_date      DATE         NOT NULL DEFAULT CURRENT_DATE,
  data_source        VARCHAR(120),
  sales_txns_total   INTEGER,
  offplan_txns       INTEGER,
  offplan_pct        NUMERIC(5,2)
    GENERATED ALWAYS AS
    (CASE WHEN sales_txns_total > 0
     THEN ROUND(offplan_txns::NUMERIC / sales_txns_total * 100, 2)
     ELSE NULL END) STORED,
  resale_txns        INTEGER,
  studio_psf_avg     NUMERIC(10,2),
  studio_psf_min     NUMERIC(10,2),
  studio_psf_max     NUMERIC(10,2),
  one_br_psf_avg     NUMERIC(10,2),
  one_br_psf_min     NUMERIC(10,2),
  one_br_psf_max     NUMERIC(10,2),
  two_br_psf_avg     NUMERIC(10,2),
  three_br_psf_avg   NUMERIC(10,2),
  rental_contracts   INTEGER,
  avg_rent_psf_yr    NUMERIC(10,2),
  rental_renewal_pct NUMERIC(5,2),
  gross_yield_est    NUMERIC(5,2),
  created_at         TIMESTAMPTZ  NOT NULL DEFAULT NOW(),
  UNIQUE (area_id, period_label)
);

CREATE INDEX idx_snap_area ON market_snapshots(area_id, period_end DESC NULLS LAST);

-- TABLE: developers
CREATE TABLE IF NOT EXISTS developers (
  developer_id   UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  dev_name       VARCHAR(120) NOT NULL UNIQUE,
  dev_name_ar    VARCHAR(120),
  rera_number    VARCHAR(30)  UNIQUE,
  active_areas   TEXT[],
  notes          TEXT,
  created_at     TIMESTAMPTZ  NOT NULL DEFAULT NOW()
);

INSERT INTO developers (dev_name, notes) VALUES
  ('Samana International','Dominant in Majan (737 units) and DIC; Samana Hills S3'),
  ('Rabdan Developments','Rabdan Gates Majan (445 units); Rabdan Gardens Al Satwa'),
  ('Takmeel Real Estate','Divine Al Barari Majan'),
  ('Ary & Maz Dev.','Barari Palace Majan'),
  ('Pearlshire DLRC','Bond Living DLRC'),
  ('Marquis Home','Marquis Vista DLRC'),
  ('Leos Dev.','Weybridge Gardens 4 DLRC; Hadley Heights 2 DSC'),
  ('Mashriq Elite','Floarea Oasis DLRC'),
  ('Segrex Development','Olivia Gardens Al Satwa JGC'),
  ('Object 1 / Obj1 Real Estate','EVERGR1N House Al Satwa JGC'),
  ('Majid Developments','Mayfair Gardens Al Satwa JGC'),
  ('Enso Development','Amber by Enso Al Satwa JGC'),
  ('Alaia Developments','Chelsea Gardens Al Satwa JGC'),
  ('Prescott Real Estate','The Caden Bukadra; Golf Place DSC; Fairway Residences DSC'),
  ('Imtiaz Gi Dev.','Wynwood Horizon Bukadra'),
  ('Prestige One Dev.','Parkway Bukadra; Golf Place DSC'),
  ('True Future Real Estate','Future Residence Bukadra'),
  ('Helvetia Dev.','Helvetia Verde Bukadra'),
  ('Karma Development','Antalya DSC'),
  ('Acube Development','Vega DSC'),
  ('Azizi Developments','Azizi Grand DSC'),
  ('GFS Wonders Dev.','Coventry Centro DIC')
ON CONFLICT (dev_name) DO NOTHING;

-- TABLE: unit_types
CREATE TABLE IF NOT EXISTS unit_types (
  unit_type_id   UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  type_code      VARCHAR(20)  NOT NULL UNIQUE,
  type_name      VARCHAR(60)  NOT NULL,
  bedroom_count  SMALLINT     NOT NULL CHECK (bedroom_count >= 0),
  sort_order     SMALLINT     NOT NULL DEFAULT 0
);

INSERT INTO unit_types (type_code, type_name, bedroom_count, sort_order) VALUES
  ('STUDIO','Studio',0,1),('1BR','1 Bedroom',1,2),
  ('2BR','2 Bedroom',2,3),('3BR','3 Bedroom',3,4),
  ('4BR','4 Bedroom',4,5),('PENTHOUSE','Penthouse',4,6)
ON CONFLICT (type_code) DO NOTHING;

-- TABLE: projects
CREATE TABLE IF NOT EXISTS projects (
  project_id           UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  dld_project_number   VARCHAR(20)  UNIQUE,
  project_name         VARCHAR(120) NOT NULL,
  area_id              UUID NOT NULL REFERENCES areas(area_id)
                         ON DELETE RESTRICT ON UPDATE CASCADE,
  developer_id         UUID REFERENCES developers(developer_id)
                         ON DELETE SET NULL,
  total_units          INTEGER      CHECK (total_units > 0),
  plot_area_sqm        NUMERIC(12,2),
  plot_area_sqft       NUMERIC(14,2)
    GENERATED ALWAYS AS (plot_area_sqm * 10.7639) STORED,
  floors_formula       VARCHAR(60),
  date_registered      DATE,
  date_completion      DATE,
  completion_quarter   VARCHAR(10),
  price_from_aed       NUMERIC(14,2),
  price_to_aed         NUMERIC(14,2),
  service_charge_psf   NUMERIC(8,2),
  service_chg_note     VARCHAR(60),
  construction_status  VARCHAR(30),
  construction_pct     NUMERIC(5,2),
  payment_on_booking   NUMERIC(5,2),
  payment_construction NUMERIC(5,2),
  payment_on_handover  NUMERIC(5,2),
  payment_post_ho      NUMERIC(5,2)  DEFAULT 0,
  post_ho_months       SMALLINT,
  is_furnished         BOOLEAN       DEFAULT FALSE,
  data_as_at           DATE,
  data_source          VARCHAR(120),
  notes                TEXT,
  created_at           TIMESTAMPTZ   NOT NULL DEFAULT NOW(),
  updated_at           TIMESTAMPTZ   NOT NULL DEFAULT NOW()
);

CREATE TRIGGER trg_projects_ts BEFORE UPDATE ON projects
  FOR EACH ROW EXECUTE FUNCTION fn_set_updated_at();
CREATE INDEX idx_proj_area ON projects(area_id);
CREATE INDEX idx_proj_dld  ON projects(dld_project_number);

-- TABLE: project_unit_mix
CREATE TABLE IF NOT EXISTS project_unit_mix (
  mix_id           UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  project_id       UUID NOT NULL REFERENCES projects(project_id)
                     ON DELETE RESTRICT ON UPDATE CASCADE,
  unit_type_id     UUID NOT NULL REFERENCES unit_types(unit_type_id)
                     ON DELETE RESTRICT,
  unit_count       INTEGER       CHECK (unit_count >= 0),
  pct_of_total     NUMERIC(5,2),
  size_min_sqft    NUMERIC(10,2),
  size_max_sqft    NUMERIC(10,2),
  avg_size_sqft    NUMERIC(10,2)
    GENERATED ALWAYS AS
    (CASE WHEN size_min_sqft IS NOT NULL AND size_max_sqft IS NOT NULL
     THEN ROUND((size_min_sqft + size_max_sqft) / 2, 2)
     ELSE size_min_sqft END) STORED,
  psf_min_aed      NUMERIC(10,2),
  psf_max_aed      NUMERIC(10,2),
  price_from_aed   NUMERIC(14,2),
  created_at       TIMESTAMPTZ   NOT NULL DEFAULT NOW(),
  UNIQUE (project_id, unit_type_id)
);

CREATE INDEX idx_mix_proj ON project_unit_mix(project_id);

-- TABLE: unit_mix_templates
CREATE TABLE IF NOT EXISTS unit_mix_templates (
  template_id      UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  area_id          UUID NOT NULL REFERENCES areas(area_id)
                     ON DELETE RESTRICT ON UPDATE CASCADE,
  template_name    VARCHAR(80)  NOT NULL,
  template_style   VARCHAR(40),
  unit_type_id     UUID NOT NULL REFERENCES unit_types(unit_type_id),
  pct_range_min    NUMERIC(5,2) NOT NULL CHECK (pct_range_min >= 0),
  pct_range_max    NUMERIC(5,2) NOT NULL CHECK (pct_range_max <= 100),
  pct_recommended  NUMERIC(5,2) NOT NULL,
  rationale        TEXT,
  viability_flag   VARCHAR(5),
  created_at       TIMESTAMPTZ  NOT NULL DEFAULT NOW(),
  UNIQUE (area_id, template_name, unit_type_id)
);

CREATE INDEX idx_tmpl_area ON unit_mix_templates(area_id, template_style);

-- TABLE: development_parameters
CREATE TABLE IF NOT EXISTS development_parameters (
  param_id           UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  area_id            UUID NOT NULL REFERENCES areas(area_id)
                       ON DELETE RESTRICT ON UPDATE CASCADE,
  param_version      SMALLINT     NOT NULL DEFAULT 1,
  effective_date     DATE         NOT NULL DEFAULT CURRENT_DATE,
  superseded_date    DATE,
  far_default        NUMERIC(5,2),
  far_min            NUMERIC(5,2),
  far_max            NUMERIC(5,2),
  bua_multiplier     NUMERIC(5,3)  NOT NULL DEFAULT 1.000,
  sellable_area_pct  NUMERIC(5,2)  NOT NULL DEFAULT 95.0,
  construction_psf   NUMERIC(10,2),
  service_charge_psf_min NUMERIC(8,2),
  service_charge_psf_max NUMERIC(8,2),
  yield_est_min      NUMERIC(5,2),
  yield_est_max      NUMERIC(5,2),
  has_studios        BOOLEAN       NOT NULL DEFAULT TRUE,
  notes              TEXT,
  created_at         TIMESTAMPTZ   NOT NULL DEFAULT NOW(),
  UNIQUE (area_id, param_version)
);

-- TABLE: audit_log
CREATE TABLE IF NOT EXISTS audit_log (
  log_id      BIGSERIAL    PRIMARY KEY,
  table_name  VARCHAR(60)  NOT NULL,
  record_id   UUID,
  action      VARCHAR(10)  NOT NULL,
  old_data    JSONB,
  new_data    JSONB,
  changed_by  VARCHAR(120) NOT NULL DEFAULT current_user,
  changed_at  TIMESTAMPTZ  NOT NULL DEFAULT NOW()
);

CREATE INDEX idx_audit_tbl ON audit_log(table_name, changed_at DESC);
CREATE INDEX idx_audit_rec ON audit_log(record_id);
CREATE RULE no_update_audit AS ON UPDATE TO audit_log DO INSTEAD NOTHING;
CREATE RULE no_delete_audit AS ON DELETE TO audit_log DO INSTEAD NOTHING;

-- SEED: Feb 2026 Snapshots
INSERT INTO market_snapshots
  (area_id, period_label, period_start, period_end, snapshot_date, data_source,
   sales_txns_total, offplan_txns, resale_txns,
   studio_psf_avg, studio_psf_min, studio_psf_max,
   one_br_psf_avg, one_br_psf_min, one_br_psf_max,
   two_br_psf_avg, three_br_psf_avg,
   rental_contracts, avg_rent_psf_yr, rental_renewal_pct, gross_yield_est)
SELECT a.area_id, v.period_label, v.period_start::date, v.period_end::date, v.snapshot_date::date, v.data_source,
   v.sales_txns_total, v.offplan_txns, v.resale_txns,
   v.studio_psf_avg, v.studio_psf_min, v.studio_psf_max,
   v.one_br_psf_avg, v.one_br_psf_min, v.one_br_psf_max,
   v.two_br_psf_avg, v.three_br_psf_avg,
   v.rental_contracts, v.avg_rent_psf_yr, v.rental_renewal_pct, v.gross_yield_est
FROM areas a JOIN (VALUES
  ('MAJAN',   'FEB_2026','2025-11-01','2026-02-28','2026-02-24','DLD+Reelly',
   2559, 2175, 384, 962.00,880.00,2287.00, 1315.00,1256.00,1767.00, 1263.00,1500.00,
   NULL::integer, NULL::numeric, NULL::numeric, 6.8),
  ('DLRC',    'FEB_2026','2025-11-01','2026-02-28','2026-02-24','DLD+Reelly+Ejari',
   2018,1766,252, 1560.00,1473.00,1929.00, 1248.00,1165.00,1917.00, 1130.00,1182.00,
   2360,66.00,48.2,6.3),
  ('ALSATWA', 'FEB_2026','2025-11-01','2026-02-28','2026-02-24','DLD+Reelly+Ejari',
   327,302,25, 2408.00,2000.00,3310.00, 2151.00,1894.00,2542.00, 2073.00,NULL::numeric,
   3307,106.00,70.4,5.1),
  ('DSC',     'FEB_2026','2025-11-01','2026-02-28','2026-02-24','DLD+PropertyMonitor',
   809,NULL::integer,NULL::integer, 1227.00,NULL::numeric,NULL::numeric, 1200.00,NULL::numeric,NULL::numeric, 1095.00,NULL::numeric,
   3191,86.00,NULL::numeric,6.2),
  ('DIC',     'FEB_2026','2025-11-01','2026-02-28','2026-02-24','DLD+Ejari',
   285,270,15, 1498.00,1250.00,1650.00, 1521.00,1256.00,1730.00, 1366.00,NULL::numeric,
   2034,79.00,21.0,6.5),
  ('BUKADRA', 'FEB_2026','2025-11-01','2026-02-28','2026-02-24','DLD+Reelly',
   NULL::integer,NULL::integer,NULL::integer, NULL::numeric,NULL::numeric,NULL::numeric, 2302.00,2019.00,2585.00, 2150.00,2050.00,
   NULL::integer,NULL::numeric,NULL::numeric,6.0)
) AS v(area_code, period_label, period_start, period_end, snapshot_date, data_source,
   sales_txns_total, offplan_txns, resale_txns,
   studio_psf_avg, studio_psf_min, studio_psf_max,
   one_br_psf_avg, one_br_psf_min, one_br_psf_max,
   two_br_psf_avg, three_br_psf_avg,
   rental_contracts, avg_rent_psf_yr, rental_renewal_pct, gross_yield_est)
  ON a.area_code = v.area_code
ON CONFLICT (area_id, period_label) DO UPDATE SET
  snapshot_date = EXCLUDED.snapshot_date;

-- SEED: Development Parameters V1
INSERT INTO development_parameters
  (area_id, param_version, effective_date, far_default, far_min, far_max,
   bua_multiplier, sellable_area_pct, construction_psf,
   service_charge_psf_min, service_charge_psf_max,
   yield_est_min, yield_est_max, has_studios, notes)
SELECT a.area_id, v.param_version, v.effective_date::date, v.far_default, v.far_min, v.far_max,
   v.bua_multiplier, v.sellable_area_pct, v.construction_psf,
   v.service_charge_psf_min, v.service_charge_psf_max,
   v.yield_est_min, v.yield_est_max, v.has_studios, v.notes
FROM areas a JOIN (VALUES
  ('MAJAN',   1,'2026-02-01', 5.0,4.0,6.0, 1.000,95.0,420.00, 14.00,17.00, 6.5,7.2, TRUE,
   'Affordable; 4 DLD projects; studio-heavy; highest yield'),
  ('DLRC',    1,'2026-02-01', 4.5,3.5,5.5, 1.450,95.0,420.00, 10.00,17.00, 5.3,6.3, TRUE,
   'DLRC (corrected from DRC); volume leader; 1.45 BUA multiplier'),
  ('ALSATWA', 1,'2026-02-01', 3.5,3.0,4.0, 1.000,95.0,450.00, 18.00,20.00, 4.5,5.1, TRUE,
   'Premium; JGC only; land ~AED 3,500/sqft; 10.8x GFA/Land'),
  ('DSC',     1,'2026-02-01', 4.5,4.0,5.0, 1.450,95.0,420.00, 12.00,15.00, 5.5,6.5, TRUE,
   'Mid; BUA=GFA*FAR*1.45; balanced risk; sports amenity premium'),
  ('DIC',     1,'2026-02-01', 4.5,4.0,5.0, 1.600,95.0,420.00, 12.00,15.00, 5.2,6.6, TRUE,
   'Mid; 1.6 BUA multiplier; corporate tenants; 51% office rentals'),
  ('BUKADRA', 1,'2026-02-01', 5.5,4.5,6.0, 1.000,95.0,420.00, 15.00,18.00, 5.5,6.5, FALSE,
   'Mid-Premium; NO studios; 1BR–4BR only; 10 min to DIFC; FAR 5.5')
) AS v(area_code, param_version, effective_date, far_default, far_min, far_max,
   bua_multiplier, sellable_area_pct, construction_psf,
   service_charge_psf_min, service_charge_psf_max,
   yield_est_min, yield_est_max, has_studios, notes)
  ON a.area_code = v.area_code
ON CONFLICT (area_id, param_version) DO NOTHING;

-- VIEWS
CREATE OR REPLACE VIEW v_area_snapshot_latest AS
SELECT
  a.area_code, a.area_name, a.market_tier, a.zone_type,
  ms.period_label, ms.period_end,
  ms.sales_txns_total, ms.offplan_pct, ms.resale_txns,
  ms.studio_psf_avg, ms.one_br_psf_avg, ms.two_br_psf_avg,
  ms.rental_contracts, ms.avg_rent_psf_yr,
  ms.rental_renewal_pct, ms.gross_yield_est,
  COUNT(DISTINCT p.project_id) AS active_projects,
  SUM(p.total_units)           AS total_pipeline_units
FROM areas a
LEFT JOIN LATERAL (
  SELECT * FROM market_snapshots s
  WHERE s.area_id = a.area_id
  ORDER BY s.period_end DESC NULLS LAST
  LIMIT 1
) ms ON TRUE
LEFT JOIN projects p ON a.area_id = p.area_id
WHERE a.is_active = TRUE
GROUP BY a.area_id, a.area_code, a.area_name, a.market_tier, a.zone_type,
         ms.period_label, ms.period_end, ms.sales_txns_total, ms.offplan_pct,
         ms.resale_txns, ms.studio_psf_avg, ms.one_br_psf_avg, ms.two_br_psf_avg,
         ms.rental_contracts, ms.avg_rent_psf_yr, ms.rental_renewal_pct, ms.gross_yield_est
ORDER BY ms.sales_txns_total DESC NULLS LAST;

CREATE OR REPLACE VIEW v_project_unit_summary AS
SELECT
  a.area_code, a.area_name, p.project_name,
  d.dev_name AS developer,
  p.dld_project_number, p.total_units,
  p.completion_quarter, p.price_from_aed,
  ut.type_code, ut.type_name,
  um.unit_count, um.pct_of_total,
  um.psf_min_aed, um.psf_max_aed,
  um.avg_size_sqft,
  p.service_charge_psf,
  p.payment_on_booking, p.payment_post_ho, p.post_ho_months
FROM project_unit_mix um
JOIN projects p          ON um.project_id    = p.project_id
JOIN areas a             ON p.area_id        = a.area_id
LEFT JOIN developers d   ON p.developer_id   = d.developer_id
JOIN unit_types ut       ON um.unit_type_id  = ut.unit_type_id
ORDER BY a.area_code, p.project_name, ut.sort_order;

CREATE OR REPLACE VIEW v_recommended_mix_by_area AS
SELECT
  a.area_code, a.area_name, a.market_tier,
  t.template_name, t.template_style,
  ut.type_code, ut.type_name,
  t.pct_range_min, t.pct_range_max, t.pct_recommended,
  t.rationale, t.viability_flag
FROM unit_mix_templates t
JOIN areas a      ON t.area_id      = a.area_id
JOIN unit_types ut ON t.unit_type_id = ut.unit_type_id
ORDER BY a.area_code, t.template_name, ut.sort_order;

-- RLS: Enable on all tables with public read access
ALTER TABLE areas ENABLE ROW LEVEL SECURITY;
ALTER TABLE market_snapshots ENABLE ROW LEVEL SECURITY;
ALTER TABLE developers ENABLE ROW LEVEL SECURITY;
ALTER TABLE projects ENABLE ROW LEVEL SECURITY;
ALTER TABLE unit_types ENABLE ROW LEVEL SECURITY;
ALTER TABLE project_unit_mix ENABLE ROW LEVEL SECURITY;
ALTER TABLE unit_mix_templates ENABLE ROW LEVEL SECURITY;
ALTER TABLE development_parameters ENABLE ROW LEVEL SECURITY;
ALTER TABLE audit_log ENABLE ROW LEVEL SECURITY;

-- Public read access for all tables (this is reference market data)
CREATE POLICY "Public read areas" ON areas FOR SELECT USING (true);
CREATE POLICY "Public read market_snapshots" ON market_snapshots FOR SELECT USING (true);
CREATE POLICY "Public read developers" ON developers FOR SELECT USING (true);
CREATE POLICY "Public read projects" ON projects FOR SELECT USING (true);
CREATE POLICY "Public read unit_types" ON unit_types FOR SELECT USING (true);
CREATE POLICY "Public read project_unit_mix" ON project_unit_mix FOR SELECT USING (true);
CREATE POLICY "Public read unit_mix_templates" ON unit_mix_templates FOR SELECT USING (true);
CREATE POLICY "Public read development_parameters" ON development_parameters FOR SELECT USING (true);
CREATE POLICY "Public read audit_log" ON audit_log FOR SELECT USING (true);
