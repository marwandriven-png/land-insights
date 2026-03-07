
CREATE TABLE public.fallback_plots (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  municipality_number text NOT NULL,
  municipality_number_original text,
  area_name text,
  area_code text,
  common_name text,
  latitude numeric NOT NULL,
  longitude numeric NOT NULL,
  geom geometry(Point, 4326),
  plot_area_sqm numeric,
  plot_area_sqft numeric,
  gfa_sqm numeric,
  zoning text,
  floors text,
  land_use text,
  developer text,
  project_name text,
  status text DEFAULT 'Available',
  notes text,
  data_source text DEFAULT 'Bulk Import',
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE(municipality_number)
);

-- Auto-generate geom from lat/lng on insert/update
CREATE OR REPLACE FUNCTION public.fallback_plots_set_geom()
RETURNS trigger
LANGUAGE plpgsql
SET search_path = public
AS $$
BEGIN
  NEW.geom := ST_SetSRID(ST_MakePoint(NEW.longitude::double precision, NEW.latitude::double precision), 4326);
  RETURN NEW;
END;
$$;

CREATE TRIGGER trg_fallback_plots_geom
  BEFORE INSERT OR UPDATE ON public.fallback_plots
  FOR EACH ROW
  EXECUTE FUNCTION public.fallback_plots_set_geom();

-- Spatial index
CREATE INDEX idx_fallback_plots_geom ON public.fallback_plots USING GIST (geom);
CREATE INDEX idx_fallback_plots_municipality ON public.fallback_plots (municipality_number);

-- RLS
ALTER TABLE public.fallback_plots ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Public read fallback_plots" ON public.fallback_plots
  FOR SELECT TO anon, authenticated USING (true);

CREATE POLICY "Service write fallback_plots" ON public.fallback_plots
  FOR ALL TO service_role USING (true) WITH CHECK (true);

-- Spatial search function
CREATE OR REPLACE FUNCTION public.search_fallback_plots_by_radius(
  center_lat numeric,
  center_lng numeric,
  radius_meters numeric DEFAULT 1000
)
RETURNS TABLE(
  id uuid,
  municipality_number text,
  municipality_number_original text,
  area_name text,
  area_code text,
  common_name text,
  latitude numeric,
  longitude numeric,
  plot_area_sqm numeric,
  zoning text,
  status text,
  distance_m double precision
)
LANGUAGE sql STABLE
SET search_path = public
AS $$
  SELECT
    f.id, f.municipality_number, f.municipality_number_original,
    f.area_name, f.area_code, f.common_name,
    f.latitude, f.longitude, f.plot_area_sqm, f.zoning, f.status,
    ST_Distance(f.geom::geography, ST_SetSRID(ST_MakePoint(center_lng::double precision, center_lat::double precision), 4326)::geography) AS distance_m
  FROM public.fallback_plots f
  WHERE ST_DWithin(
    f.geom::geography,
    ST_SetSRID(ST_MakePoint(center_lng::double precision, center_lat::double precision), 4326)::geography,
    radius_meters::double precision
  )
  ORDER BY distance_m;
$$;
