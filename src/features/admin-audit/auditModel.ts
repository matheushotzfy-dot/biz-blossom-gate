import type { Tone } from "@/features/admin-disputes/disputesModel";
import { fmtDateTime } from "@/features/admin-finance/format";
import { agoLabel, dayLabel, deviceLabel } from "@/features/admin-errors/errorsModel";
import { csvCell, spDateTime, spDay } from "@/features/admin-tools/toolsModel";

export type { Tone };
export { agoLabel, dayLabel, deviceLabel };

export const PAGE_SIZE = 25;
export const EXPORT_PAGE = 1000;
export const EXPORT_MAX = 20_000;

/* ───────── filtros ───────── */

export type SourceKey = "admin" | "staff" | "activity";
export type SourceFilter = "all" | SourceKey;
export type PeriodKey = "1" | "7" | "30" | "90" | "all";

export const SOURCES: { value: SourceFilter; label: string; note: string }[] = [
  { value: "all", label: "Tudo", note: "Tudo o que foi registrado, do mais novo para o mais antigo." },
  { value: "admin", label: "Administração", note: "Ações no painel do administrador e eventos automáticos, como o saque automático." },
  { value: "staff", label: "Equipe", note: "O que gerentes e a equipe mudaram em cadastros, saques, vendas e disputas." },
  { value: "activity", label: "Vendedores", note: "O que os vendedores fizeram com produtos e cursos, e as exportações de vendas." },
];
export const sourceLabel = (s: string) => SOURCES.find((x) => x.value === s)?.label ?? "Outro";

export const PERIODS: { value: PeriodKey; label: string; days: number | null }[] = [
  { value: "1", label: "Hoje", days: 1 },
  { value: "7", label: "7 dias", days: 7 },
  { value: "30", label: "30 dias", days: 30 },
  { value: "90", label: "90 dias", days: 90 },
  { value: "all", label: "Tudo", days: null },
];
export const periodDays = (p: PeriodKey) => PERIODS.find((x) => x.value === p)?.days ?? null;
export const periodText = (p: PeriodKey) => (p === "1" ? "hoje" : p === "all" ? "todo o período" : `últimos ${p} dias`);

export interface AuditFilters { source: SourceFilter; period: PeriodKey; actor: string | null; entity: string | null; search: string; sensitive: boolean }
export const DEFAULT_FILTERS: AuditFilters = { source: "all", period: "30", actor: null, entity: null, search: "", sensitive: false };

export function filtersActive(f: AuditFilters): boolean {
  return f.source !== "all" || f.period !== DEFAULT_FILTERS.period || !!f.actor || !!f.entity || !!f.search.trim() || f.sensitive;
}

/* ───────── leitura do servidor ───────── */

const isObj = (v: unknown): v is Record<string, unknown> => !!v && typeof v === "object" && !Array.isArray(v);
const num = (v: unknown) => { const n = Number(v); return Number.isFinite(n) ? n : 0; };
const str = (v: unknown) => (typeof v === "string" ? v : "");
const strOrNull = (v: unknown) => (typeof v === "string" && v ? v : null);

export interface AuditActor { id: string | null; name: string | null; email: string | null; role: string }
export interface AuditHint { changed: string[]; changed_n: number; fields: Record<string, unknown> }
export interface AuditChange { from: unknown; to: unknown }
export interface AuditDetail {
  fields: Record<string, unknown> | null;
  changes: Record<string, AuditChange> | null;
  snapshot: Record<string, unknown> | null;
  snapshot_of: "before" | "after" | null;
}
export interface AuditItem {
  id: string; source: SourceKey; at: string; actor: AuditActor; action: string; entity_type: string; entity_id: string | null;
  entity_label: string | null; sensitive: boolean; hint: AuditHint; detail: AuditDetail | null; ip: string | null;
}
export interface ActorFacet extends AuditActor { n: number }
export interface AuditOverview { today: number; week: number; actors_week: number; sensitive_week: number; last_at: string | null; total: number }
export interface AuditPage {
  items: AuditItem[]; total: number; sources: Record<SourceFilter, number>;
  entities: { type: string; n: number }[]; actors: ActorFacet[]; overview: AuditOverview | null;
}

