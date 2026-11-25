import { supabase } from "@/integrations/supabase/client";
import type { AppliedCoupon } from "./types";

export type CouponResult = { ok: true; coupon: AppliedCoupon } | { ok: false; message: string };

/** Código de cupom como o painel do vendedor aceita: A-Z, 0-9, "-" e "_", até 30. */
export function cleanCouponCode(raw: string | null | undefined): string {
  return (raw ?? "").toUpperCase().replace(/[^A-Z0-9_-]/g, "").slice(0, 30);
}

export async function checkCoupon(rawCode: string, productId: string, price: number): Promise<CouponResult> {
  const code = cleanCouponCode(rawCode);
  if (code.length < 3) return { ok: false, message: "Digite o código do cupom." };
  try {
    const { data, error } = await supabase.rpc("validate_coupon", { _code: code, _product_id: productId, _amount: price });
    const row = Array.isArray(data) ? data[0] : data;
    if (error) return { ok: false, message: "Não deu para conferir o cupom agora. Tente de novo." };
    if (!row?.valid) return { ok: false, message: typeof row?.error === "string" && row.error ? row.error : "Cupom inválido" };
    return {
      ok: true,
      coupon: { code, couponId: row.coupon_id, discountType: row.discount_type, discountValue: Number(row.discount_value), applyToBumps: Boolean(row.apply_to_bumps) },
    };
  } catch {
    return { ok: false, message: "Não deu para conferir o cupom agora. Tente de novo." };
  }
}
