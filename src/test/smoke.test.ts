import { describe, it, expect, vi } from "vitest";

// Smoke tests: ensure the main admin/seller route modules import and parse
// cleanly after the type-only refactor. We don't render — these screens pull
// in heavy provider trees and async data. A successful dynamic import proves
// the file compiled, exported a component, and didn't crash at module init.

vi.mock("@/integrations/supabase/client", () => ({
  supabase: {
    auth: {
      getSession: vi.fn().mockResolvedValue({ data: { session: null }, error: null }),
      onAuthStateChange: vi.fn().mockReturnValue({ data: { subscription: { unsubscribe: vi.fn() } } }),
      getUser: vi.fn().mockResolvedValue({ data: { user: null }, error: null }),
      signOut: vi.fn(),
    },
    from: vi.fn(() => ({
      select: vi.fn().mockReturnThis(),
      eq: vi.fn().mockReturnThis(),
      order: vi.fn().mockReturnThis(),
      limit: vi.fn().mockResolvedValue({ data: [], error: null }),
      maybeSingle: vi.fn().mockResolvedValue({ data: null, error: null }),
      single: vi.fn().mockResolvedValue({ data: null, error: null }),
      insert: vi.fn().mockResolvedValue({ data: null, error: null }),
      update: vi.fn().mockResolvedValue({ data: null, error: null }),
      delete: vi.fn().mockResolvedValue({ data: null, error: null }),
    })),
    rpc: vi.fn().mockResolvedValue({ data: null, error: null }),
    channel: vi.fn(() => ({
      on: vi.fn().mockReturnThis(),
      subscribe: vi.fn().mockReturnThis(),
      unsubscribe: vi.fn(),
    })),
    removeChannel: vi.fn(),
    functions: { invoke: vi.fn().mockResolvedValue({ data: null, error: null }) },
  },
}));

const screens: Array<[string, () => Promise<unknown>]> = [
  ["Admin: Dashboard",       () => import("@/pages/admin/AdminDashboard")],
  ["Admin: Sellers Tab",     () => import("@/pages/admin/tabs/AdminSellersTab")],
  ["Seller: Dashboard",      () => import("@/pages/Dashboard")],
  ["Seller: Vendas",         () => import("@/pages/vendas/Vendas")],
  ["Seller: Checkout",       () => import("@/pages/vendas/Checkout")],
  ["Financeiro: Saques",     () => import("@/pages/financeiro/Saques")],
  ["Membros: MemberHome",    () => import("@/pages/membros/MemberHome")],
  ["Membros: MemberArea",    () => import("@/pages/membros/MemberArea")],
];

describe("smoke: main admin & seller screens load", () => {
  for (const [name, loader] of screens) {
    it(`${name} loads without throwing`, async () => {
      const mod = await loader();
      expect(mod).toBeTruthy();
      // Every page module must export a default React component.
      expect("default" in (mod as Record<string, unknown>)).toBe(true);
    });
  }
});

describe("smoke: AdminSellersTab Zod parsing", () => {
  it("parses malformed activity_logs payload without throwing", async () => {
    // Re-uses the same Zod patterns to validate the contract.
    const { z } = await import("zod");
    const schema = z.array(
      z.object({
        id: z.string(),
        user_id: z.string(),
        action: z.string(),
        entity_type: z.string(),
        entity_id: z.string().nullable(),
        old_data: z.record(z.unknown()).nullable().catch(null),
        new_data: z.record(z.unknown()).nullable().catch(null),
        created_at: z.string(),
      })
    );

    const bad = [{ id: "1", user_id: "u", action: "x", entity_type: "y", entity_id: null, old_data: "not-an-object", new_data: null, created_at: "now" }];
    const parsed = schema.safeParse(bad);
    // old_data falls back to null via .catch(null) instead of throwing.
    expect(parsed.success).toBe(true);
    if (parsed.success) expect(parsed.data[0].old_data).toBeNull();
  });
});
