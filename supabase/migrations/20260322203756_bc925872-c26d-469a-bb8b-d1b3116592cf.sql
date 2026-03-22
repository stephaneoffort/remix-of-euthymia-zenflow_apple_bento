
CREATE TABLE public.app_settings (
  key text PRIMARY KEY,
  value text NOT NULL,
  updated_at timestamp with time zone NOT NULL DEFAULT now()
);

ALTER TABLE public.app_settings ENABLE ROW LEVEL SECURITY;

-- Everyone can read settings
CREATE POLICY "App settings viewable by everyone"
  ON public.app_settings FOR SELECT TO public
  USING (true);

-- Only admins can insert
CREATE POLICY "Admins can insert app settings"
  ON public.app_settings FOR INSERT TO authenticated
  WITH CHECK (has_role(auth.uid(), 'admin'::app_role));

-- Only admins can update
CREATE POLICY "Admins can update app settings"
  ON public.app_settings FOR UPDATE TO authenticated
  USING (has_role(auth.uid(), 'admin'::app_role));

-- Seed default palette
INSERT INTO public.app_settings (key, value) VALUES ('theme_palette', 'sapphire');
