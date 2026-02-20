
-- Create access logs table for tracking who accessed shared links
CREATE TABLE public.dc_access_logs (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  link_id TEXT NOT NULL,
  event TEXT NOT NULL DEFAULT 'access_granted',
  name TEXT,
  email TEXT,
  mobile TEXT,
  device TEXT DEFAULT '—',
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

-- Enable RLS
ALTER TABLE public.dc_access_logs ENABLE ROW LEVEL SECURITY;

-- Anyone can insert access logs (public visitors register)
CREATE POLICY "Anyone can insert access logs"
ON public.dc_access_logs FOR INSERT
WITH CHECK (true);

-- Anyone can read access logs (admin views them in modal)
CREATE POLICY "Anyone can read access logs"
ON public.dc_access_logs FOR SELECT
USING (true);

-- Anyone can delete access logs
CREATE POLICY "Anyone can delete access logs"
ON public.dc_access_logs FOR DELETE
USING (true);

-- Index for fast lookup by link_id
CREATE INDEX idx_dc_access_logs_link_id ON public.dc_access_logs (link_id);
