CREATE TABLE public.member_invitations (
  id uuid NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  org_id uuid NOT NULL REFERENCES public.organizations(id) ON DELETE CASCADE,
  email text NOT NULL,
  name text NOT NULL,
  job_role text NOT NULL DEFAULT '',
  member_id text,
  auth_user_id uuid,
  invite_link text,
  link_type text NOT NULL DEFAULT 'invite',
  status text NOT NULL DEFAULT 'pending',
  invited_by uuid,
  expires_at timestamp with time zone NOT NULL DEFAULT (now() + interval '1 hour'),
  accepted_at timestamp with time zone,
  revoked_at timestamp with time zone,
  created_at timestamp with time zone NOT NULL DEFAULT now(),
  updated_at timestamp with time zone NOT NULL DEFAULT now()
);

CREATE INDEX idx_member_invitations_org ON public.member_invitations(org_id, status);

GRANT SELECT, UPDATE, DELETE ON public.member_invitations TO authenticated;
GRANT ALL ON public.member_invitations TO service_role;

ALTER TABLE public.member_invitations ENABLE ROW LEVEL SECURITY;

CREATE POLICY "org admins read invitations"
  ON public.member_invitations FOR SELECT TO authenticated
  USING (public.is_org_admin(org_id));

CREATE POLICY "org admins update invitations"
  ON public.member_invitations FOR UPDATE TO authenticated
  USING (public.is_org_admin(org_id))
  WITH CHECK (public.is_org_admin(org_id));

CREATE POLICY "org admins delete invitations"
  ON public.member_invitations FOR DELETE TO authenticated
  USING (public.is_org_admin(org_id));

CREATE TRIGGER update_member_invitations_updated_at
  BEFORE UPDATE ON public.member_invitations
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();