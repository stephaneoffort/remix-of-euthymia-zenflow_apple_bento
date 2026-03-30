
-- Add mentioned_member_ids to existing comments table
ALTER TABLE comments ADD COLUMN IF NOT EXISTS mentioned_member_ids TEXT[] DEFAULT '{}';
CREATE INDEX IF NOT EXISTS idx_comments_mentioned ON comments USING GIN(mentioned_member_ids);

-- Add is_read tracking for comment mentions
CREATE TABLE IF NOT EXISTS comment_reads (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  member_id TEXT NOT NULL,
  comment_id TEXT NOT NULL REFERENCES comments(id) ON DELETE CASCADE,
  read_at TIMESTAMPTZ DEFAULT NOW(),
  UNIQUE(member_id, comment_id)
);

ALTER TABLE comment_reads ENABLE ROW LEVEL SECURITY;

CREATE POLICY "comment_reads_select" ON comment_reads
  FOR SELECT TO authenticated USING (true);

CREATE POLICY "comment_reads_insert" ON comment_reads
  FOR INSERT TO authenticated WITH CHECK (true);

CREATE POLICY "comment_reads_delete" ON comment_reads
  FOR DELETE TO authenticated USING (true);

-- Enable realtime for comments
ALTER PUBLICATION supabase_realtime ADD TABLE public.comments;
