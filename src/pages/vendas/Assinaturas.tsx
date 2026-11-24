import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/useAuth";
import { useProducts } from "@/hooks/useQueryData";
import { AlertCircle, Plus } from "lucide-react";
import { toast } from "sonner";
import { friendlyError } from "@/lib/friendlyError";
import { Seo } from "@/components/Seo";
import { Money } from "@/components/home/Money";
import { PageHead } from "@/components/seller-ui/PageHead";
import { StatBand } from "@/components/seller-ui/StatBand";
import { SectionTabs } from "@/components/seller-ui/SectionTabs";
import { FilterPills } from "@/components/seller-ui/FilterPills";
import { SearchField } from "@/components/seller-ui/SearchField";
import { PlansGrid } from "@/components/subscriptions/PlansGrid";
import { SubscribersLedger } from "@/components/subscriptions/SubscribersLedger";
import { NewPlanDialog } from "@/components/subscriptions/NewPlanDialog";
import type { Plan, PlanFormValues, Subscription } from "@/components/subscriptions/types";

type TabId = "plans" | "subscribers";

export default function Assinaturas() {
  const { user } = useAuth();
  const { data: products } = useProducts();
  const [tab, setTab] = useState<TabId>("plans");
  const [plans, setPlans] = useState<Plan[]>([]);
  const [subs, setSubs] = useState<Subscription[]>([]);
  const [loading, setLoading] = useState(true);
  const [showCreate, setShowCreate] = useState(false);
  const [search, setSearch] = useState("");

  const fetchData = async () => {
    if (!user?.id) return;
    setLoading(true);
    const [plansRes, subsRes] = await Promise.all([
      supabase.from("subscription_plans").select("*").eq("user_id", user.id).order("created_at", { ascending: false }),
      supabase.from("subscriptions").select("*").eq("seller_user_id", user.id).order("created_at", { ascending: false }),
    ]);
    if (plansRes.data) setPlans(plansRes.data as Plan[]);
    if (subsRes.data) setSubs(subsRes.data as Subscription[]);
    setLoading(false);
  };

  useEffect(() => { fetchData(); }, [user?.id]);

  const handleCreate = async (v: PlanFormValues): Promise<boolean> => {
    if (!v.name.trim() || !v.price) { toast.error("Preencha nome e preço"); return false; }
    const price = parseFloat(v.price.replace(",", "."));
    if (isNaN(price) || price < 1) { toast.error("Preço mínimo: R$ 1,00"); return false; }

    const { error } = await supabase.from("subscription_plans").insert({
      user_id: user!.id,
      name: v.name.trim(),
      description: v.description.trim() || null,
      price,
      interval: v.interval,
      trial_days: parseInt(v.trial) || 0,
      product_id: v.product && v.product !== "none" ? v.product : null,
    });
    if (error) { toast.error(friendlyError(error)); return false; }
    toast.success("Plano criado!");
    setShowCreate(false);
    await fetchData();
    return true;
  };

  const togglePlan = async (plan: Plan) => {
    if (!user) return;
    await supabase.from("subscription_plans").update({ is_active: !plan.is_active }).eq("id", plan.id).eq("user_id", user.id);
    toast.success(plan.is_active ? "Plano desativado" : "Plano ativado");
    fetchData();
  };

  const activeSubs = subs.filter(s => s.status === "active" || s.status === "trialing");
  const trialingCount = subs.filter(s => s.status === "trialing").length;
  const pastDueCount = subs.filter(s => s.status === "past_due").length;
  const canceledCount = subs.filter(s => s.status === "canceled").length;
  const activePlans = plans.filter(p => p.is_active).length;
  const orphanSubsCount = subs.filter(s => !plans.some(p => p.id === s.plan_id)).length;

  const mrr = activeSubs.reduce((acc, s) => {
    const plan = plans.find(p => p.id === s.plan_id);
    if (!plan) return acc;
    if (plan.interval === "monthly") return acc + plan.price;
    if (plan.interval === "yearly")  return acc + plan.price / 12;
    if (plan.interval === "weekly")  return acc + plan.price * 4.33;
    if (plan.interval === "daily")   return acc + plan.price * 30.44;
    return acc;
  }, 0);

  const q = search.trim().toLowerCase();
  const shownPlans = plans.filter((p) => p.name.toLowerCase().includes(q));
  const shownSubs = subs.filter((x) => x.subscriber_email.toLowerCase().includes(q) || (x.subscriber_name || "").toLowerCase().includes(q));
  const payingCount = activeSubs.length - trialingCount;

  return (
    <div className="vp-fade space-y-5 pb-6 md:space-y-6">
      <Seo title="Assinaturas | Vemprapay" description="Planos recorrentes e assinantes." path="/vendas/assinaturas" noindex />

      <SectionTabs section="sales" />
      <PageHead
        title="Assinaturas"
        subtitle="Receita recorrente com planos próprios. Acompanhe assinantes e o quanto entra todo mês."
        actions={<button type="button" className="vp-cta" onClick={() => setShowCreate(true)}><Plus className="h-[18px] w-[18px]" strokeWidth={2.4} />Novo plano</button>}
      />

      <NewPlanDialog open={showCreate} onOpenChange={setShowCreate} products={products ?? []} onCreate={handleCreate} />

      <StatBand
        label="Resumo das assinaturas"
        cells={[
          { label: "Receita mensal recorrente", featured: true, loading, value: <Money value={mrr} centsClassName="opacity-70" />, sub: `${activeSubs.length} ${activeSubs.length === 1 ? "assinante ativo" : "assinantes ativos"}` },
          { label: "Assinantes ativos", loading, value: String(activeSubs.length), sub: `${payingCount} pagando, ${trialingCount} em teste` },
          { label: "Planos ativos", loading, value: String(activePlans), sub: `${plans.length} ${plans.length === 1 ? "plano criado" : "planos criados"}` },
          { label: "Total de assinaturas", loading, value: String(subs.length), sub: `${pastDueCount} atrasadas, ${canceledCount} canceladas` },
        ]}
      />

      {orphanSubsCount > 0 && (
        <p role="alert" className="flex items-center gap-2.5 rounded-2xl bg-warning/15 px-4 py-3 text-[13.5px] font-medium text-warning">
          <AlertCircle className="h-4 w-4 shrink-0" />
          {orphanSubsCount} {orphanSubsCount === 1 ? "assinatura está ligada" : "assinaturas estão ligadas"} a um plano que não existe mais.
        </p>
      )}

      <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <FilterPills<TabId>
          label="Ver planos ou assinantes"
          value={tab}
          onChange={(t) => { setTab(t); setSearch(""); }}
          options={[{ value: "plans", label: "Planos", count: plans.length }, { value: "subscribers", label: "Assinantes", count: subs.length }]}
        />
        <SearchField label="Buscar" value={search} onChange={setSearch} placeholder={tab === "plans" ? "Buscar plano" : "Nome ou e-mail do assinante"} className="sm:w-[320px]" />
      </div>

      {tab === "plans" ? (
        <PlansGrid plans={shownPlans} subs={subs} loading={loading} searching={q !== "" && plans.length > 0} onToggle={togglePlan} onCreate={() => setShowCreate(true)} />
      ) : (
        <SubscribersLedger subs={shownSubs} plans={plans} loading={loading} searching={q !== "" && subs.length > 0} onSeePlans={() => setTab("plans")} />
      )}
    </div>
  );
}
