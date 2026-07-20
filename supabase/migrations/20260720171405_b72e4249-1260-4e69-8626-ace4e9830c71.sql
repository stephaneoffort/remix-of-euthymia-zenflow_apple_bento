
-- 1. Table
CREATE TABLE public.audit_logs (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id UUID REFERENCES auth.users(id) ON DELETE SET NULL,
  action TEXT NOT NULL,
  entity_type TEXT NOT NULL,
  entity_id TEXT,
  metadata JSONB NOT NULL DEFAULT '{}'::jsonb,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX idx_audit_logs_user_id ON public.audit_logs(user_id);
CREATE INDEX idx_audit_logs_entity ON public.audit_logs(entity_type, entity_id);
CREATE INDEX idx_audit_logs_created_at ON public.audit_logs(created_at DESC);

-- 2. GRANTS
GRANT SELECT, INSERT ON public.audit_logs TO authenticated;
GRANT ALL ON public.audit_logs TO service_role;

-- 3. RLS
ALTER TABLE public.audit_logs ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can view their own audit logs"
  ON public.audit_logs FOR SELECT
  TO authenticated
  USING (auth.uid() = user_id OR public.has_role(auth.uid(), 'admin'));

CREATE POLICY "Authenticated can insert their own audit logs"
  ON public.audit_logs FOR INSERT
  TO authenticated
  WITH CHECK (auth.uid() = user_id);

-- 4. Trigger function for tasks
CREATE OR REPLACE FUNCTION public.log_task_audit()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_user UUID := auth.uid();
  v_action TEXT;
  v_entity_id TEXT;
  v_metadata JSONB := '{}'::jsonb;
  v_changes JSONB := '{}'::jsonb;
BEGIN
  IF TG_OP = 'INSERT' THEN
    v_action := 'task.created';
    v_entity_id := NEW.id;
    v_metadata := jsonb_build_object('title', NEW.title, 'status', NEW.status);
  ELSIF TG_OP = 'UPDATE' THEN
    v_action := 'task.updated';
    v_entity_id := NEW.id;
    IF NEW.status IS DISTINCT FROM OLD.status THEN
      v_changes := v_changes || jsonb_build_object('status', jsonb_build_array(OLD.status, NEW.status));
    END IF;
    IF NEW.title IS DISTINCT FROM OLD.title THEN
      v_changes := v_changes || jsonb_build_object('title', jsonb_build_array(OLD.title, NEW.title));
    END IF;
    IF NEW.priority IS DISTINCT FROM OLD.priority THEN
      v_changes := v_changes || jsonb_build_object('priority', jsonb_build_array(OLD.priority, NEW.priority));
    END IF;
    IF NEW.due_date IS DISTINCT FROM OLD.due_date THEN
      v_changes := v_changes || jsonb_build_object('due_date', jsonb_build_array(OLD.due_date, NEW.due_date));
    END IF;
    IF v_changes = '{}'::jsonb THEN
      RETURN NEW;
    END IF;
    v_metadata := jsonb_build_object('title', NEW.title, 'changes', v_changes);
  ELSIF TG_OP = 'DELETE' THEN
    v_action := 'task.deleted';
    v_entity_id := OLD.id;
    v_metadata := jsonb_build_object('title', OLD.title, 'status', OLD.status);
  END IF;

  IF v_user IS NOT NULL THEN
    INSERT INTO public.audit_logs (user_id, action, entity_type, entity_id, metadata)
    VALUES (v_user, v_action, 'task', v_entity_id, v_metadata);
  END IF;

  IF TG_OP = 'DELETE' THEN RETURN OLD; END IF;
  RETURN NEW;
END;
$$;

CREATE TRIGGER trg_audit_tasks_ins AFTER INSERT ON public.tasks
  FOR EACH ROW EXECUTE FUNCTION public.log_task_audit();
CREATE TRIGGER trg_audit_tasks_upd AFTER UPDATE ON public.tasks
  FOR EACH ROW EXECUTE FUNCTION public.log_task_audit();
CREATE TRIGGER trg_audit_tasks_del AFTER DELETE ON public.tasks
  FOR EACH ROW EXECUTE FUNCTION public.log_task_audit();

-- 5. Trigger for task_shares
CREATE OR REPLACE FUNCTION public.log_task_share_audit()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_user UUID := auth.uid();
BEGIN
  IF v_user IS NOT NULL THEN
    INSERT INTO public.audit_logs (user_id, action, entity_type, entity_id, metadata)
    VALUES (
      v_user,
      'task.shared',
      'task',
      NEW.task_id,
      jsonb_build_object('share_id', NEW.id)
    );
  END IF;
  RETURN NEW;
END;
$$;

CREATE TRIGGER trg_audit_task_shares_ins AFTER INSERT ON public.task_shares
  FOR EACH ROW EXECUTE FUNCTION public.log_task_share_audit();
