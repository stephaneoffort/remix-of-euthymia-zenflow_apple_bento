
-- Allow deleting spaces
CREATE POLICY "Spaces can be deleted by everyone" ON public.spaces FOR DELETE TO public USING (true);

-- Allow deleting projects
CREATE POLICY "Projects can be deleted by everyone" ON public.projects FOR DELETE TO public USING (true);

-- Allow deleting task_lists
CREATE POLICY "Task lists can be deleted by everyone" ON public.task_lists FOR DELETE TO public USING (true);

-- Allow updating task_lists
CREATE POLICY "Task lists can be updated by everyone" ON public.task_lists FOR UPDATE TO public USING (true);
