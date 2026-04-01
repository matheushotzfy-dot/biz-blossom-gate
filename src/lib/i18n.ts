/**
 * Lightweight i18n system — no external dependency.
 * Uses a simple key-value dictionary per locale.
 */

export type Locale = "pt" | "en" | "es";

const translations: Record<Locale, Record<string, string>> = {
  pt: {
    "nav.dashboard": "Dashboard",
    "nav.sales": "Minhas Vendas",
    "nav.products": "Produtos",
    "nav.affiliates": "Afiliados",
    "nav.subscriptions": "Assinaturas",
    "nav.content": "Conteúdo",
    "nav.statement": "Extrato",
    "nav.withdrawals_pix": "Saques PIX",
    "nav.withdrawals_crypto": "Saques Crypto",
    "nav.bank_data": "Dados Bancários",
    "nav.fees": "Taxas",
    "nav.expenses": "Controle de Gastos",
    "nav.anticipation": "Antecipação",
    "nav.webhooks": "Webhooks",
    "nav.integrations": "Integrações",
    "nav.api_docs": "API Docs",
    "nav.identity": "Identidade",
    "nav.profile": "Meu Perfil",
    "nav.purchases": "Minhas Compras",
    "nav.rewards": "Premiações",
    "nav.analytics": "Analytics",
    "nav.referrals": "Indicações",
    "nav.logout": "Sair da conta",
    "dash.revenue": "Faturamento",
    "dash.balance": "Saldo Disponível",
    "dash.approved": "Aprovadas",
    "dash.pending": "Pendentes",
    "dash.refunded": "Reembolsadas",
    "dash.chargebacks": "Chargebacks",
    "dash.conversion": "Conversão",
    "dash.today": "Hoje",
    "dash.yesterday": "Ontem",
    "dash.7days": "7 dias",
    "dash.15days": "15 dias",
    "dash.30days": "30 dias",
    "common.save": "Salvar",
    "common.cancel": "Cancelar",
    "common.delete": "Excluir",
    "common.edit": "Editar",
    "common.create": "Criar",
    "common.search": "Buscar",
    "common.loading": "Carregando...",
    "common.no_data": "Nenhum dado encontrado",
    "common.confirm": "Confirmar",
    "common.back": "Voltar",
    "common.next": "Próximo",
    "common.close": "Fechar",
    "checkout.buy_now": "Comprar Agora",
    "checkout.secure_payment": "Pagamento 100% Seguro",
    "checkout.guarantee": "Garantia de 7 dias",
  },
  en: {
    "nav.dashboard": "Dashboard",
    "nav.sales": "My Sales",
    "nav.products": "Products",
    "nav.affiliates": "Affiliates",
    "nav.subscriptions": "Subscriptions",
    "nav.content": "Content",
    "nav.statement": "Statement",
    "nav.withdrawals_pix": "PIX Withdrawals",
    "nav.withdrawals_crypto": "Crypto Withdrawals",
    "nav.bank_data": "Bank Details",
    "nav.fees": "Fees",
    "nav.expenses": "Expense Tracker",
    "nav.anticipation": "Anticipation",
    "nav.webhooks": "Webhooks",
    "nav.integrations": "Integrations",
    "nav.api_docs": "API Docs",
    "nav.identity": "Identity",
    "nav.profile": "My Profile",
    "nav.purchases": "My Purchases",
    "nav.rewards": "Rewards",
    "nav.analytics": "Analytics",
    "nav.referrals": "Referrals",
    "nav.logout": "Log out",
    "dash.revenue": "Revenue",
    "dash.balance": "Available Balance",
    "dash.approved": "Approved",
    "dash.pending": "Pending",
    "dash.refunded": "Refunded",
    "dash.chargebacks": "Chargebacks",
    "dash.conversion": "Conversion",
    "dash.today": "Today",
    "dash.yesterday": "Yesterday",
    "dash.7days": "7 days",
    "dash.15days": "15 days",
    "dash.30days": "30 days",
    "common.save": "Save",
    "common.cancel": "Cancel",
    "common.delete": "Delete",
    "common.edit": "Edit",
    "common.create": "Create",
    "common.search": "Search",
    "common.loading": "Loading...",
    "common.no_data": "No data found",
    "common.confirm": "Confirm",
    "common.back": "Back",
    "common.next": "Next",
    "common.close": "Close",
    "checkout.buy_now": "Buy Now",
    "checkout.secure_payment": "100% Secure Payment",
    "checkout.guarantee": "7-day guarantee",
  },
  es: {
    "nav.dashboard": "Panel",
    "nav.sales": "Mis Ventas",
    "nav.products": "Productos",
    "nav.affiliates": "Afiliados",
    "nav.subscriptions": "Suscripciones",
    "nav.content": "Contenido",
    "nav.statement": "Extracto",
    "nav.withdrawals_pix": "Retiros PIX",
    "nav.withdrawals_crypto": "Retiros Crypto",
    "nav.bank_data": "Datos Bancarios",
    "nav.fees": "Tarifas",
    "nav.expenses": "Control de Gastos",
    "nav.anticipation": "Anticipación",
    "nav.webhooks": "Webhooks",
    "nav.integrations": "Integraciones",
    "nav.api_docs": "Docs API",
    "nav.identity": "Identidad",
    "nav.profile": "Mi Perfil",
    "nav.purchases": "Mis Compras",
    "nav.rewards": "Premios",
    "nav.analytics": "Analíticas",
    "nav.referrals": "Referidos",
    "nav.logout": "Cerrar sesión",
    "dash.revenue": "Ingresos",
    "dash.balance": "Saldo Disponible",
    "dash.approved": "Aprobadas",
    "dash.pending": "Pendientes",
    "dash.refunded": "Reembolsadas",
    "dash.chargebacks": "Contracargos",
    "dash.conversion": "Conversión",
    "dash.today": "Hoy",
    "dash.yesterday": "Ayer",
    "dash.7days": "7 días",
    "dash.15days": "15 días",
    "dash.30days": "30 días",
    "common.save": "Guardar",
    "common.cancel": "Cancelar",
    "common.delete": "Eliminar",
    "common.edit": "Editar",
    "common.create": "Crear",
    "common.search": "Buscar",
    "common.loading": "Cargando...",
    "common.no_data": "No se encontraron datos",
    "common.confirm": "Confirmar",
    "common.back": "Volver",
    "common.next": "Siguiente",
    "common.close": "Cerrar",
    "checkout.buy_now": "Comprar Ahora",
    "checkout.secure_payment": "Pago 100% Seguro",
    "checkout.guarantee": "Garantía de 7 días",
  },
};

let currentLocale: Locale = (() => {
  try {
    const stored = localStorage.getItem("app_locale");
    if (stored && (stored === "pt" || stored === "en" || stored === "es")) return stored;
  } catch {}
  return "pt";
})();

const listeners = new Set<() => void>();

export function getLocale(): Locale {
  return currentLocale;
}

export function setLocale(locale: Locale) {
  currentLocale = locale;
  try { localStorage.setItem("app_locale", locale); } catch {}
  listeners.forEach(fn => fn());
}

export function t(key: string): string {
  return translations[currentLocale]?.[key] || translations.pt[key] || key;
}

export function onLocaleChange(fn: () => void) {
  listeners.add(fn);
  return () => { listeners.delete(fn); };
}

export const AVAILABLE_LOCALES: { code: Locale; label: string; flag: string }[] = [
  { code: "pt", label: "Português", flag: "🇧🇷" },
  { code: "en", label: "English", flag: "🇺🇸" },
  { code: "es", label: "Español", flag: "🇪🇸" },
];
