/**
 * Entregas de webhook para a tela: o "pulso" (últimas 30 de cada endpoint) e o histórico do endpoint aberto.
 * Enquanto houver algo na fila ou sendo enviado a leitura se repete a cada 3 s (só com a aba visível);
 * parado, confere a cada 30 s para mostrar vendas que chegaram com a tela aberta.
 */
import { keepPreviousData, useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { deliveryKind, PULSE_SIZE, type DeliveryRow } from "./webhookMeta";

const PULSE_COLUMNS: string = "id, webhook_config_id, status, attempt, response_status, error, created_at";
/** Tipada como string de propósito: o caminho JSON (payload->>test) faz o analisador de tipos do select estourar. */
export const LOG_COLUMNS: string = "id, webhook_config_id, transaction_id, event, attempt, status, response_status, error, next_retry_at, delivered_at, created_at, is_test:payload->>test";
export const LOG_PAGE = 50;
const BUSY_MS = 3000;
const IDLE_MS = 30_000;

const isOpen = (d: Pick<DeliveryRow, "status" | "attempt">) => ["queued", "sending", "retrying"].includes(deliveryKind(d));

export type PulseMap = Record<string, DeliveryRow[]>;

export function usePulses(userId: string | undefined, endpointIds: string[]) {
  const key = endpointIds.join(",");
  return useQuery({
    queryKey: ["webhook-pulses", userId, key],
    enabled: !!userId && endpointIds.length > 0,
    queryFn: async (): Promise<PulseMap> => {
      const out: PulseMap = {};
      await Promise.all(endpointIds.map(async (id) => {
        const { data, error } = await supabase.from("webhook_deliveries").select(PULSE_COLUMNS)
          .eq("webhook_config_id", id).order("created_at", { ascending: false }).limit(PULSE_SIZE);
        if (error) throw error;
        out[id] = (data ?? []) as unknown as DeliveryRow[];
      }));
      return out;
    },
    refetchInterval: (q) => (Object.values(q.state.data ?? {}).some((rows) => rows.some(isOpen)) ? BUSY_MS : IDLE_MS),
    placeholderData: keepPreviousData,
  });
}

export function useDeliveryLog(userId: string | undefined, endpointId: string | null, limit: number) {
  return useQuery({
    queryKey: ["webhook-log", userId, endpointId, limit],
    enabled: !!userId && !!endpointId,
    queryFn: async (): Promise<DeliveryRow[]> => {
      const { data, error } = await supabase.from("webhook_deliveries").select(LOG_COLUMNS)
        .eq("webhook_config_id", endpointId!).order("created_at", { ascending: false }).limit(limit);
      if (error) throw error;
      return (data ?? []) as unknown as DeliveryRow[];
    },
    refetchInterval: (q) => ((q.state.data ?? []).some(isOpen) ? BUSY_MS : IDLE_MS),
    placeholderData: keepPreviousData,
  });
}

export interface DeliveryDetailData { payload: unknown; response_body: string | null }

/** Corpo enviado e resposta do servidor: só são lidos quando a pessoa abre a entrega. */
export function useDeliveryDetail(id: string | null, status: string, attempt: number) {
  return useQuery({
    queryKey: ["webhook-delivery", id, status, attempt],
    enabled: !!id,
    staleTime: 60_000,
    queryFn: async (): Promise<DeliveryDetailData> => {
      const { data, error } = await supabase.from("webhook_deliveries").select("payload, response_body").eq("id", id!).maybeSingle();
      if (error || !data) throw error ?? new Error("not-found");
      return data as DeliveryDetailData;
    },
  });
}
