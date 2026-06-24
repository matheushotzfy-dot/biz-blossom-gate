import { ErrorBoundary } from "@/components/ErrorBoundary";
import { Toaster as Sonner } from "@/components/ui/sonner";
import { TooltipProvider } from "@/components/ui/tooltip";
import { QueryClient } from "@tanstack/react-query";
import { PersistQueryClientProvider } from "@tanstack/react-query-persist-client";
import { createSyncStoragePersister } from "@tanstack/query-sync-storage-persister";
import { BrowserRouter, Routes, Route, Navigate } from "react-router-dom";
import Index from "./pages/Index";
import ScrollToTop from "@/components/ScrollToTop";
import { RequireAuth } from "@/hooks/useAuth";
import { RequireAdmin } from "@/hooks/useAdminGuard";
import { RequireManager } from "@/hooks/useManagerGuard";
import { ThemeProvider } from "@/hooks/useTheme";
import { DashboardLayout } from "@/components/layout/DashboardLayout";
import Auth from "./pages/Auth";
import AuthCallback from "./pages/AuthCallback";
import Dashboard from "./pages/Dashboard";
import PerfilHub from "./pages/PerfilHub";
import PremiacoesHub from "./pages/PremiacoesHub";
// Extrato removido — consolidado em /vendas
import SaquesHub from "./pages/financeiro/SaquesHub";
import ConfigFinanceiro from "./pages/financeiro/ConfigFinanceiro";
import Vendas from "./pages/vendas/Vendas";
import Produtos from "./pages/vendas/Produtos";
import Checkout from "./pages/vendas/Checkout";
import CheckoutBuilder from "./pages/vendas/CheckoutBuilder";
import ProductEditor from "./pages/vendas/ProductEditor";
import IntegracoesHub from "./pages/IntegracoesHub";
import Conteudo from "./pages/vendas/Conteudo";
import CourseBuilder from "./pages/vendas/CourseBuilder";
import Afiliados from "./pages/vendas/Afiliados";
import Coproducoes from "./pages/vendas/Coproducoes";
import Cupons from "./pages/vendas/Cupons";
import Assinaturas from "./pages/vendas/Assinaturas";
import DashboardAfiliado from "./pages/vendas/DashboardAfiliado";
import ABTesting from "./pages/vendas/ABTesting";
import ApiDocsComplete from "./pages/vendas/ApiDocsComplete";
import AutoCupons from "./pages/vendas/AutoCupons";
import CalculadoraLucro from "./pages/vendas/CalculadoraLucro";
import CentralAjuda from "./pages/vendas/CentralAjuda";
import CheckoutWhatsApp from "./pages/vendas/CheckoutWhatsApp";
import FunilVendas from "./pages/vendas/FunilVendas";
import LinkPagamento from "./pages/vendas/LinkPagamento";
import ProofPopup from "./pages/vendas/ProofPopup";
import RecuperacaoWhatsApp from "./pages/vendas/RecuperacaoWhatsApp";
import RelatorioChurn from "./pages/vendas/RelatorioChurn";
import SmartCheckout from "./pages/vendas/SmartCheckout";
import UpsellPosPagamento from "./pages/vendas/UpsellPosPagamento";
import Adquirente from "./pages/financeiro/Adquirente";
import Antecipacao from "./pages/financeiro/Antecipacao";
import ControleGastos from "./pages/financeiro/ControleGastos";
import NotasFiscais from "./pages/financeiro/NotasFiscais";
import Taxas from "./pages/financeiro/Taxas";
import Suporte from "./pages/Suporte";
// VendasHub deprecated — removed from routes/imports
import Gamificacao from "./pages/Gamificacao";
import Marketplace from "./pages/Marketplace";
import MemberArea from "./pages/membros/MemberArea";
import CoursePage from "./pages/membros/CoursePage";
import AdminLogin from "./pages/admin/AdminLogin";
import AdminDashboard from "./pages/admin/AdminDashboard";