const asSource = (v: unknown): SourceKey => (v === "staff" || v === "activity" ? v : "admin");

function parseActor(v: unknown): AuditActor {
  const a = isObj(v) ? v : {};
  return { id: strOrNull(a.id), name: strOrNull(a.name), email: strOrNull(a.email), role: str(a.role) || "seller" };
}

export function parseDetail(v: unknown): AuditDetail | null {
  if (!isObj(v)) return null;
  const changes: Record<string, AuditChange> = {};
  if (isObj(v.changes)) for (const [k, c] of Object.entries(v.changes)) if (isObj(c)) changes[k] = { from: c.from ?? null, to: c.to ?? null };
  return {
    fields: isObj(v.fields) ? v.fields : null,
    changes: isObj(v.changes) ? changes : null,
    snapshot: isObj(v.snapshot) ? v.snapshot : null,
    snapshot_of: v.snapshot_of === "before" ? "before" : v.snapshot_of === "after" ? "after" : null,
  };
}

export function parseItem(r: Record<string, unknown>): AuditItem {
  const h = isObj(r.hint) ? r.hint : {};
  return {
    id: str(r.id), source: asSource(r.source), at: str(r.at), actor: parseActor(r.actor), action: str(r.action), entity_type: str(r.entity_type),
    entity_id: strOrNull(r.entity_id), entity_label: strOrNull(r.entity_label), sensitive: r.sensitive === true,
    hint: { changed: Array.isArray(h.changed) ? h.changed.filter((x): x is string => typeof x === "string") : [], changed_n: num(h.changed_n), fields: isObj(h.fields) ? h.fields : {} },
    detail: parseDetail(r.detail), ip: strOrNull(r.ip),
  };
}

export function parseAuditPage(raw: unknown): AuditPage {
  if (!isObj(raw) || !Array.isArray(raw.items)) throw new Error("Resposta inesperada do servidor.");
  const s = isObj(raw.sources) ? raw.sources : {};
  const ov = isObj(raw.overview) ? raw.overview : null;
  return {
    items: raw.items.filter(isObj).map(parseItem), total: num(raw.total),
    sources: { all: num(s.all), admin: num(s.admin), staff: num(s.staff), activity: num(s.activity) },
    entities: Array.isArray(raw.entities) ? raw.entities.filter(isObj).map((e) => ({ type: str(e.type), n: num(e.n) })).filter((e) => e.type) : [],
    actors: Array.isArray(raw.actors) ? raw.actors.filter(isObj).map((a) => ({ ...parseActor(a), n: num(a.n) })) : [],
    overview: ov ? { today: num(ov.today), week: num(ov.week), actors_week: num(ov.actors_week), sensitive_week: num(ov.sensitive_week), last_at: strOrNull(ov.last_at), total: num(ov.total) } : null,
  };
}

export interface RelatedItem { id: string; source: SourceKey; at: string; action: string; actor_name: string | null }
export interface AuditEntry extends Omit<AuditItem, "hint"> { user_agent: string | null; related: RelatedItem[] }

export function parseAuditEntry(raw: unknown): AuditEntry {
  if (!isObj(raw) || !str(raw.id)) throw new Error("Resposta inesperada do servidor.");
  const base = parseItem({ ...raw, hint: {} });
  const { hint: _hint, ...rest } = base;
  return {
    ...rest, user_agent: strOrNull(raw.user_agent),
    related: Array.isArray(raw.related) ? raw.related.filter(isObj).map((r) => ({ id: str(r.id), source: asSource(r.source), at: str(r.at), action: str(r.action), actor_name: strOrNull(r.actor_name) })) : [],
  };
}

/* ───────── textos: quem, o quê, em quê ───────── */

export const ROLE_LABEL: Record<string, string> = {
  admin: "Administrador", manager: "Gerente", employee: "Equipe", partner: "Sócio", seller: "Vendedor", system: "Automático",
};
export const roleLabel = (r: string) => ROLE_LABEL[r] ?? "Vendedor";

/** Nome de quem fez; conta apagada ou sem cadastro vira "Conta removida" com o início do código. */
export function actorName(a: AuditActor): string {
  if (!a.id) return "Sistema";
  return a.name ?? a.email ?? `Conta removida (${a.id.slice(0, 8)})`;
}

