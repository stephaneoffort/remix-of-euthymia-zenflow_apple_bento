ALTER TABLE public.quick_notes REPLICA IDENTITY FULL;
ALTER PUBLICATION supabase_realtime ADD TABLE public.quick_notes;