import AdminConfiguracoes from "./pages/admin/AdminConfiguracoes";
import PublicCheckout from "./pages/PublicCheckout";
import ImpersonateReceiver from "./pages/ImpersonateReceiver";
import NotFound from "./pages/NotFound";
import ManagerLogin from "./pages/manager/ManagerLogin";
import ManagerDashboard from "./pages/manager/ManagerDashboard";
import TermosDeUso from "./pages/TermosDeUso";
import PoliticaDePrivacidade from "./pages/PoliticaDePrivacidade";
import ThankYou from "./pages/ThankYou";
import StatusPage from "./pages/StatusPage";
import Certificado from "./pages/Certificado";

import MemberAuth from "./pages/membros/MemberAuth";
import MemberLayout from "./pages/membros/MemberLayout";
import MemberHome from "./pages/membros/MemberHome";
import MemberCourse from "./pages/membros/MemberCourse";
import CourseAnalytics from "./pages/membros/CourseAnalytics";

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
      key: "hotzfy-query-cache",
      throttleTime: 1000,
    })
  : undefined;

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
            <ScrollToTop />
            <Routes>
              <Route path="/auth" element={<Auth />} />
              <Route path="/auth/callback" element={<AuthCallback />} />
              <Route path="/impersonate-receiver" element={<ImpersonateReceiver />} />
              <Route path="/pay/:slug" element={<PublicCheckout />} />
              <Route path="/checkout/:slug" element={<PublicCheckout />} />
              <Route path="/obrigado" element={<ThankYou />} />
              <Route path="/termos-de-uso" element={<TermosDeUso />} />
              <Route path="/politica-de-privacidade" element={<PoliticaDePrivacidade />} />
              <Route path="/status" element={<StatusPage />} />
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
              
              <Route path="/admin-matheus/configuracoes" element={<RequireAdmin><AdminConfiguracoes /></RequireAdmin>} />

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
                <Route path="/integracoes/apps" element={<IntegracoesHub />} />
                <Route path="/integracoes/webhooks" element={<IntegracoesHub />} />
                <Route path="/integracoes/documentacao" element={<IntegracoesHub />} />
                <Route path="/integracoes/credenciais" element={<IntegracoesHub />} />
                <Route path="/vendas/afiliados" element={<Afiliados />} />
                <Route path="/vendas/cupons" element={<Cupons />} />
                <Route path="/vendas/coproducoes" element={<Coproducoes />} />
                <Route path="/vendas/assinaturas" element={<Assinaturas />} />
                <Route path="/vendas/dashboard-afiliado" element={<DashboardAfiliado />} />
                <Route path="/vendas/ab-testing" element={<ABTesting />} />
                <Route path="/vendas/api-docs" element={<ApiDocsComplete />} />
                <Route path="/vendas/auto-cupons" element={<AutoCupons />} />
                <Route path="/vendas/calculadora-lucro" element={<CalculadoraLucro />} />
                <Route path="/vendas/central-ajuda" element={<CentralAjuda />} />
                <Route path="/vendas/checkout-whatsapp" element={<CheckoutWhatsApp />} />
                <Route path="/vendas/funil" element={<FunilVendas />} />
                <Route path="/vendas/link-pagamento" element={<LinkPagamento />} />
                <Route path="/vendas/prova-social" element={<ProofPopup />} />
                <Route path="/vendas/recuperacao-whatsapp" element={<RecuperacaoWhatsApp />} />
                <Route path="/vendas/churn" element={<RelatorioChurn />} />
                <Route path="/vendas/smart-checkout" element={<SmartCheckout />} />
                <Route path="/vendas/upsell" element={<UpsellPosPagamento />} />

                <Route path="/financeiro/adquirente" element={<Adquirente />} />
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
          </BrowserRouter>
        </TooltipProvider>
      </ThemeProvider>
    </PersistQueryClientProvider>
  </ErrorBoundary>
);

export default App;
