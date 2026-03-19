
-- Create role enum and user_roles table
CREATE TYPE public.app_role AS ENUM ('admin', 'moderator', 'user');

CREATE TABLE public.user_roles (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid REFERENCES auth.users(id) ON DELETE CASCADE NOT NULL,
  role app_role NOT NULL,
  UNIQUE (user_id, role)
);

ALTER TABLE public.user_roles ENABLE ROW LEVEL SECURITY;

-- Security definer function to check roles (avoids RLS recursion)
CREATE OR REPLACE FUNCTION public.has_role(_user_id uuid, _role app_role)
RETURNS boolean
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT EXISTS (
    SELECT 1 FROM public.user_roles
    WHERE user_id = _user_id AND role = _role
  )
$$;

-- RLS: only admins can manage roles, authenticated can read
CREATE POLICY "Roles viewable by authenticated"
  ON public.user_roles FOR SELECT TO authenticated
  USING (true);

CREATE POLICY "Admins can insert roles"
  ON public.user_roles FOR INSERT TO authenticated
  WITH CHECK (public.has_role(auth.uid(), 'admin'));

CREATE POLICY "Admins can delete roles"
  ON public.user_roles FOR DELETE TO authenticated
  USING (public.has_role(auth.uid(), 'admin'));

-- Custom task statuses table
CREATE TABLE public.custom_statuses (
  id text PRIMARY KEY DEFAULT ('cs_' || gen_random_uuid()::text),
  label text NOT NULL,
  sort_order integer NOT NULL DEFAULT 0
);

ALTER TABLE public.custom_statuses ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Custom statuses viewable by everyone"
  ON public.custom_statuses FOR SELECT TO public
  USING (true);

CREATE POLICY "Admins can insert custom statuses"
  ON public.custom_statuses FOR INSERT TO authenticated
  WITH CHECK (public.has_role(auth.uid(), 'admin'));

CREATE POLICY "Admins can update custom statuses"
  ON public.custom_statuses FOR UPDATE TO authenticated
  USING (public.has_role(auth.uid(), 'admin'));

CREATE POLICY "Admins can delete custom statuses"
  ON public.custom_statuses FOR DELETE TO authenticated
  USING (public.has_role(auth.uid(), 'admin'));

-- Allow admins to delete team members
CREATE POLICY "Admins can delete team members"
  ON public.team_members FOR DELETE TO authenticated
  USING (public.has_role(auth.uid(), 'admin'));

-- Assign admin role to stephane.offort@gmail.com
INSERT INTO public.user_roles (user_id, role)
VALUES ('7297fb8a-7439-45cc-91bd-a868db1bafe9', 'admin');
