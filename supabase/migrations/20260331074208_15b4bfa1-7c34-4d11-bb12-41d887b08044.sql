
-- Insert missing profiles for Julien Cazabonne and Stephane Faure
INSERT INTO public.profiles (id, team_member_id)
VALUES 
  ('9f14baef-74b6-4ab4-874b-3c7856c0a5d8', 'tm_1773995582572'),
  ('194c5922-b3b1-47ef-8112-b12a4e3601b5', 'tm_1774014524909')
ON CONFLICT (id) DO UPDATE SET team_member_id = EXCLUDED.team_member_id;

-- Remove the duplicate profile for Stephane Offort (keep the original one matching his auth id)
DELETE FROM public.profiles WHERE id = '4c217005-a0ea-416f-965e-26365fba8014';
