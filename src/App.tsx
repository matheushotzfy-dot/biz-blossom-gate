import { ErrorBoundary } from "@/components/ErrorBoundary";
import { Toaster as Sonner } from "@/components/ui/sonner";
import { TooltipProvider } from "@/components/ui/tooltip";
import { QueryClient } from "@tanstack/react-query";
import { PersistQueryClientProvider } from "@tanstack/react-query-persist-client";
import { createSyncStoragePersister } from "@tanstack/query-sync-storage-persister";
import { BrowserRouter, Routes, Route, Navigate } from "react-router-dom";
import { Suspense, lazy } from "react";
import { Loader2 } from "lucide-react";
import Index from "./pages/Index";
import ScrollToTop from "@/components/ScrollToTop";
import { RequireAuth } from "@/hooks/useAuth";
import { RequireAdmin } from "@/hooks/useAdminGuard";
import { RequireManager } from "@/hooks/useManagerGuard";
import { ThemeProvider } from "@/hooks/useTheme";
import { DashboardLayout } from "@/components/layout/DashboardLayout";
import Auth from "./pages/Auth";
import Dashboard from "./pages/Dashboard";
import ImpersonationBanner from "./components/ImpersonationBanner";
import CookieConsent from "./components/CookieConsent";

/**
 * Route-level code splitting.
 * Only the landing page, auth and the seller dashboard ship in the main bundle;
 * every other route is fetched on demand, which keeps the initial payload small.
 */
const AuthCallback = lazy(() => import("./pages/AuthCallback"));
const DocumentacaoPublica = lazy(() => import("./pages/DocumentacaoPublica"));
const PerfilHub = lazy(() => import("./pages/PerfilHub"));
const PremiacoesHub = lazy(() => import("./pages/PremiacoesHub"));
const SaquesHub = lazy(() => import("./pages/financeiro/SaquesHub"));
const ConfigFinanceiro = lazy(() => import("./pages/financeiro/ConfigFinanceiro"));
const Vendas = lazy(() => import("./pages/vendas/Vendas"));
const Produtos = lazy(() => import("./pages/vendas/Produtos"));
const Checkout = lazy(() => import("./pages/vendas/Checkout"));
const CheckoutBuilder = lazy(() => import("./pages/vendas/CheckoutBuilder"));
const ProductEditor = lazy(() => import("./pages/vendas/ProductEditor"));
const IntegracoesHub = lazy(() => import("./pages/IntegracoesHub"));
const Webhooks = lazy(() => import("./pages/vendas/Webhooks"));
const Conteudo = lazy(() => import("./pages/vendas/Conteudo"));
const CourseBuilder = lazy(() => import("./pages/vendas/CourseBuilder"));
const Afiliados = lazy(() => import("./pages/vendas/Afiliados"));
const Coproducoes = lazy(() => import("./pages/vendas/Coproducoes"));
const Cupons = lazy(() => import("./pages/vendas/Cupons"));
const Assinaturas = lazy(() => import("./pages/vendas/Assinaturas"));
const DashboardAfiliado = lazy(() => import("./pages/vendas/DashboardAfiliado"));
const ABTesting = lazy(() => import("./pages/vendas/ABTesting"));
const AutoCupons = lazy(() => import("./pages/vendas/AutoCupons"));
const CalculadoraLucro = lazy(() => import("./pages/vendas/CalculadoraLucro"));
const CheckoutWhatsApp = lazy(() => import("./pages/vendas/CheckoutWhatsApp"));
const FunilVendas = lazy(() => import("./pages/vendas/FunilVendas"));
const LinkPagamento = lazy(() => import("./pages/vendas/LinkPagamento"));
const ProofPopup = lazy(() => import("./pages/vendas/ProofPopup"));
const RecuperacaoWhatsApp = lazy(() => import("./pages/vendas/RecuperacaoWhatsApp"));
const RelatorioChurn = lazy(() => import("./pages/vendas/RelatorioChurn"));
const SmartCheckout = lazy(() => import("./pages/vendas/SmartCheckout"));
const UpsellPosPagamento = lazy(() => import("./pages/vendas/UpsellPosPagamento"));
const Antecipacao = lazy(() => import("./pages/financeiro/Antecipacao"));
const ControleGastos = lazy(() => import("./pages/financeiro/ControleGastos"));
const NotasFiscais = lazy(() => import("./pages/financeiro/NotasFiscais"));
const Taxas = lazy(() => import("./pages/financeiro/Taxas"));
const Suporte = lazy(() => import("./pages/Suporte"));
const Gamificacao = lazy(() => import("./pages/Gamificacao"));
const Marketplace = lazy(() => import("./pages/Marketplace"));
const MemberArea = lazy(() => import("./pages/membros/MemberArea"));
const CoursePage = lazy(() => import("./pages/membros/CoursePage"));
const AdminLogin = lazy(() => import("./pages/admin/AdminLogin"));
const AdminDashboard = lazy(() => import("./pages/admin/AdminDashboard"));
const PublicCheckout = lazy(() => import("./pages/PublicCheckout"));
const PublicPaymentLink = lazy(() => import("./pages/PublicPaymentLink"));
const ImpersonateReceiver = lazy(() => import("./pages/ImpersonateReceiver"));
const NotFound = lazy(() => import("./pages/NotFound"));
const ManagerLogin = lazy(() => import("./pages/manager/ManagerLogin"));
const ManagerDashboard = lazy(() => import("./pages/manager/ManagerDashboard"));
const TermosDeUso = lazy(() => import("./pages/TermosDeUso"));
const PoliticaDePrivacidade = lazy(() => import("./pages/PoliticaDePrivacidade"));
const ThankYou = lazy(() => import("./pages/ThankYou"));
const StatusPage = lazy(() => import("./pages/StatusPage"));
const Certificado = lazy(() => import("./pages/Certificado"));
const MemberAuth = lazy(() => import("./pages/membros/MemberAuth"));
const MemberLayout = lazy(() => import("./pages/membros/MemberLayout"));
const MemberHome = lazy(() => import("./pages/membros/MemberHome"));
const MemberCourse = lazy(() => import("./pages/membros/MemberCourse"));
const CourseAnalytics = lazy(() => import("./pages/membros/CourseAnalytics"));

