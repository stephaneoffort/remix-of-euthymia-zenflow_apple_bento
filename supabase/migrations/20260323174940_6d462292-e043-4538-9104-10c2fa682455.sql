ALTER TABLE public.push_subscriptions ADD CONSTRAINT push_subscriptions_member_endpoint_unique UNIQUE (member_id, endpoint);

CREATE POLICY "Push subs updatable by everyone" ON public.push_subscriptions FOR UPDATE USING (true);