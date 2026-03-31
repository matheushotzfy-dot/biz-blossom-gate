import { ErrorBoundary } from "@/components/ErrorBoundary";
import { Toaster } from "@/components/ui/toaster";
import { Toaster as Sonner } from "@/components/ui/sonner";
import { TooltipProvider } from "@/components/ui/tooltip";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { BrowserRouter, Routes, Route, Navigate } from "react-router-dom";
import { RequireAuth } from "@/hooks/useAuth";
import { RequireAdmin } from "@/hooks/useAdminGuard";
import { RequireManager } from "@/hooks/useManagerGuard";
import { ThemeProvider } from "@/hooks/useTheme";
import { DashboardLayout } from "@/components/layout/DashboardLayout";
import Auth from "./pages/Auth";
import Dashboard from "./pages/Dashboard";
import Perfil from "./pages/Perfil";
import Premiacoes from "./pages/Premiacoes";
import Extrato from "./pages/financeiro/Extrato";

import DadosBancarios from "./pages/financeiro/DadosBancarios";
import Identidade from "./pages/financeiro/Identidade";
import Saques from "./pages/financeiro/Saques";
import SaquesCrypto from "./pages/financeiro/SaquesCrypto";
import Taxas from "./pages/financeiro/Taxas";
import ControleGastos from "./pages/financeiro/ControleGastos";
import Vendas from "./pages/vendas/Vendas";
import Produtos from "./pages/vendas/Produtos";
import Checkout from "./pages/vendas/Checkout";
import CheckoutBuilder from "./pages/vendas/CheckoutBuilder";
import ProductEditor from "./pages/vendas/ProductEditor";

import Webhooks from "./pages/vendas/Webhooks";
import Documentacao from "./pages/vendas/Documentacao";
import ApiDocsComplete from "./pages/vendas/ApiDocsComplete";
import Conteudo from "./pages/vendas/Conteudo";
import CourseBuilder from "./pages/vendas/CourseBuilder";
import Apps from "./pages/vendas/Apps";
import Afiliados from "./pages/vendas/Afiliados";
import Coproducoes from "./pages/vendas/Coproducoes";
import Cupons from "./pages/vendas/Cupons";
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
            <Routes>
              <Route path="/auth" element={<Auth />} />
              <Route path="/pay/:slug" element={<PublicCheckout />} />
              <Route path="/checkout/:slug" element={<PublicCheckout />} />
              <Route path="/" element={<Navigate to="/dashboard" replace />} />
              
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

              {/* User Dashboard */}
              <Route
                element={
                  <RequireAuth>
                    <DashboardLayout />
                  </RequireAuth>
                }
              >
                <Route path="/dashboard" element={<Dashboard />} />
                <Route path="/perfil" element={<Perfil />} />
                <Route path="/premiacoes" element={<Premiacoes />} />
                <Route path="/financeiro/extrato" element={<Extrato />} />
                
                <Route path="/financeiro/dados-bancarios" element={<DadosBancarios />} />
                <Route path="/financeiro/identidade" element={<Identidade />} />
                <Route path="/financeiro/saques" element={<Saques />} />
                <Route path="/financeiro/saques-crypto" element={<SaquesCrypto />} />
                <Route path="/financeiro/taxas" element={<Taxas />} />
                <Route path="/financeiro/gastos" element={<ControleGastos />} />
                <Route path="/vendas" element={<Vendas />} />
                <Route path="/vendas/produtos" element={<Produtos />} />
                <Route path="/vendas/checkout" element={<Checkout />} />
                <Route path="/vendas/produtos/:productId/checkout-builder" element={<CheckoutBuilder />} />
                
                <Route path="/vendas/webhooks" element={<Webhooks />} />
                <Route path="/vendas/documentacao" element={<Documentacao />} />
                <Route path="/vendas/documentacao/completa" element={<Documentacao />} />
                <Route path="/vendas/conteudo" element={<Conteudo />} />
                <Route path="/integracoes/apps" element={<Apps />} />
                <Route path="/vendas/afiliados" element={<Afiliados />} />
                <Route path="/vendas/coproducoes" element={<Coproducoes />} />
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
