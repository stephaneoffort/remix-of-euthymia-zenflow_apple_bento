
CREATE TABLE public.filter_presets (
  id text NOT NULL DEFAULT ('fp_' || gen_random_uuid()::text) PRIMARY KEY,
  name text NOT NULL,
  filters jsonb NOT NULL DEFAULT '{}'::jsonb,
  member_id text NOT NULL,
  created_at timestamp with time zone NOT NULL DEFAULT now()
);

ALTER TABLE public.filter_presets ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Filter presets viewable by authenticated"
  ON public.filter_presets FOR SELECT
  TO authenticated
  USING (true);

CREATE POLICY "Filter presets insertable by authenticated"
  ON public.filter_presets FOR INSERT
  TO authenticated
  WITH CHECK (true);

CREATE POLICY "Filter presets updatable by authenticated"
  ON public.filter_presets FOR UPDATE
  TO authenticated
  USING (true);

CREATE POLICY "Filter presets deletable by authenticated"
  ON public.filter_presets FOR DELETE
  TO authenticated
  USING (true);
