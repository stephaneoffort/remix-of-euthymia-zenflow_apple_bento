CREATE POLICY "team_members_insert_self_onboarding"
ON public.team_members
FOR INSERT
TO authenticated
WITH CHECK (
  NOT public.is_team_linked(auth.uid())
  AND lower(email) = lower(COALESCE(auth.jwt() ->> 'email', ''))
);