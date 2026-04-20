import { useState } from "react";
import {
 LayoutDashboard, ShoppingCart, Package, Wallet, MoreHorizontal,
 Layers, Trophy, Users, Ticket, Repeat,
 Building2, GraduationCap, User, LogOut, X,
 FileText, Puzzle, FlaskConical, MessageSquare, Store, TrendingUp,
} from "lucide-react";
import { NavLink, useLocation, useNavigate } from "react-router-dom";
import { cn } from "@/lib/utils";
import { supabase } from "@/integrations/supabase/client";

const tabs = [
 { label: "Home", icon: LayoutDashboard, path: "/dashboard" },
 { label: "Vendas", icon: ShoppingCart, path: "/vendas" },
 { label: "Produtos", icon: Package, path: "/vendas/produtos" },
 { label: "Saques", icon: Wallet, path: "/financeiro/saques" },
 { label: "Mais", icon: MoreHorizontal, path: "__more__" },
];

const moreGroups = [
 {
 label: "Infoprodutos",
 items: [
 { title: "Conteúdo", url: "/vendas/conteudo", icon: Layers },
 { title: "Afiliados", url: "/vendas/afiliados", icon: Users },
 { title: "Cupons", url: "/vendas/cupons", icon: Ticket },
 { title: "Assinaturas", url: "/vendas/assinaturas", icon: Repeat },
 { title: "Marketplace", url: "/marketplace", icon: Store },
 ],
 },
 {
 label: "Financeiro",
 items: [
 { title: "Extrato", url: "/financeiro/extrato", icon: FileText },
 { title: "Config", url: "/financeiro/config", icon: Building2 },
 ],
 },
 {
 label: "Ferramentas",
 items: [
 // { title: "Otimização", url: "/otimizacao", icon: FlaskConical },
 { title: "Integrações", url: "/integracoes", icon: Puzzle },
 ],
 },
 {
 label: "Conta",
 items: [
 { title: "Perfil", url: "/perfil", icon: User },
 { title: "Compras", url: "/membros", icon: GraduationCap },
 { title: "Premiações", url: "/premiacoes", icon: Trophy },
 { title: "Suporte", url: "/suporte", icon: MessageSquare },
 ],
 },
];

export function MobileBottomNav() {
 const location = useLocation();
 const navigate = useNavigate();
 const [moreOpen, setMoreOpen] = useState(false);

 const handleLogout = async () => {
 await supabase.auth.signOut();
 navigate("/auth");
 };

 return (
 <>
 {/* ═══ "More" bottom sheet ═══ */}
 {moreOpen && (
 <div className="fixed inset-0 z-[60] md:hidden">
 <div className="absolute inset-0 bg-background/80" onClick={() => setMoreOpen(false)} />
 <div className="absolute bottom-0 left-0 right-0 bg-card border-t border-border rounded-t-[28px] max-h-[80vh] overflow-y-auto shadow-2xl animate-slide-up">
 {/* Handle */}
 <div className="flex justify-center pt-3 pb-1">
 <div className="h-1 w-10 rounded-full bg-border/60" />
 </div>
 {/* Header */}
 <div className="flex items-center justify-between px-5 pt-1 pb-3">
 <h2 className="text-base font-display font-black text-foreground">Menu</h2>
 <button
 onClick={() => setMoreOpen(false)}
 className="h-8 w-8 rounded-full flex items-center justify-center bg-muted/40 active:scale-95 transition-transform"
 >
 <X className="h-3.5 w-3.5 text-muted-foreground" />
 </button>
 </div>
 {/* Groups */}
 <div className="px-4 pb-8 space-y-4">
 {moreGroups.map((group) => (
 <div key={group.label}>
 <p className="text-[9px] uppercase tracking-[0.2em] text-muted-foreground/60 font-bold px-1 mb-1.5">{group.label}</p>
 <div className="grid grid-cols-4 gap-1.5">
 {group.items.map((item) => {
 const isActive = location.pathname === item.url;
 return (
 <NavLink
 key={item.url}
 to={item.url}
 onClick={() => setMoreOpen(false)}
 className={cn(
 "flex flex-col items-center gap-1 py-2.5 px-1 rounded-xl transition-all text-center active:scale-[0.97]",
 isActive
 ? "bg-primary/10 text-primary"
 : "text-muted-foreground hover:bg-muted/30"
 )}
 >
  <div className={cn(
  "h-8 w-8 rounded-lg flex items-center justify-center",
  isActive ? "bg-primary/15" : "bg-muted/40"
  )}>
  <item.icon className="h-3.5 w-3.5" />
  </div>
 <span className="text-[9px] font-semibold leading-tight truncate w-full">{item.title}</span>
 </NavLink>
 );
 })}
 </div>
 </div>
 ))}
 {/* Logout */}
 <button
 onClick={handleLogout}
 className="flex items-center justify-center gap-2 w-full py-3 rounded-xl text-destructive bg-destructive/8 border border-destructive/15 text-xs font-bold mt-2 active:scale-[0.98] transition-transform"
 >
 <LogOut className="h-3.5 w-3.5" /> Sair da conta
 </button>
 </div>
 </div>
 </div>
 )}

 {/* ═══ Bottom Tab Bar ═══ */}
 <nav className="fixed bottom-0 left-0 right-0 z-50 md:hidden">
 <div className="bg-background/90 backdrop-blur-xl border-t border-border/50">
 <div className="flex items-center justify-around px-1 pb-[env(safe-area-inset-bottom,0px)]">
 {tabs.map((tab) => {
 const isMore = tab.path === "__more__";
 const isActive = isMore
 ? moreOpen
 : location.pathname === tab.path ||
 (tab.path !== "/dashboard" && location.pathname.startsWith(tab.path));
 return (
 <button
 key={tab.path}
 onClick={() => {
 if (isMore) { setMoreOpen(!moreOpen); }
 else { setMoreOpen(false); navigate(tab.path); }
 }}
 className={cn(
 "flex flex-col items-center gap-0.5 py-2 px-3 min-w-[52px] active:scale-[0.92] transition-all duration-150",
 isActive ? "text-primary" : "text-muted-foreground/80"
 )}
 >
 <div className={cn(
 "h-7 w-7 rounded-lg flex items-center justify-center transition-all duration-200",
 isActive && "bg-primary/15 shadow-[0_0_15px_rgba(var(--primary),0.25)]"
 )}>
 <tab.icon className={cn("h-[17px] w-[17px]", isActive && "stroke-[2.5]")} />
 </div>
 <span className={cn(
 "text-[9px] font-medium",
 isActive && "font-bold text-primary"
 )}>
 {tab.label}
 </span>
 </button>
 );
 })}
 </div>
 </div>
 </nav>
 </>
 );
}
