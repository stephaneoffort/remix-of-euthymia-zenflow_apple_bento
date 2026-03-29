import { useState, useEffect, useCallback } from "react";
import { supabase } from "@/integrations/supabase/client";

const DRIVE_API_URL = `https://${import.meta.env.VITE_SUPABASE_PROJECT_ID}.supabase.co/functions/v1/google-drive-api`;
const DRIVE_OAUTH_URL = `https://${import.meta.env.VITE_SUPABASE_PROJECT_ID}.supabase.co/functions/v1/google-drive-oauth/authorize`;

export interface DriveFile {
  id: string;
  name: string;
  mimeType: string;
  size?: string;
  thumbnailLink?: string;
  webViewLink?: string;
  modifiedTime?: string;
}

export interface DriveAttachment {
  id: string;
  user_id: string;
  entity_type: string;
  entity_id: string;
  file_id: string;
  file_name: string;
  file_url: string;
  mime_type: string | null;
  thumbnail_url: string | null;
  file_size: number | null;
  created_at: string;
}

export function useGoogleDrive() {
  const [isConnected, setIsConnected] = useState(false);
  const [connectionEmail, setConnectionEmail] = useState<string | null>(null);
  const [isLoading, setIsLoading] = useState(false);

  const getUserId = async (): Promise<string | null> => {
    const { data: { user } } = await supabase.auth.getUser();
    return user?.id ?? null;
  };

  const checkConnection = useCallback(async () => {
    const userId = await getUserId();
    if (!userId) return;
    const { data } = await supabase
      .from("drive_connections" as any)
      .select("id, email")
      .eq("user_id", userId)
      .limit(1);
    const connections = data as any[] | null;
    setIsConnected((connections?.length ?? 0) > 0);
    setConnectionEmail(connections?.[0]?.email ?? null);
  }, []);

  useEffect(() => {
    checkConnection();
    if (window.location.search.includes("drive_connected=true")) {
      setIsConnected(true);
      checkConnection();
      window.history.replaceState({}, "", window.location.pathname);
    }
  }, [checkConnection]);

  const connect = async () => {
    const userId = await getUserId();
    window.location.href = `${DRIVE_OAUTH_URL}?user_id=${userId || ""}`;
  };

  const disconnect = async () => {
    const userId = await getUserId();
    if (!userId) return;
    await supabase.from("drive_connections" as any).delete().eq("user_id", userId);
    setIsConnected(false);
    setConnectionEmail(null);
  };

  const callAPI = async (body: object) => {
    const { data: { session } } = await supabase.auth.getSession();
    if (!session?.access_token) {
      throw new Error("User not authenticated");
    }
    const res = await fetch(DRIVE_API_URL, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "Authorization": `Bearer ${session.access_token}`,
      },
      body: JSON.stringify(body),
    });
    if (res.status === 401) {
      throw new Error("Session expirée — reconnecte-toi");
    }
    if (!res.ok) {
      const err = await res.json();
      throw new Error(err.error || "Drive API error");
    }
    return res.json();
  };

  const searchFiles = async (query: string): Promise<DriveFile[]> =>
    callAPI({ action: "search", query });

  const getRecentFiles = async (): Promise<DriveFile[]> =>
    callAPI({ action: "recent" });

  const attachFile = async (
    fileId: string,
    entityType: "task" | "event" | "project",
    entityId: string,
  ): Promise<DriveAttachment> => {
    setIsLoading(true);
    try {
      return await callAPI({ action: "attach", file_id: fileId, entity_type: entityType, entity_id: entityId });
    } finally {
      setIsLoading(false);
    }
  };

  const listAttachments = async (
    entityType: "task" | "event" | "project",
    entityId: string,
  ): Promise<DriveAttachment[]> =>
    callAPI({ action: "list_attachments", entity_type: entityType, entity_id: entityId });

  const detachFile = async (attachmentId: string) =>
    callAPI({ action: "detach", attachment_id: attachmentId });

  return {
    isConnected,
    connectionEmail,
    isLoading,
    connect,
    disconnect,
    searchFiles,
    getRecentFiles,
    attachFile,
    listAttachments,
    detachFile,
  };
}