import { useState } from "react";
import { ArrowDownToLine, Bitcoin, LayoutDashboard, History, PiggyBank } from "lucide-react";
import { HubTabs, type HubTab } from "@/components/HubTabs";
import Saques from "./Saques";
import SaquesCrypto from "./SaquesCrypto";
import { motion, AnimatePresence } from "framer-motion";

const TABS: HubTab[] = [
  { id: "pix", label: "Saques PIX", icon: PiggyBank },
  { id: "crypto", label: "Saques Crypto", icon: Bitcoin },
];

export default function SaquesHub() {
  const [tab, setTab] = useState("pix");

  return (
    <div className="min-h-screen bg-background antialiased selection:bg-primary/20">
      <div className="sticky top-0 z-40 w-full border-b border-border/40 bg-background/80 backdrop-blur-xl">
        <div className="mx-auto flex h-16 max-w-[1480px] items-center justify-between px-5 sm:px-8">
          <div className="flex items-center gap-6">
            <div className="flex items-center gap-2">
              <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-primary/10 ring-1 ring-primary/20">
                <ArrowDownToLine className="h-4 w-4 text-primary" />
              </div>
              <h1 className="text-sm font-black uppercase tracking-[0.15em] text-foreground">Gestão de Saques</h1>
            </div>
            
            <nav className="hidden items-center gap-1 md:flex">
               <HubTabs tabs={TABS} active={tab} onChange={setTab} className="border-none bg-transparent p-0 shadow-none max-w-none" />
            </nav>
          </div>

          <div className="flex items-center gap-2.5">
            <div className="hidden h-8 items-center gap-1.5 rounded-full border border-border/40 bg-muted/30 px-3 md:flex">
              <span className="relative flex h-1.5 w-1.5">
                <span className="absolute h-full w-full animate-ping rounded-full bg-success opacity-75"></span>
                <span className="relative h-1.5 w-1.5 rounded-full bg-success"></span>
              </span>
              <span className="text-[10px] font-bold uppercase tracking-wider text-muted-foreground">Sistema Online</span>
            </div>
          </div>
        </div>
      </div>

      <div className="md:hidden border-b border-border/40 bg-muted/10 px-5 py-3 overflow-x-auto scrollbar-none">
        <HubTabs tabs={TABS} active={tab} onChange={setTab} className="max-w-none p-0 border-none bg-transparent shadow-none" />
      </div>

      <main className="mx-auto w-full">
        <AnimatePresence mode="wait">
          <motion.div
            key={tab}
            initial={{ opacity: 0, y: 10 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -10 }}
            transition={{ duration: 0.2, ease: "easeOut" }}
          >
            {tab === "pix" ? <Saques /> : <SaquesCrypto />}
          </motion.div>
        </AnimatePresence>
      </main>
    </div>
  );
}
