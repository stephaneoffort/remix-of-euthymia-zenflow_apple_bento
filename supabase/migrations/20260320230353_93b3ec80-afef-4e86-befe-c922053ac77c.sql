
-- Add recurrence column to tasks
ALTER TABLE public.tasks ADD COLUMN recurrence text DEFAULT NULL;

-- Create function to auto-create next recurring task
CREATE OR REPLACE FUNCTION public.handle_recurring_task()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $$
DECLARE
  next_due timestamp with time zone;
  next_start timestamp with time zone;
  new_task_id text;
BEGIN
  -- Only fire when status changes to 'done' and task has recurrence
  IF NEW.status = 'done' AND OLD.status IS DISTINCT FROM 'done' AND NEW.recurrence IS NOT NULL THEN
    -- Calculate next due date
    IF NEW.due_date IS NOT NULL THEN
      CASE NEW.recurrence
        WHEN 'daily' THEN next_due := NEW.due_date + interval '1 day';
        WHEN 'weekly' THEN next_due := NEW.due_date + interval '1 week';
        WHEN 'monthly' THEN next_due := NEW.due_date + interval '1 month';
        ELSE next_due := NULL;
      END CASE;
    ELSE
      next_due := NULL;
    END IF;

    -- Calculate next start date
    IF NEW.start_date IS NOT NULL THEN
      CASE NEW.recurrence
        WHEN 'daily' THEN next_start := NEW.start_date + interval '1 day';
        WHEN 'weekly' THEN next_start := NEW.start_date + interval '1 week';
        WHEN 'monthly' THEN next_start := NEW.start_date + interval '1 month';
        ELSE next_start := NULL;
      END CASE;
    ELSE
      next_start := NULL;
    END IF;

    -- Create next occurrence
    INSERT INTO public.tasks (title, description, status, priority, due_date, start_date, parent_task_id, list_id, tags, time_estimate, recurrence, sort_order)
    VALUES (NEW.title, NEW.description, 'todo', NEW.priority, next_due, next_start, NEW.parent_task_id, NEW.list_id, NEW.tags, NEW.time_estimate, NEW.recurrence, NEW.sort_order)
    RETURNING id INTO new_task_id;

    -- Copy assignees
    INSERT INTO public.task_assignees (task_id, member_id)
    SELECT new_task_id, member_id FROM public.task_assignees WHERE task_id = NEW.id;
  END IF;

  RETURN NEW;
END;
$$;

-- Create trigger
CREATE TRIGGER on_task_done_recurrence
  AFTER UPDATE ON public.tasks
  FOR EACH ROW
  EXECUTE FUNCTION public.handle_recurring_task();
