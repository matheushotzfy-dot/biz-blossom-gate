/**
 * Navegação do painel admin e regras puras da casca (sem React), para o painel e os testes usarem o mesmo código.
 * Quem pode abrir cada aba vem de `employeeAccess` (uma fonte só): admin abre tudo, staff só o que está marcado
 * (mais "Suporte" quando tem a permissão `view_support`).
 */
import {
  Shield, Zap, LayoutDashboard, Users, Package, AlertTriangle,
  RotateCcw, ShieldAlert, CreditCard, ArrowDownToLine, Tag, GraduationCap,
  Activity, Settings, Bell, MessageSquare, UserCog, Coins, Bug, UserX, ShieldCheck,
  Package2, BarChart3, Trophy, Target, Gauge, Clock, Link as LinkIcon, PackageCheck,
  TrendingUp, Wrench, Flag, Repeat, Share2, Handshake, Undo2,
  type LucideIcon,
} from "lucide-react";
import { differenceInCalendarDays, endOfDay, startOfDay, subDays } from "date-fns";

export interface NavItem { id: string; label: string; icon: LucideIcon; employeeAccess: boolean }
export interface NavSection { id: string; label: string; items: NavItem[] }

export const NAV_SECTIONS: NavSection[] = [
  {
    id: "core", label: "Operacional",
    items: [
      { id: "god-mode", label: "Dashboard", icon: LayoutDashboard, employeeAccess: true },
      { id: "command-center", label: "Centro de Comando", icon: Gauge, employeeAccess: false },
      { id: "analytics", label: "Analytics", icon: BarChart3, employeeAccess: false },
      { id: "sellers", label: "Sellers", icon: Users, employeeAccess: true },
      { id: "top-sellers", label: "Top Sellers", icon: Zap, employeeAccess: false },
      { id: "inactive-sellers", label: "Inativos", icon: UserX, employeeAccess: false },
      { id: "employees", label: "Staff", icon: UserCog, employeeAccess: false },
      { id: "managers", label: "Gerentes", icon: Shield, employeeAccess: false },
      { id: "staff-commissions", label: "Comissões Staff", icon: Coins, employeeAccess: false },
    ],
  },
  {
    id: "treasury", label: "Financeiro",
    items: [
      { id: "fin-metrics", label: "Métricas Financeiras", icon: TrendingUp, employeeAccess: false },
      { id: "refund-approvals", label: "Pendentes de aprovação", icon: Clock, employeeAccess: false },
      { id: "staff-requests", label: "Pedidos da Equipe", icon: UserCog, employeeAccess: false },
      { id: "acquirers-panel", label: "Adquirentes", icon: Package2, employeeAccess: false },
      { id: "withdrawals", label: "Saques", icon: ArrowDownToLine, employeeAccess: false },
      { id: "transactions", label: "Transações", icon: CreditCard, employeeAccess: true },
      { id: "payment-links", label: "Links de Pagamento", icon: LinkIcon, employeeAccess: false },
      { id: "checkout-deliveries", label: "Entregas", icon: PackageCheck, employeeAccess: false },
      { id: "financial-audit", label: "Auditoria Financeira", icon: Activity, employeeAccess: false },
    ],
  },
  {
    id: "risk", label: "Risco & Compliance",
    items: [
      { id: "risk-compliance", label: "Anti-Fraude", icon: ShieldCheck, employeeAccess: false },
      { id: "abuse-metrics", label: "Abuso & Auth", icon: ShieldAlert, employeeAccess: false },
      { id: "medpix", label: "MED Pix", icon: AlertTriangle, employeeAccess: false },
      { id: "chargeback", label: "Chargeback", icon: RotateCcw, employeeAccess: false },
      { id: "refunds", label: "Reembolsos", icon: Undo2, employeeAccess: false },
      { id: "premed", label: "Pré-MED", icon: ShieldAlert, employeeAccess: false },
    ],
  },
  {
    id: "content", label: "Conteúdo",
    items: [
      { id: "products", label: "Produtos", icon: Package, employeeAccess: true },
      { id: "top-products", label: "Top Produtos", icon: Package2, employeeAccess: false },
      { id: "courses", label: "Cursos", icon: GraduationCap, employeeAccess: false },
      { id: "coupons", label: "Cupons", icon: Tag, employeeAccess: false },
      { id: "affiliates", label: "Afiliados", icon: Handshake, employeeAccess: false },
      { id: "subscriptions", label: "Assinaturas", icon: Repeat, employeeAccess: false },
      { id: "referrals", label: "Indicações", icon: Share2, employeeAccess: false },
    ],
  },
  {
    id: "system", label: "Sistema",
    items: [
      { id: "settings", label: "Configurações", icon: Settings, employeeAccess: false },
      { id: "error-logs", label: "Error Logs", icon: Bug, employeeAccess: false },
      { id: "notifications", label: "Notificações", icon: Bell, employeeAccess: false },
      { id: "support", label: "Suporte", icon: MessageSquare, employeeAccess: false },
      { id: "rewards", label: "Premiações", icon: Trophy, employeeAccess: false },
      { id: "corridas", label: "Corridas Faturamento", icon: Flag, employeeAccess: false },
      { id: "goals", label: "Metas de Faturamento", icon: Target, employeeAccess: false },
      { id: "tools", label: "Ferramentas", icon: Wrench, employeeAccess: false },
      { id: "audit", label: "Auditoria", icon: Activity, employeeAccess: false },
    ],
  },
];

