
CREATE TABLE public.project_members (
  project_id text NOT NULL,
  member_id text NOT NULL,
  PRIMARY KEY (project_id, member_id),
  CONSTRAINT project_members_project_id_fkey FOREIGN KEY (project_id) REFERENCES public.projects(id) ON DELETE CASCADE,
  CONSTRAINT project_members_member_id_fkey FOREIGN KEY (member_id) REFERENCES public.team_members(id) ON DELETE CASCADE
);

ALTER TABLE public.project_members ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Project members viewable by everyone" ON public.project_members FOR SELECT TO public USING (true);
CREATE POLICY "Project members insertable by everyone" ON public.project_members FOR INSERT TO public WITH CHECK (true);
CREATE POLICY "Project members deletable by everyone" ON public.project_members FOR DELETE TO public USING (true);
