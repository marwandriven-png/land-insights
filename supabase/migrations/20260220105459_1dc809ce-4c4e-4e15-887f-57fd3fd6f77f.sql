
-- Table to store DC share link payloads (replaces URL-encoded data)
CREATE TABLE public.dc_share_links (
  id TEXT PRIMARY KEY,
  plot_id TEXT NOT NULL,
  mix_strategy TEXT NOT NULL,
  plot_input JSONB NOT NULL,
  overrides JSONB DEFAULT '{}'::jsonb,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  expires_at TIMESTAMPTZ,
  views INTEGER NOT NULL DEFAULT 0,
  downloads INTEGER NOT NULL DEFAULT 0,
  is_active BOOLEAN NOT NULL DEFAULT true
);

-- Allow anyone to read share links (public reports)
ALTER TABLE public.dc_share_links ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Anyone can read share links"
  ON public.dc_share_links FOR SELECT
  USING (true);

-- Allow anyone to insert share links (no auth required)
CREATE POLICY "Anyone can create share links"
  ON public.dc_share_links FOR INSERT
  WITH CHECK (true);

-- Allow anyone to update share links (for view count increment, revoke)
CREATE POLICY "Anyone can update share links"
  ON public.dc_share_links FOR UPDATE
  USING (true);

-- Allow anyone to delete share links
CREATE POLICY "Anyone can delete share links"
  ON public.dc_share_links FOR DELETE
  USING (true);
