import { ErrorBoundary } from "@/components/ErrorBoundary";
import { Toaster } from "@/components/ui/toaster";
import { Toaster as Sonner } from "@/components/ui/sonner";
import { TooltipProvider } from "@/components/ui/tooltip";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { BrowserRouter, Routes, Route } from "react-router-dom";
import Index from "./pages/Index";
import ScrollToTop from "@/components/ScrollToTop";
import { RequireAuth } from "@/hooks/useAuth";
import { RequireAdmin } from "@/hooks/useAdminGuard";
import { RequireManager } from "@/hooks/useManagerGuard";
import { ThemeProvider } from "@/hooks/useTheme";
import { DashboardLayout } from "@/components/layout/DashboardLayout";
import Auth from "./pages/Auth";
import Dashboard from "./pages/Dashboard";
import PerfilHub from "./pages/PerfilHub";
import PremiacoesHub from "./pages/PremiacoesHub";
import Extrato from "./pages/financeiro/Extrato";
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
import Suporte from "./pages/Suporte";
import VendasHub from "./pages/VendasHub";
import Gamificacao from "./pages/Gamificacao";
import Marketplace from "./pages/Marketplace";
import MemberArea from "./pages/membros/MemberArea";
import CoursePage from "./pages/membros/CoursePage";
import AdminLogin from "./pages/admin/AdminLogin";
import AdminDashboard from "./pages/admin/AdminDashboard";
import AdminAuditoria from "./pages/admin/AdminAuditoria";
import AdminConfiguracoes from "./pages/admin/AdminConfiguracoes";
import PublicCheckout from "./pages/PublicCheckout";
import NotFound from "./pages/NotFound";
import ManagerLogin from "./pages/manager/ManagerLogin";
import ManagerDashboard from "./pages/manager/ManagerDashboard";
import TermosDeUso from "./pages/TermosDeUso";
import PoliticaDePrivacidade from "./pages/PoliticaDePrivacidade";
import ThankYou from "./pages/ThankYou";
import StatusPage from "./pages/StatusPage";

// Member Area (standalone, Netflix-style)
import MemberAuth from "./pages/membros/MemberAuth";
import MemberLayout from "./pages/membros/MemberLayout";
import MemberHome from "./pages/membros/MemberHome";
import MemberCourse from "./pages/membros/MemberCourse";

const queryClient = new QueryClient({
  defaultOptions: {
    queries: {
      retry: 1,
      refetchOnWindowFocus: false,
      staleTime: 2 * 60 * 1000,
    },
    mutations: {
      retry: 0,
    },
  },
});

const App = () => (
  <ErrorBoundary>
    <QueryClientProvider client={queryClient}>
      <ThemeProvider>
        <TooltipProvider>
          <Toaster />
          <Sonner />
          <BrowserRouter>
            <ScrollToTop />
            <Routes>
              <Route path="/auth" element={<Auth />} />
              <Route path="/pay/:slug" element={<PublicCheckout />} />
              <Route path="/checkout/:slug" element={<PublicCheckout />} />
              <Route path="/obrigado" element={<ThankYou />} />
              <Route path="/termos-de-uso" element={<TermosDeUso />} />
              <Route path="/politica-de-privacidade" element={<PoliticaDePrivacidade />} />
              <Route path="/status" element={<StatusPage />} />
              <Route path="/" element={<Index />} />
              
              {/* Public Member Area (standalone, Netflix-style) */}
              <Route path="/membros-area/login" element={<MemberAuth />} />
              <Route path="/membros-area" element={<MemberLayout />}>
                <Route index element={<MemberHome />} />
                <Route path="curso/:courseId" element={<MemberCourse />} />
              </Route>

              {/* Admin Master — server-side role verification */}
              <Route path="/admin-matheus" element={<AdminLogin />} />
              <Route path="/admin-matheus/dashboard" element={<RequireAdmin><AdminDashboard /></RequireAdmin>} />
              <Route path="/admin-matheus/auditoria" element={<RequireAdmin><AdminAuditoria /></RequireAdmin>} />
              <Route path="/admin-matheus/configuracoes" element={<RequireAdmin><AdminConfiguracoes /></RequireAdmin>} />

              {/* Manager Panel */}
              <Route path="/gerentes" element={<ManagerLogin />} />
              <Route path="/gerentes/dashboard" element={<RequireManager><ManagerDashboard /></RequireManager>} />

              {/* Standalone full-screen pages (outside dashboard layout) */}
              <Route path="/vendas/conteudo/:courseId/builder" element={<RequireAuth><CourseBuilder /></RequireAuth>} />
              <Route path="/vendas/produtos/:productId/editar" element={<RequireAuth><ProductEditor /></RequireAuth>} />
              <Route path="/vendas/produtos/:productId/checkout-builder" element={<RequireAuth><CheckoutBuilder /></RequireAuth>} />

              {/* User Dashboard */}
              <Route
                element={
                  <RequireAuth>
                    <DashboardLayout />
                  </RequireAuth>
                }
              >
                <Route path="/dashboard" element={<Dashboard />} />
                <Route path="/perfil" element={<PerfilHub />} />
                <Route path="/premiacoes" element={<PremiacoesHub />} />
                <Route path="/gamificacao" element={<Gamificacao />} />
                <Route path="/suporte" element={<Suporte />} />
                <Route path="/financeiro/extrato" element={<Extrato />} />
                <Route path="/financeiro/saques" element={<SaquesHub />} />
                <Route path="/financeiro/config" element={<ConfigFinanceiro />} />
                <Route path="/vendas" element={<Vendas />} />
                <Route path="/vendas/produtos" element={<Produtos />} />
                <Route path="/vendas/checkout" element={<Checkout />} />
                
                <Route path="/vendas/conteudo" element={<Conteudo />} />
                <Route path="/integracoes" element={<IntegracoesHub />} />
                {/* <Route path="/otimizacao" element={<VendasHub />} /> */}
                <Route path="/vendas/afiliados" element={<Afiliados />} />
                <Route path="/vendas/cupons" element={<Cupons />} />
                <Route path="/vendas/coproducoes" element={<Coproducoes />} />
                <Route path="/vendas/assinaturas" element={<Assinaturas />} />
                <Route path="/vendas/dashboard-afiliado" element={<DashboardAfiliado />} />
                
                <Route path="/marketplace" element={<Marketplace />} />
                <Route path="/membros" element={<MemberArea />} />
                <Route path="/membros/curso/:courseId" element={<CoursePage />} />
              </Route>
              <Route path="*" element={<NotFound />} />
            </Routes>
          </BrowserRouter>
        </TooltipProvider>
      </ThemeProvider>
    </QueryClientProvider>
  </ErrorBoundary>
);

export default App;
