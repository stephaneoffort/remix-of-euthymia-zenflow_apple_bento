-- Table for storing accepted false-positives of the numeric attribute audit
CREATE TABLE public.numeric_audit_acceptances (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  file_path TEXT NOT NULL,
  line_number INTEGER NOT NULL,
  snippet TEXT NOT NULL,
  reason TEXT NOT NULL,
  note TEXT,
  accepted_by UUID NOT NULL,
  accepted_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  UNIQUE (file_path, line_number, snippet)
);

ALTER TABLE public.numeric_audit_acceptances ENABLE ROW LEVEL SECURITY;

-- Only admins can read or modify acceptances
CREATE POLICY "Admins can view acceptances"
ON public.numeric_audit_acceptances
FOR SELECT
TO authenticated
USING (public.has_role(auth.uid(), 'admin'::app_role));

CREATE POLICY "Admins can insert acceptances"
ON public.numeric_audit_acceptances
FOR INSERT
TO authenticated
WITH CHECK (public.has_role(auth.uid(), 'admin'::app_role) AND auth.uid() = accepted_by);

CREATE POLICY "Admins can delete acceptances"
ON public.numeric_audit_acceptances
FOR DELETE
TO authenticated
USING (public.has_role(auth.uid(), 'admin'::app_role));

CREATE INDEX idx_numeric_audit_lookup
  ON public.numeric_audit_acceptances (file_path, line_number);