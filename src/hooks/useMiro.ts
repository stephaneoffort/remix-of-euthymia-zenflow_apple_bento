import { useState, useEffect } from "react";
import { supabase } from "@/integrations/supabase/client";

const MIRO_API = `https://${import.meta.env.VITE_SUPABASE_PROJECT_ID}.supabase.co/functions/v1/miro-api`;
const MIRO_OAUTH = `https://${import.meta.env.VITE_SUPABASE_PROJECT_ID}.supabase.co/functions/v1/miro-oauth`;

export interface MiroBoard {
  id: string;
  name: string;
  description: string | null;
  viewLink: string;
  picture: { imageURL: string } | null;
  createdAt: string;
  modifiedAt: string;
}

export interface MiroAttachment {
  id: string;
  board_id: string;
  board_name: string;
  board_url: string;
  thumbnail_url: string | null;
  entity_type: string;
  entity_id: string;
  created_at: string;
}

export function useMiro() {
  const [isConnected, setIsConnected] = useState(false);
  const [connectionInfo, setConnectionInfo] = useState<{ email?: string; display_name?: string } | null>(null);

  useEffect(() => {
    checkConnection();
    if (window.location.search.includes("miro_connected=true")) {
      setIsConnected(true);
      window.history.replaceState({}, "", window.location.pathname);
    }
  }, []);

  const checkConnection = async () => {
    const { data } = await (supabase as any)
      .from("miro_connections")
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
    window.location.href = `${MIRO_OAUTH}/authorize?token=${session.access_token}`;
  };

  const disconnect = async () => {
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) return;
    await (supabase as any).from("miro_connections").delete().eq("user_id", user.id);
    setIsConnected(false);
    setConnectionInfo(null);
  };

  const call = async (body: object) => {
    const { data: { session } } = await supabase.auth.getSession();
    if (!session?.access_token) throw new Error("Non authentifié");
    const res = await fetch(MIRO_API, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${session.access_token}`,
      },
      body: JSON.stringify(body),
    });
    if (res.status === 401) throw new Error("Session expirée — reconnecte-toi");
    const data = await res.json();
    if (data.error) throw new Error(data.error);
    return data;
  };

  const listBoards = () => call({ action: "list_boards" });
  const searchBoards = (query: string) => call({ action: "search_boards", query });
  const createBoard = (name: string, description?: string) =>
    call({ action: "create_board", name, description });
  const attachBoard = (boardId: string, boardName: string, boardUrl: string, entityType: string, entityId: string) =>
    call({ action: "attach", board_id: boardId, board_name: boardName, board_url: boardUrl, entity_type: entityType, entity_id: entityId });
  const listAttachments = (entityType: string, entityId: string) =>
    call({ action: "list_attachments", entity_type: entityType, entity_id: entityId });
  const detachBoard = (attachmentId: string) =>
    call({ action: "detach", attachment_id: attachmentId });

  return {
    isConnected,
    connectionInfo,
    connect,
    disconnect,
    listBoards,
    searchBoards,
    createBoard,
    attachBoard,
    listAttachments,
    detachBoard,
  };
}
