import { useState, useEffect, useMemo } from 'react';
import { supabase } from '@/integrations/supabase/client';

interface TaskMeetingsData {
  zoomTaskIds: Set<string>;
  meetTaskIds: Set<string>;
  loading: boolean;
}

export function useTaskMeetings(): TaskMeetingsData {
  const [zoomTaskIds, setZoomTaskIds] = useState<Set<string>>(new Set());
  const [meetTaskIds, setMeetTaskIds] = useState<Set<string>>(new Set());
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const fetchData = async () => {
      const [zoomRes, meetRes] = await Promise.all([
        supabase
          .from('zoom_meetings')
          .select('entity_id')
          .eq('entity_type', 'task'),
        supabase
          .from('calendar_events')
          .select('external_id')
          .eq('has_meet', true)
          .not('external_id', 'is', null),
      ]);

      if (zoomRes.data) {
        setZoomTaskIds(new Set(zoomRes.data.map((r: any) => r.entity_id)));
      }
      if (meetRes.data) {
        setMeetTaskIds(new Set(meetRes.data.map((r: any) => r.external_id)));
      }
      setLoading(false);
    };

    fetchData();
  }, []);

  return useMemo(() => ({ zoomTaskIds, meetTaskIds, loading }), [zoomTaskIds, meetTaskIds, loading]);
}

export function useHasZoom(taskId: string, zoomTaskIds: Set<string>): boolean {
  return zoomTaskIds.has(taskId);
}

export function useHasMeet(googleEventId: string | null | undefined, meetTaskIds: Set<string>): boolean {
  return !!googleEventId && meetTaskIds.has(googleEventId);
}
