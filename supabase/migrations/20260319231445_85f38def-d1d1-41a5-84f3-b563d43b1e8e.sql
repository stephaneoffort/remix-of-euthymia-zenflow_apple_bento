-- Create storage bucket for task attachments
INSERT INTO storage.buckets (id, name, public) VALUES ('task-attachments', 'task-attachments', true);

-- Allow anyone to upload to task-attachments
CREATE POLICY "Anyone can upload task attachments"
ON storage.objects FOR INSERT
TO public
WITH CHECK (bucket_id = 'task-attachments');

-- Allow anyone to read task attachments
CREATE POLICY "Anyone can read task attachments"
ON storage.objects FOR SELECT
TO public
USING (bucket_id = 'task-attachments');

-- Allow anyone to delete task attachments
CREATE POLICY "Anyone can delete task attachments"
ON storage.objects FOR DELETE
TO public
USING (bucket_id = 'task-attachments');