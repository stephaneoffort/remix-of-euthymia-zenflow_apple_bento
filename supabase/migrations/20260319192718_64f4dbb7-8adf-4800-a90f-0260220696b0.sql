
-- Drop and recreate FK on comments.author_id with CASCADE
ALTER TABLE public.comments DROP CONSTRAINT IF EXISTS comments_author_id_fkey;
ALTER TABLE public.comments ADD CONSTRAINT comments_author_id_fkey FOREIGN KEY (author_id) REFERENCES public.team_members(id) ON DELETE CASCADE;

-- Drop and recreate FK on task_assignees.member_id with CASCADE
ALTER TABLE public.task_assignees DROP CONSTRAINT IF EXISTS task_assignees_member_id_fkey;
ALTER TABLE public.task_assignees ADD CONSTRAINT task_assignees_member_id_fkey FOREIGN KEY (member_id) REFERENCES public.team_members(id) ON DELETE CASCADE;

-- Drop and recreate FK on profiles.team_member_id with CASCADE
ALTER TABLE public.profiles DROP CONSTRAINT IF EXISTS profiles_team_member_id_fkey;
ALTER TABLE public.profiles ADD CONSTRAINT profiles_team_member_id_fkey FOREIGN KEY (team_member_id) REFERENCES public.team_members(id) ON DELETE SET NULL;
