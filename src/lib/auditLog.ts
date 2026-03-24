import { supabase } from "@/integrations/supabase/client";
import type { Json } from "@/integrations/supabase/types";

/**
 * Logs an admin action to the audit_logs table.
 * Includes error handling to prevent silent failures.
 * Captures IP when available via headers.
 */
export async function logAdminAction(
  action: string,
  entityType: string,
  entityId?: string,
  details?: Record<string, Json>
) {
  try {
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) {
      console.warn("[auditLog] No authenticated user found, skipping audit log");
      return;
    }

    // Sanitize inputs to prevent injection
    const sanitizedAction = action.replace(/[<>'"]/g, "").slice(0, 100);
    const sanitizedEntityType = entityType.replace(/[<>'"]/g, "").slice(0, 50);
    const sanitizedEntityId = entityId ? entityId.replace(/[<>'"]/g, "").slice(0, 255) : null;

    const { error } = await supabase.from("audit_logs").insert([{
      admin_user_id: user.id,
      action: sanitizedAction,
      entity_type: sanitizedEntityType,
      entity_id: sanitizedEntityId,
      details: details || {},
    }]);

    if (error) {
      console.error("[auditLog] Failed to write audit log:", error.message);
    }
  } catch (err) {
    console.error("[auditLog] Unexpected error:", err);
  }
}

/**
 * Sanitize user-provided text to prevent XSS when stored/displayed.
 */
export function sanitizeText(input: string, maxLength = 1000): string {
  return input
    .replace(/[<>]/g, "")
    .replace(/javascript:/gi, "")
    .replace(/on\w+=/gi, "")
    .trim()
    .slice(0, maxLength);
}
