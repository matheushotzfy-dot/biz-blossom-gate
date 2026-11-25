/**
 * Cupons: códigos de desconto do vendedor.
 * O checkout valida tudo no servidor (validate_coupon); aqui só criamos, editamos e acompanhamos.
 */
import { useMemo, useState } from "react";
import { useQueryClient } from "@tanstack/react-query";
import { AlertCircle, Plus } from "lucide-react";
import { toast } from "sonner";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/useAuth";
import { usePrivacyMode } from "@/hooks/usePrivacyMode";
import { useCoupons, useProducts } from "@/hooks/useQueryData";
import { Seo } from "@/components/Seo";
import { Money } from "@/components/home/Money";
import { getCheckoutLink } from "@/components/products/productPresentation";
import { PageHead } from "@/components/seller-ui/PageHead";
import { StatBand } from "@/components/seller-ui/StatBand";
import { SectionTabs } from "@/components/seller-ui/SectionTabs";
import { FilterPills } from "@/components/seller-ui/FilterPills";
import { SearchField } from "@/components/seller-ui/SearchField";
import { EmptyPanel } from "@/components/seller-ui/EmptyPanel";
import { CouponDialog, type CouponFormValues, type CouponSaveResult } from "@/components/marketing/CouponDialog";
import { CouponsLedger } from "@/components/marketing/CouponsLedger";
import { couponErrorMessage, couponState, endOfDayIso, toDateInput, type Coupon } from "@/components/marketing/couponMeta";
import { ConfirmDialog } from "@/components/seller-ui/confirm";

type Filter = "all" | "active" | "paused" | "closed";
type DialogState = { mode: "create" | "edit" | "duplicate"; coupon: Coupon | null } | null;

async function copyText(text: string, ok: string) {
  try {
    await navigator.clipboard.writeText(text);
    toast.success(ok);
  } catch {
    toast.error("Não foi possível copiar. Selecione e copie manualmente.");
  }
}

