import { Toaster } from "@/components/ui/toaster";
import { Toaster as Sonner } from "@/components/ui/sonner";
import { TooltipProvider } from "@/components/ui/tooltip";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { BrowserRouter, Routes, Route, Navigate } from "react-router-dom";
import { RequireAuth } from "@/hooks/useAuth";
import { RequireAdmin } from "@/hooks/useAdminGuard";
import { ThemeProvider } from "@/hooks/useTheme";
import { DashboardLayout } from "@/components/layout/DashboardLayout";
import Auth from "./pages/Auth";
import Dashboard from "./pages/Dashboard";
import Perfil from "./pages/Perfil";
import Extrato from "./pages/financeiro/Extrato";

import DadosBancarios from "./pages/financeiro/DadosBancarios";
import Identidade from "./pages/financeiro/Identidade";
import Saques from "./pages/financeiro/Saques";
import Vendas from "./pages/vendas/Vendas";
import Produtos from "./pages/vendas/Produtos";
import Checkout from "./pages/vendas/Checkout";
import Cupons from "./pages/vendas/Cupons";
import Webhooks from "./pages/vendas/Webhooks";
import Documentacao from "./pages/vendas/Documentacao";
import Conteudo from "./pages/vendas/Conteudo";
import MemberArea from "./pages/membros/MemberArea";
import CoursePage from "./pages/membros/CoursePage";
import AdminLogin from "./pages/admin/AdminLogin";
import AdminDashboard from "./pages/admin/AdminDashboard";
import AdminAuditoria from "./pages/admin/AdminAuditoria";
import AdminConfiguracoes from "./pages/admin/AdminConfiguracoes";
import PublicCheckout from "./pages/PublicCheckout";
import NotFound from "./pages/NotFound";

const queryClient = new QueryClient();

const App = () => (
  <QueryClientProvider client={queryClient}>
    <ThemeProvider>
      <TooltipProvider>
        <Toaster />
        <Sonner />
        <BrowserRouter>
          <Routes>
            <Route path="/auth" element={<Auth />} />
            <Route path="/pay/:slug" element={<PublicCheckout />} />
            <Route path="/" element={<Navigate to="/dashboard" replace />} />
            
            {/* Admin Master — server-side role verification */}
            <Route path="/admin-matheus" element={<AdminLogin />} />
            <Route path="/admin-matheus/dashboard" element={<RequireAdmin><AdminDashboard /></RequireAdmin>} />
            <Route path="/admin-matheus/auditoria" element={<RequireAdmin><AdminAuditoria /></RequireAdmin>} />
            <Route path="/admin-matheus/configuracoes" element={<RequireAdmin><AdminConfiguracoes /></RequireAdmin>} />

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
              <Route path="/financeiro/extrato" element={<Extrato />} />
              
              <Route path="/financeiro/dados-bancarios" element={<DadosBancarios />} />
              <Route path="/financeiro/identidade" element={<Identidade />} />
              <Route path="/financeiro/saques" element={<Saques />} />
              <Route path="/vendas" element={<Vendas />} />
              <Route path="/vendas/produtos" element={<Produtos />} />
              <Route path="/vendas/checkout" element={<Checkout />} />
              <Route path="/vendas/cupons" element={<Cupons />} />
              <Route path="/vendas/webhooks" element={<Webhooks />} />
              <Route path="/vendas/documentacao" element={<Documentacao />} />
              <Route path="/vendas/conteudo" element={<Conteudo />} />
              <Route path="/membros" element={<MemberArea />} />
              <Route path="/membros/curso/:courseId" element={<CoursePage />} />
            </Route>
            <Route path="*" element={<NotFound />} />
          </Routes>
        </BrowserRouter>
      </TooltipProvider>
    </ThemeProvider>
  </QueryClientProvider>
);

export default App;
