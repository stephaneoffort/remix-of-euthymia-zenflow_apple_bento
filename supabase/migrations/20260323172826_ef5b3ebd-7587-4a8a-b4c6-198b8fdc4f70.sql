CREATE TABLE public.push_subscriptions (
  id text PRIMARY KEY DEFAULT ('ps_' || gen_random_uuid()::text),
  member_id text NOT NULL,
  endpoint text NOT NULL,
  p256dh text NOT NULL,
  auth text NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (member_id, endpoint)
);

ALTER TABLE public.push_subscriptions ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Push subs viewable by everyone" ON public.push_subscriptions FOR SELECT TO public USING (true);
CREATE POLICY "Push subs insertable by everyone" ON public.push_subscriptions FOR INSERT TO public WITH CHECK (true);
CREATE POLICY "Push subs deletable by everyone" ON public.push_subscriptions FOR DELETE TO public USING (true);

-- Add triggered_at to track which reminders already fired
ALTER TABLE public.task_reminders ADD COLUMN IF NOT EXISTS triggered_at timestamptz DEFAULT NULL;