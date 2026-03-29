import { useState, useEffect } from "react";
import { supabase } from "@/integrations/supabase/client";

const ZOOM_API = `https://${import.meta.env.VITE_SUPABASE_PROJECT_ID}.supabase.co/functions/v1/zoom-api`;
const ZOOM_OAUTH = `https://${import.meta.env.VITE_SUPABASE_PROJECT_ID}.supabase.co/functions/v1/zoom-oauth`;

export interface ZoomMeeting {
  id: string;
  zoom_meeting_id: number;
  topic: string;
  start_time: string | null;
  duration: number;
  join_url: string;
  start_url: string;
  password: string | null;
  status: string;
  entity_type: string;
  entity_id: string;
  created_at: string;
}

export function useZoom() {
  const [isConnected, setIsConnected] = useState(false);
  const [connectionInfo, setConnectionInfo] = useState<{ email?: string; display_name?: string } | null>(null);

  useEffect(() => {
    checkConnection();
    if (window.location.search.includes("zoom_connected=true")) {
      setIsConnected(true);
      window.history.replaceState({}, "", window.location.pathname);
    }
  }, []);

  const checkConnection = async () => {
    const { data } = await supabase
      .from("zoom_connections" as any)
      .select("id, email, display_name")
      .limit(1);
    const rows = data as any[] | null;
    setIsConnected((rows?.length ?? 0) > 0);
    if (rows && rows.length > 0) {
      setConnectionInfo({ email: rows[0].email, display_name: rows[0].display_name });
    }
  };

  const connect = async () => {
    const { data: { session } } = await supabase.auth.getSession();
    if (!session?.access_token) return;
    window.location.href = `${ZOOM_OAUTH}/authorize?token=${session.access_token}`;
  };

  const disconnect = async () => {
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) return;
    await supabase.from("zoom_connections" as any).delete().eq("user_id", user.id);
    setIsConnected(false);
    setConnectionInfo(null);
  };

  const call = async (body: object) => {
    const { data: { session } } = await supabase.auth.getSession();
    if (!session?.access_token) throw new Error("Not authenticated");

    console.log("Zoom API call:", JSON.stringify(body));

    const res = await fetch(ZOOM_API, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${session.access_token}`,
      },
      body: JSON.stringify(body),
    });

    if (res.status === 401) throw new Error("Session expirée");
    
    const data = await res.json();
    console.log("Zoom API response:", data);

    if (data.error) {
      console.error("Zoom API error:", data.error);
      throw new Error(data.error);
    }

    return data;
  };

  const createMeeting = (
    topic: string,
    entityType: string,
    entityId: string,
    startTime?: string,
    duration?: number,
    password?: string
  ) =>
    call({
      action: "create_meeting",
      topic,
      entity_type: entityType,
      entity_id: entityId,
      start_time: startTime,
      duration,
      password,
    });

  const listMeetings = (entityType: string, entityId: string) =>
    call({ action: "list_meetings", entity_type: entityType, entity_id: entityId });

  const deleteMeeting = (meetingId: string, zoomMeetingId: number) =>
    call({ action: "delete_meeting", meeting_id: meetingId, zoom_meeting_id: zoomMeetingId });

  return {
    isConnected,
    connectionInfo,
    connect,
    disconnect,
    createMeeting,
    listMeetings,
    deleteMeeting,
  };
}
