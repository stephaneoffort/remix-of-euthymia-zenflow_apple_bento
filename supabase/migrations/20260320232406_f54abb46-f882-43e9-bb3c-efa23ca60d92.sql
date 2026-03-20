-- Restrict space deletion to admins only
DROP POLICY IF EXISTS "Spaces can be deleted by everyone" ON public.spaces;
CREATE POLICY "Only admins can delete spaces"
  ON public.spaces
  FOR DELETE
  TO authenticated
  USING (public.has_role(auth.uid(), 'admin'));

-- Restrict project deletion to admins only
DROP POLICY IF EXISTS "Projects can be deleted by everyone" ON public.projects;
CREATE POLICY "Only admins can delete projects"
  ON public.projects
  FOR DELETE
  TO authenticated
  USING (public.has_role(auth.uid(), 'admin'));