const ENTITY: Record<string, string> = {
  product: "Produto", profile: "Vendedor", profiles: "Vendedor", seller: "Vendedor", user: "Conta", "auth.user": "Conta", auth: "Acesso", session: "Sessão",
  withdrawal: "Saque", withdrawals: "Saque", transaction: "Venda", transactions: "Venda", dispute: "Disputa", disputes: "Disputa",
  acquirer: "Adquirente", platform_settings: "Configurações da plataforma", kill_switches: "Pausas de emergência", fee: "Taxa da plataforma", fees: "Taxas da plataforma",
  custom_user_fees: "Taxas do vendedor", manager_fee_limits: "Limites de taxa dos gerentes", pix_key: "Chave PIX", pix_keys: "Chave PIX", bank_accounts: "Conta bancária",
  revenue_race_override: "Valor fixo da corrida", revenue_race_prize: "Prêmio da corrida", revenue_race_entry: "Valor fixo da corrida", race: "Corrida", race_prize: "Prêmio da corrida", race_entry: "Valor fixo da corrida",
  revenue_goal: "Meta de faturamento", revenue_goal_award: "Prêmio de meta", award_tier: "Peça de premiação", reward_claim: "Pedido de premiação",
  support_ticket: "Chamado de suporte", payment_link: "Link de pagamento", course: "Curso", coupon: "Cupom", subscription_plan: "Plano de assinatura", subscription: "Assinatura",
  affiliate: "Afiliado", referral: "Indicação", notification: "Notificação", error_logs: "Erros do site", global_blacklist: "Lista negra", velocity_rules: "Regra de velocidade",
  abuse_blocks: "IP em quarentena", login_lockout: "Login travado", retention_settings: "Retenção", auto_withdrawal_settings: "Saque automático", seller_auto_withdraw: "Saque automático",
  staff: "Equipe", manager: "Gerente", manager_assignment: "Gerente do vendedor", export: "Exportação",
};
export function entityLabel(type: string): string {
  return ENTITY[type] ?? (type ? type.replace(/[._]+/g, " ").replace(/^./, (c) => c.toUpperCase()) : "Sem tipo");
}

const ID_WORD: Record<string, Record<string, string>> = {
  export: { transactions: "Transações", withdrawals: "Saques", sellers: "Vendedores", audit: "Auditoria" },
  platform_settings: { kill_switches: "Pausas de emergência", payments: "Pagamentos", withdrawals: "Saques", max_ticket: "Limite por venda", require_email_verification: "Confirmação de e-mail" },
};

/** Texto do alvo: o nome quando o servidor achou, senão o tipo e o começo do código. */
export function targetLine(i: { entity_type: string; entity_id: string | null; entity_label: string | null }): { title: string; sub: string | null } {
  const type = entityLabel(i.entity_type);
  if (i.entity_label) return { title: i.entity_label, sub: type };
  const word = i.entity_id ? ID_WORD[i.entity_type]?.[i.entity_id] : undefined;
  if (word) return { title: word, sub: type };
  const id = i.entity_id ? (i.entity_id.length > 14 ? `#${i.entity_id.replace(/-/g, "").slice(0, 8)}` : i.entity_id) : null;
  return { title: type, sub: id };
}

/** Tipos de alvo que a tela mostra com o mesmo nome viram um filtro só (o servidor aceita a lista separada por vírgula). */
export interface EntityGroup { label: string; value: string; n: number }
export function entityGroups(entities: { type: string; n: number }[]): EntityGroup[] {
  const by = new Map<string, { types: string[]; n: number }>();
  for (const e of entities) {
    const label = entityLabel(e.type);
    const g = by.get(label) ?? { types: [], n: 0 };
    g.types.push(e.type); g.n += e.n;
    by.set(label, g);
  }
  return [...by.entries()].map(([label, g]) => ({ label, value: g.types.join(","), n: g.n })).sort((a, b) => b.n - a.n || a.label.localeCompare(b.label, "pt-BR"));
}

