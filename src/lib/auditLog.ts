import { supabase } from "@/integrations/supabase/client";
import type { Json } from "@/integrations/supabase/types";

export async function logAdminAction(
  action: string,
  entityType: string,
  entityId?: string,
  details?: Record<string, Json>
) {
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return;

  await supabase.from("audit_logs").insert([{
    admin_user_id: user.id,
    action,
    entity_type: entityType,
    entity_id: entityId || null,
    details: details || {},
  }]);
}
