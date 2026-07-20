import { supabase } from "@/integrations/supabase/client";

export type AuditAction =
  | "task.created"
  | "task.updated"
  | "task.deleted"
  | "task.shared"
  | "attachment.downloaded"
  | "attachment.uploaded"
  | "attachment.deleted";

export async function logAudit(
  action: AuditAction,
  entityType: string,
  entityId: string | null,
  metadata: Record<string, unknown> = {},
) {
  try {
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) return;
    await (supabase.from("audit_logs" as any) as any).insert({
      user_id: user.id,
      action,
      entity_type: entityType,
      entity_id: entityId,
      metadata,
    });
  } catch {
    // never break UX for audit failures
  }
}

export interface AuditLogRow {
  id: string;
  user_id: string | null;
  action: string;
  entity_type: string;
  entity_id: string | null;
  metadata: Record<string, unknown>;
  created_at: string;
}