const LABELS: Record<string, string> = {
  admin_login: "Entrou no painel", admin_logout: "Saiu do painel", impersonate_user: "Entrou na conta de um vendedor",
  reveal_pii: "Revelou dados pessoais", pii_reveal: "Revelou dados pessoais", pii_reveal_blocked: "Tentou revelar dados pessoais e foi barrado",
  approve_user: "Aprovou o cadastro", block_user: "Bloqueou o cadastro", ban_seller: "Baniu o vendedor",
  approve_kyc: "Aprovou a verificação de identidade", approve_kyc_with_manager: "Aprovou a verificação de identidade", reject_kyc: "Recusou a verificação de identidade",
  freeze_from_radar: "Congelou a conta pelo radar de chargeback", freeze_balance: "Congelou o saldo",
  freeze_staff: "Congelou uma conta da equipe", unfreeze_staff: "Liberou uma conta da equipe", create_staff: "Criou uma conta da equipe", create_partner: "Criou uma conta de sócio",
  reset_staff_password: "Redefiniu a senha de alguém da equipe", update_staff_commission_pct: "Mudou a comissão de alguém da equipe", configure_staff: "Configurou permissões e limites da equipe",
  update_manager_fee_limits: "Mudou os limites de taxa dos gerentes", manager_default_changed: "Mudou o gerente padrão",
  seller_manager_removed: "Tirou o vendedor de um gerente", seller_manager_transferred: "Passou o vendedor para outro gerente",
  set_seller_type: "Mudou o tipo do vendedor", set_seller_acquirer: "Escolheu o adquirente do vendedor", update_custom_fees: "Mudou as taxas do vendedor", custom_fees_reset: "Zerou as taxas individuais",
  platform_fee_update: "Mudou uma taxa da plataforma", set_max_ticket_for_all: "Mudou o limite por venda", max_ticket_set: "Mudou o limite por venda",
  update_retention: "Mudou a retenção do vendedor", card_release_set: "Mudou o prazo do cartão", card_release_clear: "Voltou o prazo do cartão ao padrão",
  update_seller_auto_withdraw: "Mudou o saque automático do vendedor", update_seller_payment_methods: "Mudou os meios de pagamento do vendedor", delete_pix_key: "Apagou uma chave PIX",
  reject_withdrawal: "Recusou um saque", approve_withdrawal: "Aprovou um saque", upload_withdrawal_proof: "Enviou o comprovante de um saque",
  balance_adjustment: "Ajustou o saldo de um vendedor", balance_adjustment_requested: "Pediu um ajuste de saldo", transaction_refund: "Reembolsou uma venda", checkout_delivery_retry: "Refez a entrega de uma compra",
  dispute_open: "Abriu uma disputa", dispute_review: "Colocou uma disputa em análise", dispute_resolve: "Decidiu uma disputa",
  add_blacklist: "Bloqueou na lista negra", add_blacklist_ui: "Bloqueou na lista negra", remove_blacklist: "Tirou da lista negra", blacklist_email: "Bloqueou um e-mail na lista negra",
  update_velocity_rule: "Mudou uma regra de velocidade", update_velocity_rule_ui: "Mudou uma regra de velocidade",
  abuse_block_ip: "Pôs um IP em quarentena", abuse_release_block: "Liberou um IP da quarentena", release_login_lockout: "Liberou um login travado",
  email_verify: "Confirmou o e-mail de uma conta", email_unverify: "Desfez a confirmação do e-mail", email_verification_set: "Mudou a exigência de confirmar o e-mail", update_require_email_verification: "Mudou a exigência de confirmar o e-mail",
  manual_approval_changed: "Mudou a aprovação manual", update_admin_notes: "Atualizou as notas internas do vendedor", seller_note_create: "Escreveu uma nota sobre o vendedor",
  product_classified: "Classificou um produto", product_blocked: "Bloqueou um produto", product_rejected: "Recusou um produto", product_deleted: "Apagou um produto", product_restored: "Restaurou um produto",
  product_active: "Aprovou um produto", product_pending_review: "Colocou um produto em revisão", product_inactive: "Desativou um produto", product_draft: "Voltou um produto para rascunho",
  product_created: "Criou um produto", product_updated: "Editou um produto",
  course_hold: "Tirou um curso do ar", course_release: "Liberou um curso retido", course_created: "Criou um curso", course_updated: "Editou um curso", course_deleted: "Apagou um curso",
  coupon_hold: "Pausou um cupom", coupon_release: "Liberou um cupom retido", plan_hold: "Pausou um plano de assinatura", plan_release: "Liberou um plano retido", subscription_cancel: "Cancelou uma assinatura",
  affiliate_hold: "Pausou um afiliado", affiliate_release: "Liberou um afiliado retido",
  referral_create: "Registrou uma indicação", referral_qualified: "Qualificou uma indicação", referral_paid: "Registrou o pagamento de uma indicação", referral_rejected: "Recusou uma indicação", referral_cancelled: "Cancelou uma indicação",
  ticket_reply: "Respondeu um chamado", reply_ticket: "Respondeu um chamado", ticket_close: "Encerrou um chamado", ticket_reopen: "Reabriu um chamado", ticket_priority: "Mudou a prioridade de um chamado",
  notification_send: "Enviou um aviso", notification_retract: "Recolheu um aviso", notifications_clean: "Apagou notificações lidas",
  error_logs_resolve_all: "Marcou erros do site como resolvidos", error_logs_delete: "Apagou erros resolvidos do site",
  race_create: "Criou uma corrida", race_update: "Editou uma corrida", race_activate: "Colocou uma corrida no ar", race_deactivate: "Tirou uma corrida do ar", race_delete: "Apagou uma corrida",
  race_prize_create: "Criou um prêmio da corrida", race_prize_update: "Editou um prêmio da corrida", race_prize_move: "Moveu um prêmio da corrida", race_prize_delete: "Apagou um prêmio da corrida",
  race_entry_create: "Criou um valor fixo na corrida", race_entry_update: "Editou um valor fixo na corrida", race_entry_delete: "Apagou um valor fixo da corrida",
  update_race_override: "Editou um valor fixo na corrida", update_race_prize: "Editou um prêmio da corrida",
  goal_create: "Criou uma meta", goal_update: "Editou uma meta", goal_delete: "Apagou uma meta",
  award_tier_create: "Criou uma peça de premiação", award_tier_update: "Editou uma peça de premiação", award_tier_move: "Moveu uma peça de premiação", award_tier_delete: "Apagou uma peça de premiação",
  reward_claim_address: "Corrigiu o endereço de um pedido de premiação", reward_claim_note: "Anotou num pedido de premiação",
  data_export: "Exportou dados", audit_export: "Exportou a auditoria", payment_link_admin_status: "Mudou a situação de um link de pagamento", seller_risk_ai_analysis: "Rodou a análise de risco com IA",
  set_acquirer_health: "Mudou a saúde de um adquirente", update_acquirer: "Alterou um adquirente",
  auto_withdrawal_created: "Criou um saque automático", auto_withdrawal_skipped: "Pulou um saque automático", auto_withdrawal_disabled: "Desligou o saque automático", auto_withdrawal_paused: "Pausou o saque automático",
  update_profiles: "Mudou o cadastro de um vendedor", update_withdrawals: "Mudou um saque", update_transactions: "Mudou uma venda", update_disputes: "Mudou uma disputa",
  export_sales: "Exportou vendas",
};

