import { supabase } from "@/integrations/supabase/client";

export async function logAudit(params: {
  action: string;
  entityType?: string;
  entityId?: string;
  details?: any;
}) {
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return;
  await supabase.from("audit_logs").insert({
    user_id: user.id,
    action: params.action,
    entity_type: params.entityType ?? null,
    entity_id: params.entityId ?? null,
    details: params.details ?? null,
  });
}
