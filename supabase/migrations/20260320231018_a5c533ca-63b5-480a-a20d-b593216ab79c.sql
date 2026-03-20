
-- Add recurrence end date column
ALTER TABLE public.tasks ADD COLUMN recurrence_end_date timestamp with time zone DEFAULT NULL;

-- Update the trigger function to check end date
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

    -- Check if next due date exceeds recurrence end date
    IF NEW.recurrence_end_date IS NOT NULL AND next_due IS NOT NULL AND next_due > NEW.recurrence_end_date THEN
      RETURN NEW;
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
    INSERT INTO public.tasks (title, description, status, priority, due_date, start_date, parent_task_id, list_id, tags, time_estimate, recurrence, recurrence_end_date, sort_order)
    VALUES (NEW.title, NEW.description, 'todo', NEW.priority, next_due, next_start, NEW.parent_task_id, NEW.list_id, NEW.tags, NEW.time_estimate, NEW.recurrence, NEW.recurrence_end_date, NEW.sort_order)
    RETURNING id INTO new_task_id;

    -- Copy assignees
    INSERT INTO public.task_assignees (task_id, member_id)
    SELECT new_task_id, member_id FROM public.task_assignees WHERE task_id = NEW.id;
  END IF;

  RETURN NEW;
END;
$$;