const GENERIC_VERB: Record<string, string> = { insert: "Criou", update: "Mudou", delete: "Apagou" };

/** A ação em frase: "Mudou as taxas do vendedor". O código original fica na ficha. */
export function actionLabel(action: string, entityType = ""): string {
  const key = action.trim().toLowerCase();
  if (LABELS[key]) return LABELS[key];
  const ks = key.match(/^kill_switch_(payments|withdrawals)_(on|off)$/);
  if (ks) return `${ks[2] === "on" ? "Pausou" : "Retomou"} ${ks[1] === "payments" ? "os pagamentos" : "os saques"}`;
  if (key.startsWith("blacklist_")) return "Bloqueou na lista negra";
  const verb = GENERIC_VERB[key];
  if (verb) return entityType ? `${verb} um registro de ${entityLabel(entityType).toLowerCase()}` : `${verb} um registro`;
  return key ? key.replace(/_/g, " ").replace(/^./, (c) => c.toUpperCase()) : "Ação sem nome";
}

/* ───────── campos e valores ───────── */

const FIELD: Record<string, string> = {
  full_name: "Nome", name: "Nome", nickname: "Apelido", email: "E-mail", phone: "Telefone", city: "Cidade", state: "Estado", street: "Rua", street_number: "Número", complement: "Complemento",
  neighborhood: "Bairro", zip_code: "CEP", account_status: "Situação da conta", seller_type: "Tipo de vendedor", frozen: "Conta congelada", balance_frozen: "Saldo congelado",
  pix_enabled: "Pix liberado", boleto_enabled: "Boleto liberado", credit_card_enabled: "Cartão liberado", acquirer_id: "Adquirente", admin_notes: "Notas internas",
  kyc_rejection_reason: "Motivo da recusa da verificação", document_type: "Tipo de documento", document_number_masked: "Documento (final)", pix_key_masked: "Chave PIX (final)", pix_key_type: "Tipo da chave PIX",
  pix_key_id: "Chave PIX", address_locked: "Endereço travado", avatar_url: "Foto", approved_by: "Aprovado por", staff_role_type: "Cargo da equipe", last_login_at: "Último acesso",
  status: "Situação", new_status: "Nova situação", health_status: "Saúde", classification: "Classificação", price: "Preço", description: "Descrição", title: "Título", image_url: "Imagem",
  is_published: "Publicado", checkout_url: "Link do checkout", amount: "Valor", fee_amount: "Taxa", net_amount: "Valor líquido", reason: "Motivo", notes: "Notas", enabled: "Ligado",
  target_amount: "Valor alvo", available_balance: "Saldo disponível", display_name: "Nome exibido", slug: "Apelido interno", type: "Tipo", role: "Função", permissions: "Permissões",
  commission_pct: "Comissão (%)", pct: "Percentual", withdrawal_fee: "Taxa de saque", max_ticket: "Limite por venda", new_value: "Novo valor", cleared_overrides: "Limites individuais apagados",
  pix_percentage: "Pix (%)", pix_fixed: "Pix (fixa)", card_percentage: "Cartão (%)", card_fixed: "Cartão (fixa)", boleto_percentage: "Boleto (%)", boleto_fixed: "Boleto (fixa)",
  api_endpoint: "Endereço da API", api_environment: "Ambiente", webhook_url: "Endereço do webhook", priority: "Prioridade", allow_failover: "Usa reserva", seller_visible: "Visível ao vendedor",
  supported_methods: "Meios aceitos", conversion_rate: "Taxa de conversão", transaction_fee_percentage: "Taxa (%)", transaction_fee_fixed: "Taxa (fixa)", min_transaction_amount: "Valor mínimo", max_transaction_amount: "Valor máximo",
  target_email: "E-mail alvo", verified: "Verificado", format: "Formato", count: "Quantidade", range_from: "De", range_to: "Até", privacy_mode: "Valores ocultos", filtered_by_search: "Com busca",
  document_number: "Documento", document: "Documento", cpf: "CPF", cnpj: "CNPJ", pix_key: "Chave PIX", rows: "Linhas", source: "Origem", days: "Dias", user_id: "Conta", admin_user_id: "Administrador", timestamp: "Horário", revenue_cents: "Faturamento (centavos)", risk_level: "Nível de risco", model: "Modelo",
};
export function fieldLabel(key: string): string {
  return FIELD[key] ?? key.replace(/_/g, " ").replace(/^./, (c) => c.toUpperCase());
}