export const ALL_TAB_IDS = new Set(NAV_SECTIONS.flatMap((s) => s.items.map((i) => i.id)));
export const EMPLOYEE_ALLOWED_TABS = new Set(NAV_SECTIONS.flatMap((s) => s.items.filter((i) => i.employeeAccess).map((i) => i.id)));
export const DEFAULT_TAB = "god-mode";

export interface Access { isEmployee: boolean; hasSupportPerm: boolean }

/** Admin abre tudo; staff abre só o que está liberado (e o Suporte, se tiver a permissão). */
export function canOpenTab(tabId: string, { isEmployee, hasSupportPerm }: Access): boolean {
  if (!ALL_TAB_IDS.has(tabId)) return false;
  if (!isEmployee) return true;
  return EMPLOYEE_ALLOWED_TABS.has(tabId) || (tabId === "support" && hasSupportPerm);
}

/** Aba que de fato abre para o `?tab=` da URL: desconhecida ou proibida cai no Dashboard (liberado para todos). */
export function resolveActiveTab(urlTab: string, access: Access): string {
  if (canOpenTab(urlTab, access)) return urlTab;
  return DEFAULT_TAB;
}

export function sectionsFor(access: Access): NavSection[] {
  if (!access.isEmployee) return NAV_SECTIONS;
  return NAV_SECTIONS
    .map((s) => ({ ...s, items: s.items.filter((i) => canOpenTab(i.id, access)) }))
    .filter((s) => s.items.length > 0);
}

const fold = (text: string) => text.normalize("NFD").replace(/[̀-ͯ]/g, "").toLowerCase().trim();

/** Filtro da busca do menu: ignora acento e caixa ("comissoes" acha "Comissões Staff"). */
export function searchSections(sections: NavSection[], query: string): NavSection[] {
  const q = fold(query);
  if (!q) return sections;
  return sections
    .map((s) => ({ ...s, items: s.items.filter((i) => fold(i.label).includes(q) || fold(s.label).includes(q)) }))
    .filter((s) => s.items.length > 0);
}

/* ───────────── Período ───────────── */

export type DatePresetId = "today" | "yesterday" | "7d" | "14d" | "30d" | "40d" | "90d" | "180d" | "365d";

export const DATE_PRESETS: { id: DatePresetId; label: string }[] = [
  { id: "today", label: "Hoje" },
  { id: "yesterday", label: "Ontem" },
  { id: "7d", label: "7d" },
  { id: "14d", label: "14d" },
  { id: "30d", label: "30d" },
  { id: "40d", label: "40d" },
  { id: "90d", label: "90d" },
  { id: "180d", label: "180d" },
  { id: "365d", label: "1 ano" },
];

/** Intervalo de cada atalho, sempre de 00:00 do primeiro dia até 23:59:59 do último ("7d" = hoje e os 6 dias antes). */
export function presetRange(id: DatePresetId, today: Date): { from: Date; to: Date } {
  if (id === "today") return { from: startOfDay(today), to: endOfDay(today) };
  if (id === "yesterday") { const y = subDays(today, 1); return { from: startOfDay(y), to: endOfDay(y) }; }
  const days = Number(id.replace("d", ""));
  return { from: startOfDay(subDays(today, days - 1)), to: endOfDay(today) };
}

/** Qual atalho corresponde ao intervalo (null = intervalo livre). Vira "Ontem" sozinho depois da meia-noite. */
export function matchDatePreset(range: { from: Date; to: Date }, today: Date): DatePresetId | null {
  for (const p of DATE_PRESETS) {
    const r = presetRange(p.id, today);
    if (differenceInCalendarDays(r.from, range.from) === 0 && differenceInCalendarDays(r.to, range.to) === 0) return p.id;
  }
  return null;
}

/* ───────────── Texto ───────────── */

/** "R$ 980,00", "R$ 12,4 mil", "R$ 2,3 mi": cabe no topo sem virar "R$ 1234.5K". */
export function compactBRL(value: number): string {
  const v = Number.isFinite(value) ? value : 0;
  const abs = Math.abs(v);
  const num = (n: number) => n.toLocaleString("pt-BR", { maximumFractionDigits: 1, minimumFractionDigits: 0 });
  if (abs >= 1_000_000) return `R$ ${num(v / 1_000_000)} mi`;
  if (abs >= 10_000) return `R$ ${num(v / 1_000)} mil`;
  return `R$ ${v.toLocaleString("pt-BR", { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;
}