export default function Cupons() {
  const { user } = useAuth();
  const qc = useQueryClient();
  const { hidden } = usePrivacyMode();
  const { data: products = [] } = useProducts();
  const { data: coupons = [], isLoading, isError, refetch } = useCoupons();

  const [filter, setFilter] = useState<Filter>("all");
  const [search, setSearch] = useState("");
  const [dialog, setDialog] = useState<DialogState>(null);
  const [deleteTarget, setDeleteTarget] = useState<Coupon | null>(null);
  const [deleting, setDeleting] = useState(false);
  const [busyId, setBusyId] = useState<string | null>(null);

  const now = Date.now();
  const sellable = useMemo(() => products.filter((p) => p.status !== "draft").map((p) => ({ id: p.id, name: p.name, price: Number(p.price), status: p.status })), [products]);
  const productById = useMemo(() => new Map(products.map((p) => [p.id, p])), [products]);
  const takenCodes = useMemo(() => coupons.map((c) => c.code.toUpperCase()), [coupons]);

  const productName = (id: string | null) => (id ? productById.get(id)?.name ?? "Produto removido" : "Todos os produtos");
  const productLink = (id: string | null) => {
    const p = id ? productById.get(id) : undefined;
    return p?.checkout_url ? getCheckoutLink(p.checkout_url) : "";
  };

  const stats = useMemo(() => {
    const usable = coupons.filter((c) => couponState(c, now) === "active");
    const uses = coupons.reduce((s, c) => s + Number(c.current_uses || 0), 0);
    const discount = coupons.reduce((s, c) => s + Number(c.total_discount_amount || 0), 0);
    const top = [...coupons].sort((a, b) => b.current_uses - a.current_uses)[0];
    return { usable: usable.length, uses, discount, usedCoupons: coupons.filter((c) => c.current_uses > 0).length, top: top && top.current_uses > 0 ? top : null };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [coupons]);

  const counts = useMemo(() => ({
    all: coupons.length,
    active: coupons.filter((c) => couponState(c, now) === "active").length,
    paused: coupons.filter((c) => couponState(c, now) === "paused").length,
    closed: coupons.filter((c) => ["expired", "exhausted"].includes(couponState(c, now))).length,
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }), [coupons]);

  const shown = useMemo(() => {
    const q = search.trim().toLowerCase();
    return coupons.filter((c) => {
      const st = couponState(c, now);
      if (filter === "active" && st !== "active") return false;
      if (filter === "paused" && st !== "paused") return false;
      if (filter === "closed" && st !== "expired" && st !== "exhausted") return false;
      if (!q) return true;
      return c.code.toLowerCase().includes(q) || productName(c.product_id).toLowerCase().includes(q);
    });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [coupons, filter, search, productById]);

  const refresh = () => qc.invalidateQueries({ queryKey: ["coupons"], exact: false });

  const save = async (v: CouponFormValues): Promise<CouponSaveResult> => {
    if (!user || !dialog) return { ok: false, message: "Sua sessão expirou. Entre de novo para continuar." };
    const editing = dialog.mode === "edit" && dialog.coupon;
    const fields = {
      discount_type: v.type,
      discount_value: v.value,
      product_id: v.productId,
      max_uses: v.maxUses,
      apply_to_bumps: v.applyToBumps,
    };

    if (editing) {
      const original = dialog.coupon!;
      // Só mexe na validade quando o dia mudou, para não trocar o horário de um cupom que já existe.
      const keepsExpiry = toDateInput(original.expires_at) === v.expires;
      const patch = { ...fields, ...(keepsExpiry ? {} : { expires_at: v.expires ? endOfDayIso(v.expires) : null }) };
      const { error } = await supabase.from("coupons").update(patch).eq("id", original.id).eq("user_id", user.id);
      if (error) return { ok: false, message: couponErrorMessage(error, "Não foi possível salvar o cupom. Tente de novo.") };
      toast.success(`Cupom ${original.code} atualizado.`);
    } else {
      const { error } = await supabase.from("coupons").insert({
        ...fields, user_id: user.id, code: v.code, expires_at: v.expires ? endOfDayIso(v.expires) : null,
      });
      if (error) {
        const message = couponErrorMessage(error, "Não foi possível criar o cupom. Tente de novo.");
        return { ok: false, field: message.startsWith("Você já tem") ? "code" : undefined, message };
      }
      toast.success(`Cupom ${v.code} criado.`);
    }
    setDialog(null);
    void refresh();
    return { ok: true };
  };

  const toggle = async (c: Coupon) => {
    if (!user || busyId) return;
    setBusyId(c.id);
    const next = !c.is_active;
    const { error } = await supabase.from("coupons").update({ is_active: next }).eq("id", c.id).eq("user_id", user.id);
    setBusyId(null);
    if (error) { toast.error(couponErrorMessage(error, "Não foi possível alterar o cupom. Tente de novo.")); return; }
    toast.success(next ? `Cupom ${c.code} reativado.` : `Cupom ${c.code} pausado.`);
    void refresh();
  };

  const confirmDelete = async () => {
    if (!user || !deleteTarget) return;
    setDeleting(true);
    const { error } = await supabase.from("coupons").delete().eq("id", deleteTarget.id).eq("user_id", user.id);
    setDeleting(false);
    if (error) { toast.error(couponErrorMessage(error, "Não foi possível excluir o cupom. Tente de novo.")); return; }
    toast.success(`Cupom ${deleteTarget.code} excluído.`);
    setDeleteTarget(null);
    void refresh();
  };

  const clearFilters = () => { setFilter("all"); setSearch(""); };
  const money = (v: number) => (hidden ? "R$ ••••" : <Money value={v} centsClassName="opacity-70" />);

  return (
    <div className="vp-fade space-y-5 pb-6 md:space-y-6">
      <Seo title="Cupons | Vemprapay" description="Códigos de desconto para o seu checkout." path="/vendas/cupons" noindex />

      <SectionTabs section="growth" />
      <PageHead
        title="Cupons"
        subtitle="Dê um código de desconto para campanhas e parcerias. O cliente digita no checkout e você acompanha quanto cada cupom rendeu."
        actions={!isError && <button type="button" className="vp-cta" onClick={() => setDialog({ mode: "create", coupon: null })}><Plus className="h-[18px] w-[18px]" strokeWidth={2.4} />Novo cupom</button>}
      />

      {isError ? (
        <section className="vp-sheet">
          <EmptyPanel
            icon={<AlertCircle className="h-7 w-7" strokeWidth={1.8} />}
            title="Não foi possível carregar os cupons"
            text="Confira sua conexão e tente de novo. Seus cupons continuam salvos."
            action={<button type="button" className="vp-ghost" onClick={() => void refetch()}>Tentar de novo</button>}
          />
        </section>
      ) : (
        <>
          <StatBand
            label="Resumo dos cupons"
            cells={[
              { label: "Desconto concedido", featured: true, loading: isLoading, value: money(stats.discount), sub: stats.discount > 0 ? "Abatido de vendas já pagas" : "Nenhuma venda usou cupom ainda" },
              { label: "Resgates", loading: isLoading, value: stats.uses.toLocaleString("pt-BR"), sub: stats.uses === 0 ? "Ninguém usou um cupom ainda" : `em ${stats.usedCoupons} ${stats.usedCoupons === 1 ? "cupom" : "cupons"}` },
              { label: "Cupons ativos", loading: isLoading, value: String(stats.usable), sub: coupons.length === 0 ? "Nenhum cupom criado" : `${coupons.length} ${coupons.length === 1 ? "cupom criado" : "cupons criados"}` },
              { label: "Mais usado", loading: isLoading, value: stats.top ? <span className="font-mono !text-[22px] tracking-[0.02em] sm:!text-[24px]">{stats.top.code}</span> : "—", sub: stats.top ? `${stats.top.current_uses.toLocaleString("pt-BR")} ${stats.top.current_uses === 1 ? "resgate" : "resgates"}` : "Aparece com o primeiro resgate" },
            ]}
          />

          <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
            <FilterPills<Filter>
              label="Filtrar cupons por situação"
              value={filter}
              onChange={setFilter}
              options={[
                { value: "all", label: "Todos", count: counts.all },
                { value: "active", label: "Ativos", count: counts.active },
                { value: "paused", label: "Pausados", count: counts.paused },
                { value: "closed", label: "Encerrados", count: counts.closed },
              ]}
            />
            <SearchField label="Buscar cupom" value={search} onChange={setSearch} placeholder="Código ou produto" className="sm:w-[300px]" />
          </div>

          <CouponsLedger
            coupons={shown}
            productName={productName}
            productLink={productLink}
            loading={isLoading}
            filtering={coupons.length > 0}
            busyId={busyId}
            onCreate={() => setDialog({ mode: "create", coupon: null })}
            onEdit={(c) => setDialog({ mode: "edit", coupon: c })}
            onDuplicate={(c) => setDialog({ mode: "duplicate", coupon: c })}
            onToggle={(c) => void toggle(c)}
            onDelete={setDeleteTarget}
            onCopyCode={(c) => void copyText(c.code, `Código ${c.code} copiado.`)}
            onCopyLink={(c) => void copyText(`${productLink(c.product_id)}?cupom=${encodeURIComponent(c.code)}`, "Link com o desconto copiado.")}
            onClearFilters={clearFilters}
          />
        </>
      )}

      <CouponDialog
        open={!!dialog}
        onOpenChange={(o) => { if (!o) setDialog(null); }}
        mode={dialog?.mode ?? "create"}
        coupon={dialog?.coupon}
        products={sellable}
        takenCodes={takenCodes}
        onSave={save}
      />

      <ConfirmDialog
        open={!!deleteTarget} onOpenChange={(o) => { if (!o) setDeleteTarget(null); }} busy={deleting}
        title="Excluir este cupom?" confirmLabel="Excluir cupom" cancelLabel="Manter cupom"
        description={
          <div className="space-y-2">
            <span className="block break-all font-mono text-[15px] font-bold text-foreground">{deleteTarget?.code}</span>
            <p>
              O código deixa de funcionar no checkout.
              {deleteTarget && deleteTarget.current_uses > 0 ? ` As vendas que já usaram o cupom continuam como estão, mas o histórico de ${deleteTarget.current_uses} ${deleteTarget.current_uses === 1 ? "resgate" : "resgates"} some daqui.` : ""}
              {" "}Se só quer parar de oferecer, pause o cupom em vez de excluir.
            </p>
          </div>
        }
        onConfirm={confirmDelete}
      />
    </div>
  );
}
