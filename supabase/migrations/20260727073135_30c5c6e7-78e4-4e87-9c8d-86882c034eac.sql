-- Valeur par défaut : l'équipe active du membre (le trigger écrase ensuite selon la parenté)
ALTER TABLE public.projects   ALTER COLUMN org_id SET DEFAULT public.current_org_id();
ALTER TABLE public.task_lists ALTER COLUMN org_id SET DEFAULT public.current_org_id();
ALTER TABLE public.tasks      ALTER COLUMN org_id SET DEFAULT public.current_org_id();