ALTER TABLE tasks ADD COLUMN IF NOT EXISTS google_event_id TEXT;
ALTER TABLE calendar_accounts ADD COLUMN IF NOT EXISTS zenflow_calendar_id TEXT;