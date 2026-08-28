/**
 * Route prefetching.
 *
 * As rotas do app usam code splitting (React.lazy). Sem prefetch, cada troca de
 * aba baixa o chunk no momento do clique — é isso que causa a sensação de
 * "fica só carregando". Aqui pré-carregamos os chunks:
 *  - no hover/touch do item da sidebar (prefetchRoute)
 *  - em segundo plano quando o browser está ocioso (prefetchIdleRoutes)
 *
 * Os specifiers são idênticos aos de App.tsx, então o Vite resolve para o
 * MESMO chunk — o prefetch apenas aquece o cache do módulo.
 */

type Loader = () => Promise<unknown>;

export const routeLoaders: Record<string, Loader> = {
  "/vendas": () => import("@/pages/vendas/Vendas"),
  "/vendas/produtos": () => import("@/pages/vendas/Produtos"),
  "/vendas/checkout": () => import("@/pages/vendas/Checkout"),
  "/vendas/conteudo": () => import("@/pages/vendas/Conteudo"),
  "/vendas/afiliados": () => import("@/pages/vendas/Afiliados"),
  "/vendas/cupons": () => import("@/pages/vendas/Cupons"),
  "/vendas/coproducoes": () => import("@/pages/vendas/Coproducoes"),
  "/vendas/assinaturas": () => import("@/pages/vendas/Assinaturas"),
  "/vendas/link-pagamento": () => import("@/pages/vendas/LinkPagamento"),
  "/financeiro/saques": () => import("@/pages/financeiro/SaquesHub"),
  "/financeiro/taxas": () => import("@/pages/financeiro/Taxas"),
  "/financeiro/antecipacao": () => import("@/pages/financeiro/Antecipacao"),
  "/financeiro/gastos": () => import("@/pages/financeiro/ControleGastos"),
  "/financeiro/notas": () => import("@/pages/financeiro/NotasFiscais"),
  "/integracoes": () => import("@/pages/IntegracoesHub"),
  "/premiacoes": () => import("@/pages/PremiacoesHub"),
  "/gamificacao": () => import("@/pages/Gamificacao"),
  "/marketplace": () => import("@/pages/Marketplace"),
  "/perfil": () => import("@/pages/PerfilHub"),
  "/suporte": () => import("@/pages/Suporte"),
};

/** Rotas priorizadas no prefetch ocioso (as mais acessadas). */
const IDLE_PRIORITY = [
  "/vendas",
  "/vendas/produtos",
  "/financeiro/saques",
  "/integracoes",
  "/perfil",
  "/vendas/link-pagamento",
  "/financeiro/taxas",
  "/premiacoes",
];

const started = new Set<string>();

function resolveLoader(path: string): Loader | undefined {
  if (routeLoaders[path]) return routeLoaders[path];
  // fallback: match do prefixo mais longo (ex.: /vendas/produtos/123/editar)
  const key = Object.keys(routeLoaders)
    .filter((k) => path.startsWith(k))
    .sort((a, b) => b.length - a.length)[0];
  return key ? routeLoaders[key] : undefined;
}

/** Pré-carrega o chunk de uma rota. Seguro para chamar várias vezes. */
export function prefetchRoute(path: string): void {
  if (typeof window === "undefined" || !path) return;
  const loader = resolveLoader(path);
  if (!loader || started.has(path)) return;
  started.add(path);
  // Falha de rede aqui não pode quebrar a navegação — o lazy tenta de novo.
  loader().catch(() => started.delete(path));
}

/** Pré-carrega as rotas mais usadas quando o browser estiver ocioso. */
export function prefetchIdleRoutes(): void {
  if (typeof window === "undefined") return;
  const schedule = (cb: () => void, delay: number) => {
    const ric = (window as unknown as { requestIdleCallback?: (fn: () => void) => void })
      .requestIdleCallback;
    if (ric) ric(() => cb());
    else window.setTimeout(cb, delay);
  };
  IDLE_PRIORITY.forEach((path, index) => {
    // escalonado para não competir com o carregamento inicial
    schedule(() => prefetchRoute(path), 600 + index * 250);
  });
}
