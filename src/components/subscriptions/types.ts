import type { TxTone } from "@/components/seller-ui/txMeta";

export type Plan = {
  id: string; user_id: string; product_id: string | null; name: string; description: string | null;
  price: number; interval: string; interval_count: number; trial_days: number; is_active: boolean;
  created_at: string; updated_at: string;
};

export type Subscription = {
  id: string; plan_id: string; subscriber_email: string; subscriber_name: string | null;
  seller_user_id: string; status: string; current_period_start: string;
  current_period_end: string | null; trial_end: string | null; canceled_at: string | null;
  created_at: string;
};

export interface PlanFormValues { name: string; description: string; price: string; interval: string; trial: string; product: string }

export const INTERVAL_UNIT: Record<string, string> = { daily: "dia", weekly: "semana", monthly: "mês", yearly: "ano" };

export const SUB_STATUS: Record<string, { label: string; tone: TxTone }> = {
  active: { label: "Ativa", tone: "ok" },
  trialing: { label: "Em teste", tone: "info" },
  past_due: { label: "Atrasada", tone: "wait" },
  canceled: { label: "Cancelada", tone: "idle" },
  paused: { label: "Pausada", tone: "idle" },
};
