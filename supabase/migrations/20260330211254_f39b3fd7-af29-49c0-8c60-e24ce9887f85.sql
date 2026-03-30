
-- Add Gantt-specific columns to tasks
ALTER TABLE tasks
  ADD COLUMN IF NOT EXISTS duration_days INTEGER,
  ADD COLUMN IF NOT EXISTS progress INTEGER DEFAULT 0,
  ADD COLUMN IF NOT EXISTS is_milestone BOOLEAN DEFAULT FALSE,
  ADD COLUMN IF NOT EXISTS color TEXT,
  ADD COLUMN IF NOT EXISTS wbs TEXT;

-- Create task dependencies table
CREATE TABLE IF NOT EXISTS task_dependencies (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  task_id TEXT NOT NULL REFERENCES tasks(id) ON DELETE CASCADE,
  depends_on_id TEXT NOT NULL REFERENCES tasks(id) ON DELETE CASCADE,
  type TEXT DEFAULT 'FS',
  lag_days INTEGER DEFAULT 0,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  UNIQUE(task_id, depends_on_id)
);

-- RLS
ALTER TABLE task_dependencies ENABLE ROW LEVEL SECURITY;

-- Public policies (consistent with tasks table which is public)
CREATE POLICY "task_dependencies_select" ON task_dependencies FOR SELECT USING (true);
CREATE POLICY "task_dependencies_insert" ON task_dependencies FOR INSERT WITH CHECK (true);
CREATE POLICY "task_dependencies_update" ON task_dependencies FOR UPDATE USING (true);
CREATE POLICY "task_dependencies_delete" ON task_dependencies FOR DELETE USING (true);

-- Indexes
CREATE INDEX IF NOT EXISTS idx_dependencies_task ON task_dependencies(task_id);
CREATE INDEX IF NOT EXISTS idx_dependencies_depends ON task_dependencies(depends_on_id);
CREATE INDEX IF NOT EXISTS idx_tasks_dates ON tasks(start_date, due_date);
