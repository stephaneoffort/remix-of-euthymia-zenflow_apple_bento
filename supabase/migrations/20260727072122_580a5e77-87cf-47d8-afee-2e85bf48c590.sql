-- Valeur par défaut : l'équipe active de l'utilisateur courant
ALTER TABLE public.spaces          ALTER COLUMN org_id SET DEFAULT public.current_org_id();
ALTER TABLE public.quick_notes     ALTER COLUMN org_id SET DEFAULT public.current_org_id();
ALTER TABLE public.task_templates  ALTER COLUMN org_id SET DEFAULT public.current_org_id();
ALTER TABLE public.custom_statuses ALTER COLUMN org_id SET DEFAULT public.current_org_id();
ALTER TABLE public.filter_presets  ALTER COLUMN org_id SET DEFAULT public.current_org_id();
ALTER TABLE public.chat_channels   ALTER COLUMN org_id SET DEFAULT public.current_org_id();
ALTER TABLE public.calendar_events ALTER COLUMN org_id SET DEFAULT public.current_org_id();