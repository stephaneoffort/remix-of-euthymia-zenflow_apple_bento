import { useState, useEffect } from "react";
import { supabase } from "@/integrations/supabase/client";

const CANVA_API = "https://jivfyaqpuhutixfjttga.supabase.co/functions/v1/canva-api";

export interface CanvaAttachment {
  id: string;
  design_id: string;
  design_name: string;
  design_url: string;
  thumbnail_url: string | null;
  design_type: string | null;
  entity_type: string;
  entity_id: string;
  created_at: string;
}

export function useCanva() {
  const [isConnected, setIsConnected] = useState(false);
  const [connectionInfo, setConnectionInfo] = useState<{ email?: string; display_name?: string } | null>(null);

  useEffect(() => {
    checkConnection();
    if (window.location.search.includes("canva_connected=true")) {
      setIsConnected(true);
      window.history.replaceState({}, "", window.location.pathname);
    }
  }, []);

  const checkConnection = async () => {
    const { data } = await supabase
      .from("canva_connections" as any)
      .select("id, email, display_name")
      .not("email", "like", "pending_%")
      .limit(1);
    const rows = data as any[] | null;
    setIsConnected((rows?.length ?? 0) > 0);
    if (rows && rows.length > 0) {
      setConnectionInfo({ email: rows[0].email, display_name: rows[0].display_name });
    }
  };

  const connect = async () => {
    const { data: { user } } = await supabase.auth.getUser();
    window.location.href =
      `https://jivfyaqpuhutixfjttga.supabase.co/functions/v1/canva-oauth/authorize?user_id=${user?.id || ""}`;
  };

  const disconnect = async () => {
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) return;
    await supabase.from("canva_connections" as any).delete().eq("user_id", user.id);
    setIsConnected(false);
    setConnectionInfo(null);
  };

  const call = async (body: object) => {
    const { data: { user } } = await supabase.auth.getUser();
    const res = await fetch(CANVA_API, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ ...body, user_id: user?.id }),
    });
    return res.json();
  };

  const listDesigns = () => call({ action: "list_designs" });
  const searchDesigns = (query: string) => call({ action: "search_designs", query });
  const createDesign = (designType: string, title: string) =>
    call({ action: "create_design", design_type: designType, title });
  const attachDesign = (designId: string, entityType: string, entityId: string) =>
    call({ action: "attach", design_id: designId, entity_type: entityType, entity_id: entityId });
  const listAttachments = (entityType: string, entityId: string) =>
    call({ action: "list_attachments", entity_type: entityType, entity_id: entityId });
  const detachDesign = (attachmentId: string) =>
    call({ action: "detach", attachment_id: attachmentId });
  const exportDesign = (designId: string, format: "png" | "pdf" | "jpg") =>
    call({ action: "export", design_id: designId, format });

  return {
    isConnected, connect, disconnect, connectionInfo,
    listDesigns, searchDesigns, createDesign,
    attachDesign, listAttachments, detachDesign, exportDesign,
  };
}
