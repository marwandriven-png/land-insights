
CREATE TABLE public.api_keys (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  key_hash text NOT NULL,
  key_prefix text NOT NULL,
  label text DEFAULT 'default',
  is_active boolean DEFAULT true,
  created_at timestamptz DEFAULT now(),
  last_used_at timestamptz,
  revoked_at timestamptz
);

ALTER TABLE public.api_keys ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Allow public read for key validation"
  ON public.api_keys FOR SELECT
  USING (true);

CREATE POLICY "Allow public insert for key generation"
  ON public.api_keys FOR INSERT
  WITH CHECK (true);

CREATE POLICY "Allow public update for key management"
  ON public.api_keys FOR UPDATE
  USING (true);
