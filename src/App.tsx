import { Toaster } from "@/components/ui/toaster";
import { Toaster as Sonner } from "@/components/ui/sonner";
import { TooltipProvider } from "@/components/ui/tooltip";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { BrowserRouter, Routes, Route, Navigate } from "react-router-dom";
import { RequireAuth } from "@/hooks/useAuth";
import { DashboardLayout } from "@/components/layout/DashboardLayout";
import Auth from "./pages/Auth";
import Dashboard from "./pages/Dashboard";
import Extrato from "./pages/financeiro/Extrato";
import Taxas from "./pages/financeiro/Taxas";
import DadosBancarios from "./pages/financeiro/DadosBancarios";
import Identidade from "./pages/financeiro/Identidade";
import Saques from "./pages/financeiro/Saques";
import Vendas from "./pages/vendas/Vendas";
import Produtos from "./pages/vendas/Produtos";
import Checkout from "./pages/vendas/Checkout";
import Cupons from "./pages/vendas/Cupons";
import Webhooks from "./pages/vendas/Webhooks";
import Admin from "./pages/admin/Admin";
import AdminUsuarios from "./pages/admin/AdminUsuarios";
import AdminConfiguracoes from "./pages/admin/AdminConfiguracoes";
import PublicCheckout from "./pages/PublicCheckout";
import NotFound from "./pages/NotFound";

const queryClient = new QueryClient();

const App = () => (
  <QueryClientProvider client={queryClient}>
    <TooltipProvider>
      <Toaster />
      <Sonner />
      <BrowserRouter>
        <Routes>
          <Route path="/auth" element={<Auth />} />
          <Route path="/pay/:slug" element={<PublicCheckout />} />
          <Route path="/" element={<Navigate to="/dashboard" replace />} />
          <Route
            element={
              <RequireAuth>
                <div className="dark">
                  <DashboardLayout />
                </div>
              </RequireAuth>
            }
          >
            <Route path="/dashboard" element={<Dashboard />} />
            <Route path="/financeiro/extrato" element={<Extrato />} />
            <Route path="/financeiro/taxas" element={<Taxas />} />
            <Route path="/financeiro/dados-bancarios" element={<DadosBancarios />} />
            <Route path="/financeiro/identidade" element={<Identidade />} />
            <Route path="/financeiro/saques" element={<Saques />} />
            <Route path="/vendas" element={<Vendas />} />
            <Route path="/vendas/produtos" element={<Produtos />} />
            <Route path="/vendas/checkout" element={<Checkout />} />
            <Route path="/vendas/cupons" element={<Cupons />} />
            <Route path="/vendas/webhooks" element={<Webhooks />} />
            <Route path="/admin" element={<Admin />} />
            <Route path="/admin/usuarios" element={<AdminUsuarios />} />
            <Route path="/admin/configuracoes" element={<AdminConfiguracoes />} />
          </Route>
          <Route path="*" element={<NotFound />} />
        </Routes>
      </BrowserRouter>
    </TooltipProvider>
  </QueryClientProvider>
);

export default App;
