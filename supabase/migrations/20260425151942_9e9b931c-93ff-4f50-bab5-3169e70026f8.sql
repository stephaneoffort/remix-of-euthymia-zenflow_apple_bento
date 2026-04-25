CREATE TABLE public.keep_attachments (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  entity_type text NOT NULL,
  entity_id text NOT NULL,
  note_url text NOT NULL,
  note_title text,
  note_color text,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX idx_keep_attachments_entity ON public.keep_attachments(entity_type, entity_id);
CREATE INDEX idx_keep_attachments_user ON public.keep_attachments(user_id);

ALTER TABLE public.keep_attachments ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can view their own keep attachments"
  ON public.keep_attachments FOR SELECT
  USING (auth.uid() = user_id);

CREATE POLICY "Users can create their own keep attachments"
  ON public.keep_attachments FOR INSERT
  WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can update their own keep attachments"
  ON public.keep_attachments FOR UPDATE
  USING (auth.uid() = user_id);

CREATE POLICY "Users can delete their own keep attachments"
  ON public.keep_attachments FOR DELETE
  USING (auth.uid() = user_id);

CREATE TRIGGER update_keep_attachments_updated_at
  BEFORE UPDATE ON public.keep_attachments
  FOR EACH ROW
  EXECUTE FUNCTION public.update_updated_at_column();