import type { PixelConfig } from "@/lib/pixelTracking";

export type CheckoutMethod = "pix" | "credit_card" | "boleto";
export type CheckoutThemeMode = "gray" | "white" | "dark";

/** Produto como o checkout usa: tudo já normalizado (números, booleanos, limites). */
export interface CheckoutProduct {
  id: string;
  name: string;
  description: string | null;
  price: number;
  imageUrl: string | null;
  sellerName: string | null;
  buttonColor: string | null;
  theme: CheckoutThemeMode;
  timerEnabled: boolean;
  timerMinutes: number;
  bannerDesktopUrl: string | null;
  bannerMobileUrl: string | null;
  guaranteeEnabled: boolean;
  addressRequired: boolean;
  emailConfirm: boolean;
  methods: CheckoutMethod[];
}

export interface CheckoutBump {
  id: string;
  productId: string;
  name: string;
  description: string | null;
  price: number;
  imageUrl: string | null;
}

export interface AppliedCoupon {
  code: string;
  couponId: string;
  discountType: string;
  discountValue: number;
  applyToBumps: boolean;
}

export type CheckoutLoad =
  | { kind: "ready"; product: CheckoutProduct; bumps: CheckoutBump[]; pixels: PixelConfig[] }
  | { kind: "closed"; linkStatus: string | null };
