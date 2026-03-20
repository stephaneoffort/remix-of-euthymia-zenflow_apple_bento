
-- Add is_private column to spaces
ALTER TABLE public.spaces ADD COLUMN is_private boolean NOT NULL DEFAULT false;

-- Table for space members (who can access a private space)
CREATE TABLE public.space_members (
  space_id text NOT NULL REFERENCES public.spaces(id) ON DELETE CASCADE,
  member_id text NOT NULL REFERENCES public.team_members(id) ON DELETE CASCADE,
  PRIMARY KEY (space_id, member_id)
);

-- Table for space managers (responsible people with full management rights)
CREATE TABLE public.space_managers (
  space_id text NOT NULL REFERENCES public.spaces(id) ON DELETE CASCADE,
  member_id text NOT NULL REFERENCES public.team_members(id) ON DELETE CASCADE,
  PRIMARY KEY (space_id, member_id)
);

-- Enable RLS
ALTER TABLE public.space_members ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.space_managers ENABLE ROW LEVEL SECURITY;

-- RLS for space_members
CREATE POLICY "Space members viewable by authenticated" ON public.space_members FOR SELECT TO authenticated USING (true);
CREATE POLICY "Space members insertable by authenticated" ON public.space_members FOR INSERT TO authenticated WITH CHECK (true);
CREATE POLICY "Space members deletable by authenticated" ON public.space_members FOR DELETE TO authenticated USING (true);

-- RLS for space_managers
CREATE POLICY "Space managers viewable by authenticated" ON public.space_managers FOR SELECT TO authenticated USING (true);
CREATE POLICY "Space managers insertable by authenticated" ON public.space_managers FOR INSERT TO authenticated WITH CHECK (true);
CREATE POLICY "Space managers deletable by authenticated" ON public.space_managers FOR DELETE TO authenticated USING (true);

-- Security definer function to check if a member can access a space
CREATE OR REPLACE FUNCTION public.can_access_space(_member_id text, _space_id text)
RETURNS boolean
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT 
    NOT (SELECT is_private FROM public.spaces WHERE id = _space_id)
    OR EXISTS (SELECT 1 FROM public.space_members WHERE space_id = _space_id AND member_id = _member_id)
    OR EXISTS (SELECT 1 FROM public.space_managers WHERE space_id = _space_id AND member_id = _member_id)
$$;

-- Security definer function to check if a member is a space manager
CREATE OR REPLACE FUNCTION public.is_space_manager(_member_id text, _space_id text)
RETURNS boolean
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT EXISTS (
    SELECT 1 FROM public.space_managers WHERE space_id = _space_id AND member_id = _member_id
  )
$$;