const VALUE_WORD: Record<string, string> = {
  approved: "Aprovado", pending: "Pendente", pending_review: "Em análise", under_review: "Em análise", rejected: "Recusado", blocked: "Bloqueado", suspended: "Suspenso", banned: "Banido",
  active: "Ativo", inactive: "Inativo", draft: "Rascunho", completed: "Concluído", paid: "Pago", refunded: "Reembolsado", failed: "Falhou", cancelled: "Cancelado", canceled: "Cancelado",
  online: "Online", offline: "Offline", degraded: "Instável", white: "White", gray: "Gray", black: "Black", shipped: "Postado", delivered: "Entregue", preparing: "Em preparo",
  production: "Produção", sandbox: "Teste", pix: "Pix", card: "Cartão", credit_card: "Cartão", boleto: "Boleto", crypto: "Cripto", cpf: "CPF", cnpj: "CNPJ", telefone: "Telefone",
};
const WORD_KEYS = new Set(["status", "new_status", "account_status", "health_status", "classification", "seller_type", "api_environment", "document_type", "pix_key_type", "type", "supported_methods"]);
const MONEY = new Set(["price", "amount", "fee_amount", "net_amount", "target_amount", "available_balance", "max_ticket", "withdrawal_fee", "pix_fixed", "card_fixed", "boleto_fixed", "transaction_fee_fixed", "min_transaction_amount", "max_transaction_amount"]);
const PERCENT = new Set(["pix_percentage", "card_percentage", "boleto_percentage", "transaction_fee_percentage", "commission_pct", "pct", "conversion_rate"]);

