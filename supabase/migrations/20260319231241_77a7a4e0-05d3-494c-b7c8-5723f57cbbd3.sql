ALTER TABLE public.tasks 
  ALTER COLUMN due_date TYPE timestamptz USING due_date::timestamptz,
  ALTER COLUMN start_date TYPE timestamptz USING start_date::timestamptz;