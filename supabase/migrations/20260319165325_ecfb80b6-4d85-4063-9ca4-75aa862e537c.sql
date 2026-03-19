
-- Create team_members table
CREATE TABLE public.team_members (
  id TEXT PRIMARY KEY,
  name TEXT NOT NULL,
  role TEXT NOT NULL,
  avatar_color TEXT NOT NULL,
  email TEXT NOT NULL
);
ALTER TABLE public.team_members ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Team members are viewable by everyone" ON public.team_members FOR SELECT USING (true);
CREATE POLICY "Team members can be inserted by everyone" ON public.team_members FOR INSERT WITH CHECK (true);
CREATE POLICY "Team members can be updated by everyone" ON public.team_members FOR UPDATE USING (true);

-- Create spaces table
CREATE TABLE public.spaces (
  id TEXT PRIMARY KEY,
  name TEXT NOT NULL,
  icon TEXT NOT NULL,
  sort_order INT NOT NULL DEFAULT 0
);
ALTER TABLE public.spaces ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Spaces are viewable by everyone" ON public.spaces FOR SELECT USING (true);
CREATE POLICY "Spaces can be inserted by everyone" ON public.spaces FOR INSERT WITH CHECK (true);

-- Create projects table
CREATE TABLE public.projects (
  id TEXT PRIMARY KEY,
  name TEXT NOT NULL,
  space_id TEXT NOT NULL REFERENCES public.spaces(id) ON DELETE CASCADE,
  color TEXT NOT NULL,
  sort_order INT NOT NULL DEFAULT 0
);
ALTER TABLE public.projects ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Projects are viewable by everyone" ON public.projects FOR SELECT USING (true);
CREATE POLICY "Projects can be inserted by everyone" ON public.projects FOR INSERT WITH CHECK (true);
CREATE POLICY "Projects can be updated by everyone" ON public.projects FOR UPDATE USING (true);

-- Create task_lists table
CREATE TABLE public.task_lists (
  id TEXT PRIMARY KEY,
  name TEXT NOT NULL,
  project_id TEXT NOT NULL REFERENCES public.projects(id) ON DELETE CASCADE,
  sort_order INT NOT NULL DEFAULT 0
);
ALTER TABLE public.task_lists ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Task lists are viewable by everyone" ON public.task_lists FOR SELECT USING (true);
CREATE POLICY "Task lists can be inserted by everyone" ON public.task_lists FOR INSERT WITH CHECK (true);

-- Create tasks table
CREATE TABLE public.tasks (
  id TEXT PRIMARY KEY DEFAULT 't_' || gen_random_uuid()::text,
  title TEXT NOT NULL,
  description TEXT NOT NULL DEFAULT '',
  status TEXT NOT NULL DEFAULT 'todo',
  priority TEXT NOT NULL DEFAULT 'normal',
  due_date DATE,
  start_date DATE,
  parent_task_id TEXT REFERENCES public.tasks(id) ON DELETE CASCADE,
  list_id TEXT NOT NULL REFERENCES public.task_lists(id) ON DELETE CASCADE,
  tags TEXT[] NOT NULL DEFAULT '{}',
  time_estimate INT,
  time_logged INT,
  ai_summary TEXT,
  sort_order INT NOT NULL DEFAULT 0,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
ALTER TABLE public.tasks ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Tasks are viewable by everyone" ON public.tasks FOR SELECT USING (true);
CREATE POLICY "Tasks can be inserted by everyone" ON public.tasks FOR INSERT WITH CHECK (true);
CREATE POLICY "Tasks can be updated by everyone" ON public.tasks FOR UPDATE USING (true);
CREATE POLICY "Tasks can be deleted by everyone" ON public.tasks FOR DELETE USING (true);

-- Create task_assignees junction table
CREATE TABLE public.task_assignees (
  task_id TEXT NOT NULL REFERENCES public.tasks(id) ON DELETE CASCADE,
  member_id TEXT NOT NULL REFERENCES public.team_members(id) ON DELETE CASCADE,
  PRIMARY KEY (task_id, member_id)
);
ALTER TABLE public.task_assignees ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Task assignees are viewable by everyone" ON public.task_assignees FOR SELECT USING (true);
CREATE POLICY "Task assignees can be inserted by everyone" ON public.task_assignees FOR INSERT WITH CHECK (true);
CREATE POLICY "Task assignees can be deleted by everyone" ON public.task_assignees FOR DELETE USING (true);

-- Create comments table
CREATE TABLE public.comments (
  id TEXT PRIMARY KEY DEFAULT 'c_' || gen_random_uuid()::text,
  task_id TEXT NOT NULL REFERENCES public.tasks(id) ON DELETE CASCADE,
  author_id TEXT NOT NULL REFERENCES public.team_members(id),
  content TEXT NOT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
ALTER TABLE public.comments ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Comments are viewable by everyone" ON public.comments FOR SELECT USING (true);
CREATE POLICY "Comments can be inserted by everyone" ON public.comments FOR INSERT WITH CHECK (true);

-- Create attachments table
CREATE TABLE public.attachments (
  id TEXT PRIMARY KEY DEFAULT 'a_' || gen_random_uuid()::text,
  task_id TEXT NOT NULL REFERENCES public.tasks(id) ON DELETE CASCADE,
  name TEXT NOT NULL,
  url TEXT NOT NULL
);
ALTER TABLE public.attachments ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Attachments are viewable by everyone" ON public.attachments FOR SELECT USING (true);
CREATE POLICY "Attachments can be inserted by everyone" ON public.attachments FOR INSERT WITH CHECK (true);

-- Create updated_at trigger function
CREATE OR REPLACE FUNCTION public.update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql SET search_path = public;

CREATE TRIGGER update_tasks_updated_at
  BEFORE UPDATE ON public.tasks
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

-- Create indexes
CREATE INDEX idx_tasks_list_id ON public.tasks(list_id);
CREATE INDEX idx_tasks_parent_task_id ON public.tasks(parent_task_id);
CREATE INDEX idx_tasks_status ON public.tasks(status);
CREATE INDEX idx_task_lists_project_id ON public.task_lists(project_id);
CREATE INDEX idx_projects_space_id ON public.projects(space_id);
CREATE INDEX idx_comments_task_id ON public.comments(task_id);
CREATE INDEX idx_task_assignees_task_id ON public.task_assignees(task_id);