export const HIDDEN = "[oculto]";
export const isHidden = (v: unknown) => typeof v === "string" && v.startsWith("[oculto");

const brl = (n: number) => n.toLocaleString("pt-BR", { style: "currency", currency: "BRL" });

/** Valor de um campo em palavras de quem opera (Sim/Não, R$, data de Brasília, situação traduzida). */
export function valueText(key: string, v: unknown): string {
  if (v === null || v === undefined || v === "") return "vazio";
  if (isHidden(v)) return "oculto";
  if (typeof v === "boolean") return v ? "Sim" : "Não";
  if (typeof v === "number") return MONEY.has(key) ? brl(v) : PERCENT.has(key) ? `${v.toLocaleString("pt-BR")}%` : v.toLocaleString("pt-BR");
  if (typeof v === "string") {
    if (/^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}/.test(v)) return fmtDateTime(v);
    if (WORD_KEYS.has(key) && VALUE_WORD[v.toLowerCase()]) return VALUE_WORD[v.toLowerCase()];
    return v.length > 240 ? `${v.slice(0, 240)}…` : v;
  }
  if (Array.isArray(v)) return v.length === 0 ? "vazio" : v.map((x) => (typeof x === "string" && WORD_KEYS.has(key) && VALUE_WORD[x.toLowerCase()] ? VALUE_WORD[x.toLowerCase()] : typeof x === "object" ? JSON.stringify(x) : String(x))).join(", ").slice(0, 240);
  try { const j = JSON.stringify(v); return j.length > 240 ? `${j.slice(0, 240)}…` : j; } catch { return "—"; }
}

const HINT_ORDER = ["reason", "motivo", "title", "name", "display_name", "new_status", "status", "classification", "seller_type", "target_email", "email", "amount", "format", "count"];

/** Uma linha de contexto para a lista: o que mudou ou o dado que mais explica a ação. */
export function hintText(i: Pick<AuditItem, "hint">): string | null {
  const { changed, changed_n, fields } = i.hint;
  if (changed.length > 0) {
    const names = changed.slice(0, 3).map(fieldLabel);
    const more = changed_n - names.length;
    return `Mudou: ${names.join(", ")}${more > 0 ? ` e mais ${more}` : ""}`;
  }
  const keys = Object.keys(fields);
  if (keys.length === 0) return null;
  const key = HINT_ORDER.find((k) => keys.includes(k) && fields[k] !== null && fields[k] !== "") ?? keys[0];
  const text = valueText(key, fields[key]);
  return `${fieldLabel(key)}: ${text.length > 90 ? `${text.slice(0, 90)}…` : text}`;
}

/** Campos da ficha em ordem de leitura (nome do campo, não do banco). */
export function sortedEntries<T>(o: Record<string, T> | null): [string, T][] {
  return o ? Object.entries(o).sort((a, b) => fieldLabel(a[0]).localeCompare(fieldLabel(b[0]), "pt-BR")) : [];
}

export function isEmptyDetail(d: AuditDetail | null): boolean {
  if (!d) return true;
  return !(d.fields && Object.keys(d.fields).length) && !(d.changes && Object.keys(d.changes).length) && !(d.snapshot && Object.keys(d.snapshot).length);
}

