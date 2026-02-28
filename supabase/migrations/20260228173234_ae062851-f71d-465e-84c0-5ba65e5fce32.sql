
-- Fix security definer views by setting security_invoker
CREATE OR REPLACE VIEW v_area_snapshot_latest
WITH (security_invoker = true)
AS
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

CREATE OR REPLACE VIEW v_project_unit_summary
WITH (security_invoker = true)
AS
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

CREATE OR REPLACE VIEW v_recommended_mix_by_area
WITH (security_invoker = true)
AS
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

-- Fix function search path
CREATE OR REPLACE FUNCTION fn_set_updated_at()
RETURNS TRIGGER LANGUAGE plpgsql
SET search_path = public
AS $$
BEGIN NEW.updated_at = NOW(); RETURN NEW; END; $$;
