-- Allow deleting attachments
CREATE POLICY "Attachments can be deleted by everyone"
ON public.attachments FOR DELETE TO public USING (true);