/** O detalhe em uma frase só (CSV e relatório). */
export function detailText(d: AuditDetail | null, max = 1500): string {
  if (!d) return "";
  const parts: string[] = [];
  if (d.changes) for (const [k, c] of sortedEntries(d.changes)) parts.push(isHidden(c.from) && isHidden(c.to) ? `${fieldLabel(k)}: mudou (valor oculto)` : `${fieldLabel(k)}: ${valueText(k, c.from)} → ${valueText(k, c.to)}`);
  if (d.fields) for (const [k, v] of sortedEntries(d.fields)) parts.push(`${fieldLabel(k)}: ${valueText(k, v)}`);
  if (d.snapshot) for (const [k, v] of sortedEntries(d.snapshot)) parts.push(`${fieldLabel(k)}: ${valueText(k, v)}`);
  const text = parts.join("; ");
  return text.length > max ? `${text.slice(0, max)}…` : text;
}

/* ───────── resumo do topo ───────── */

export function heroStatus(page: AuditPage | undefined, failed: boolean): { tone: Tone; label: string; pulse?: boolean } {
  const ov = page?.overview;
  if (!ov) return failed ? { tone: "destructive", label: "Não foi possível carregar" } : { tone: "neutral", label: "Carregando…" };
  if (ov.total === 0) return { tone: "neutral", label: "Nenhuma ação registrada" };
  if (ov.today === 0) return { tone: "neutral", label: "Nenhuma ação hoje" };
  return { tone: "info", label: `${ov.today.toLocaleString("pt-BR")} ${ov.today === 1 ? "ação hoje" : "ações hoje"}` };
}

export const plural = (n: number, one: string, many: string) => `${n.toLocaleString("pt-BR")} ${n === 1 ? one : many}`;

/* ───────── exportação ───────── */

interface Column { header: string; value: (r: AuditItem) => unknown }
export const COLUMNS: Column[] = [
  { header: "Data e hora", value: (r) => spDateTime(r.at) },
  { header: "Origem", value: (r) => sourceLabel(r.source) },
  { header: "Responsável", value: (r) => actorName(r.actor) },
  { header: "E-mail do responsável", value: (r) => r.actor.email ?? "" },
  { header: "Função", value: (r) => roleLabel(r.actor.role) },
  { header: "Ação", value: (r) => actionLabel(r.action, r.entity_type) },
  { header: "Código da ação", value: (r) => r.action },
  { header: "Tipo do alvo", value: (r) => entityLabel(r.entity_type) },
  { header: "Alvo", value: (r) => r.entity_label ?? "" },
  { header: "Código do alvo", value: (r) => r.entity_id ?? "" },
  { header: "Sensível", value: (r) => r.sensitive },
  { header: "IP", value: (r) => r.ip ?? "" },
  { header: "Detalhes", value: (r) => detailText(r.detail) },
];

/** Texto do CSV (`;`, quebra de linha do Windows). Texto que começa com = + - @ ganha apóstrofo (vira fórmula no Excel). */
export function toAuditCsv(rows: AuditItem[]): string {
  return [COLUMNS.map((c) => csvCell(c.header)).join(";"), ...rows.map((r) => COLUMNS.map((c) => csvCell(c.value(r))).join(";"))].join("\r\n");
}

export function auditFileName(period: PeriodKey, today = new Date()): string {
  return `auditoria-${period === "all" ? "completa" : period === "1" ? "hoje" : `${period}-dias`}-${spDay(today)}.csv`;
}

/** Texto para colar numa conversa: o que aconteceu, quem fez, em quê e o detalhe. */
export function reportText(e: AuditEntry): string {
  const t = targetLine(e);
  return [
    `${actionLabel(e.action, e.entity_type)} (${e.action})`,
    `Quando: ${spDateTime(e.at)}`,
    `Quem: ${actorName(e.actor)}${e.actor.email ? ` <${e.actor.email}>` : ""} · ${roleLabel(e.actor.role)}`,
    `Em quê: ${t.title}${t.sub ? ` (${t.sub})` : ""}${e.entity_id ? ` · ${e.entity_id}` : ""}`,
    e.ip ? `IP: ${e.ip}` : "",
    detailText(e.detail, 4000) ? `O que mudou: ${detailText(e.detail, 4000)}` : "",
  ].filter(Boolean).join("\n");
}
