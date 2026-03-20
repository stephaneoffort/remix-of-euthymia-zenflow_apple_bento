
ALTER TABLE public.spaces ADD COLUMN owner_member_id text DEFAULT NULL;

-- Update can_access_space function: private spaces visible only to owner
CREATE OR REPLACE FUNCTION public.can_access_space(_member_id text, _space_id text)
RETURNS boolean
LANGUAGE sql
STABLE SECURITY DEFINER
SET search_path = 'public'
AS $$
  SELECT 
    NOT (SELECT is_private FROM public.spaces WHERE id = _space_id)
    OR (SELECT owner_member_id FROM public.spaces WHERE id = _space_id) = _member_id
$$;