const queryClient = new QueryClient({
  defaultOptions: {
    queries: {
      retry: 1,
      refetchOnWindowFocus: false,
      staleTime: 2 * 60 * 1000,
      gcTime: 24 * 60 * 60 * 1000, // keep cached data 24h so it persists across tab switches
    },
    mutations: {
      retry: 0,
    },
  },
});

const persister = typeof window !== "undefined"
  ? createSyncStoragePersister({
      storage: window.localStorage,
      key: "venxpay-query-cache",
      throttleTime: 1000,
    })
  : undefined;

const RouteFallback = () => (
  <div className="flex min-h-[60vh] w-full items-center justify-center bg-background">
    <Loader2 className="h-5 w-5 animate-spin text-muted-foreground" aria-label="Carregando" />
  </div>
);

const App = () => (
  <ErrorBoundary>
    <PersistQueryClientProvider
      client={queryClient}
      persistOptions={{
        persister: persister!,
        maxAge: 24 * 60 * 60 * 1000,
        buster: "v1",
      }}
    >
      <ThemeProvider>
        <TooltipProvider>
          <Sonner />
          <BrowserRouter>
            <ImpersonationBanner />
            <ScrollToTop />
            <CookieConsent />

            <Suspense fallback={<RouteFallback />}>
              <Routes>
                <Route path="/auth" element={<Auth />} />
                <Route path="/auth/callback" element={<AuthCallback />} />
                <Route path="/impersonate-receiver" element={<ImpersonateReceiver />} />
                <Route path="/pay/:slug" element={<PublicCheckout />} />
                <Route path="/checkout/:slug" element={<PublicCheckout />} />
                <Route path="/pl/:slug" element={<PublicPaymentLink />} />
                <Route path="/obrigado" element={<ThankYou />} />
                <Route path="/termos-de-uso" element={<TermosDeUso />} />
                <Route path="/politica-de-privacidade" element={<PoliticaDePrivacidade />} />
                <Route path="/status" element={<StatusPage />} />
               <Route path="/documentacao" element={<DocumentacaoPublica />} />
               <Route path="/docs" element={<Navigate to="/documentacao" replace />} />
                <Route path="/certificado/:code" element={<Certificado />} />
                <Route path="/financeiro/identidade" element={<Navigate to="/perfil?tab=identidade" replace />} />
                <Route path="/" element={<Index />} />

                <Route path="/membros-area/login" element={<MemberAuth />} />
                <Route path="/membros-area" element={<MemberLayout />}>
                  <Route index element={<MemberHome />} />
                  <Route path="curso/:courseId" element={<MemberCourse />} />
                </Route>

                <Route path="/admin-matheus" element={<AdminLogin />} />
                <Route path="/admin-matheus/dashboard" element={<RequireAdmin><AdminDashboard /></RequireAdmin>} />
                <Route path="/admin-matheus/configuracoes" element={<Navigate to="/admin-matheus/dashboard?tab=settings" replace />} />

                <Route path="/gerentes" element={<ManagerLogin />} />
                <Route path="/gerentes/dashboard" element={<RequireManager><ManagerDashboard /></RequireManager>} />

                <Route path="/vendas/conteudo/:courseId/analytics" element={<RequireAuth><CourseAnalytics /></RequireAuth>} />
                <Route path="/vendas/conteudo/:courseId/builder" element={<RequireAuth><CourseBuilder /></RequireAuth>} />
                <Route path="/vendas/produtos/:productId/editar" element={<RequireAuth><ProductEditor /></RequireAuth>} />
                <Route path="/vendas/produtos/:productId/checkout-builder" element={<RequireAuth><CheckoutBuilder /></RequireAuth>} />

                <Route
                  element={
                    <RequireAuth>
                      <DashboardLayout />
                    </RequireAuth>
                  }
                >
                  <Route path="/dashboard" element={<Dashboard />} />
                  <Route path="/perfil" element={<PerfilHub />} />
                  {/* /financeiro/identidade já redirecionado na rota pública acima */}
                  <Route path="/premiacoes" element={<PremiacoesHub />} />
                  <Route path="/gamificacao" element={<Gamificacao />} />
                  <Route path="/suporte" element={<Suporte />} />
                  <Route path="/financeiro/extrato" element={<Navigate to="/vendas" replace />} />
                  <Route path="/financeiro/saques" element={<SaquesHub />} />
                  <Route path="/financeiro/config" element={<ConfigFinanceiro />} />
                  <Route path="/vendas" element={<Vendas />} />
                  <Route path="/vendas/produtos" element={<Produtos />} />
                  <Route path="/vendas/checkout" element={<Checkout />} />

                  <Route path="/vendas/conteudo" element={<Conteudo />} />
                  <Route path="/integracoes" element={<IntegracoesHub />} />
                  <Route path="/integracoes/apps" element={<Navigate to="/integracoes?tab=apps" replace />} />
                  <Route path="/integracoes/webhooks" element={<Navigate to="/integracoes?tab=webhooks" replace />} />
                  <Route path="/integracoes/documentacao" element={<Navigate to="/integracoes?tab=api" replace />} />
                  <Route path="/integracoes/credenciais" element={<Navigate to="/integracoes?tab=keys" replace />} />
                  <Route path="/vendas/webhooks" element={<Webhooks />} />
                  <Route path="/vendas/afiliados" element={<Afiliados />} />
                  <Route path="/vendas/cupons" element={<Cupons />} />
                  <Route path="/vendas/coproducoes" element={<Coproducoes />} />
                  <Route path="/vendas/assinaturas" element={<Assinaturas />} />
                  <Route path="/vendas/dashboard-afiliado" element={<DashboardAfiliado />} />
                  <Route path="/vendas/ab-testing" element={<ABTesting />} />

                  <Route path="/vendas/auto-cupons" element={<AutoCupons />} />
                  <Route path="/vendas/calculadora-lucro" element={<CalculadoraLucro />} />
                  <Route path="/vendas/central-ajuda" element={<Navigate to="/suporte" replace />} />
                  <Route path="/vendas/checkout-whatsapp" element={<CheckoutWhatsApp />} />
                  <Route path="/vendas/funil" element={<FunilVendas />} />
                  <Route path="/vendas/link-pagamento" element={<LinkPagamento />} />
                  <Route path="/vendas/prova-social" element={<ProofPopup />} />
                  <Route path="/vendas/recuperacao-whatsapp" element={<RecuperacaoWhatsApp />} />
                  <Route path="/vendas/churn" element={<RelatorioChurn />} />
                  <Route path="/vendas/smart-checkout" element={<SmartCheckout />} />
                  <Route path="/vendas/upsell" element={<UpsellPosPagamento />} />


                  <Route path="/financeiro/antecipacao" element={<Antecipacao />} />
                  <Route path="/financeiro/gastos" element={<ControleGastos />} />
                  <Route path="/financeiro/notas" element={<NotasFiscais />} />
                  <Route path="/financeiro/taxas" element={<Taxas />} />

                  <Route path="/marketplace" element={<Marketplace />} />
                  <Route path="/membros" element={<MemberArea />} />
                  <Route path="/membros/curso/:courseId" element={<CoursePage />} />
                </Route>
                <Route path="*" element={<NotFound />} />
              </Routes>
            </Suspense>
          </BrowserRouter>
        </TooltipProvider>
      </ThemeProvider>
    </PersistQueryClientProvider>
  </ErrorBoundary>
);

export default App;
