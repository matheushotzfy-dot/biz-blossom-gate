import { useLocation, Link } from "react-router-dom";
import { Home, ArrowLeft, Search, Rocket } from "lucide-react";
import { Button } from "@/components/ui/button";

const NotFound = () => {
 const location = useLocation();

 return (
 <div className="flex min-h-screen items-center justify-center bg-background relative overflow-hidden">
 {/* Ambient glow */}
 <div className="pointer-events-none absolute inset-0">


 </div>

 <div className="relative z-10 text-center px-6 max-w-lg">
 {/* 404 Number */}
 <div className="relative mb-6">
 <h1 className="text-[140px] md:text-[180px] font-display font-black leading-none tracking-[-0.06em] text-foreground/[0.04] select-none">
 404
 </h1>
 <div className="absolute inset-0 flex items-center justify-center">
 <div className="h-24 w-24 rounded-3xl bg-primary/10 border border-primary/20 flex items-center justify-center shadow-2xl shadow-primary/10">
 <Search className="h-10 w-10 text-primary/60" />
 </div>
 </div>
 </div>

 {/* Text */}
 <h2 className="text-2xl md:text-3xl font-display font-black text-foreground tracking-[-0.03em] mb-3">
 Página não encontrada
 </h2>
 <p className="text-sm text-muted-foreground/70 mb-2 leading-relaxed max-w-sm mx-auto">
 A página <span className="font-mono text-xs bg-muted/50 px-2 py-0.5 rounded-lg text-foreground/60">{location.pathname}</span> não existe ou foi removida.
 </p>
 <p className="text-[12px] text-muted-foreground/40 mb-8">
 Verifique o endereço ou volte para o painel principal.
 </p>

 {/* Actions */}
 <div className="flex flex-col sm:flex-row items-center justify-center gap-3">
 <Button asChild className="gap-2 rounded-xl h-11 px-6 font-bold shadow-lg shadow-primary/20">
 <Link to="/dashboard">
 <Home className="h-4 w-4" /> Ir ao Dashboard
 </Link>
 </Button>
 <Button asChild variant="outline" className="gap-2 rounded-xl h-11 px-6 font-bold border-border/50">
 <Link to="/auth">
 <ArrowLeft className="h-4 w-4" /> Voltar ao Login
 </Link>
 </Button>
 </div>

 {/* Footer */}
 <div className="mt-12 flex items-center justify-center gap-2 text-muted-foreground/30">
 <div className="h-6 w-6 rounded-lg bg-primary/10 flex items-center justify-center">
 <Rocket className="h-3 w-3 text-primary/50" />
 </div>
 <span className="text-[11px] font-bold tracking-wider">HOTZFY</span>
 </div>
 </div>
 </div>
 );
};

export default NotFound;
