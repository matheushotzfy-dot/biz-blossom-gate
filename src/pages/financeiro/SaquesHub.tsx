import { useState } from "react";
import { ArrowDownToLine, Bitcoin, PiggyBank } from "lucide-react";
import { HubTabs, type HubTab } from "@/components/HubTabs";
import Saques from "./Saques";
import SaquesCrypto from "./SaquesCrypto";

const TABS: HubTab[] = [
  { id: "pix", label: "Saques PIX", icon: PiggyBank },
  { id: "crypto", label: "Saques Crypto", icon: Bitcoin },
];

export default function SaquesHub() {
  const [tab, setTab] = useState("pix");

  return (
    <div className="min-h-screen bg-background antialiased selection:bg-primary/20">
      {/* Solid header — no blur, no shadow */}
      <div className="sticky top-0 z-40 w-full border-b border-border bg-background">
        <div className="mx-auto flex h-14 max-w-[1480px] items-center justify-between px-5 sm:px-8">
          <div className="flex items-center gap-6">
            <div className="flex items-center gap-3">
              <div className="flex h-9 w-9 items-center justify-center rounded-lg bg-primary/10 border border-primary/25">
                <ArrowDownToLine className="h-4 w-4 text-primary" strokeWidth={2.5} />
              </div>
              <div className="leading-none">
                <h1 className="text-[10px] font-black uppercase tracking-[0.18em] text-muted-foreground">
                  Financeiro
                </h1>
                <p className="mt-1 font-display text-[13px] font-black tracking-[-0.01em] text-foreground">
                  Gestão de Saques
                </p>
              </div>
            </div>

            <nav className="hidden items-center gap-1 md:flex">
              <HubTabs
                tabs={TABS}
                active={tab}
                onChange={setTab}
                className="border-none bg-transparent p-0 shadow-none max-w-none"
              />
            </nav>
          </div>

          <div className="flex items-center gap-2.5">
            <div className="hidden h-7 items-center gap-1.5 rounded-md border border-border bg-card px-2.5 md:flex">
              <span className="h-1.5 w-1.5 rounded-full bg-success" />
              <span className="text-[10px] font-black uppercase tracking-[0.16em] text-muted-foreground">
                Sistema Online
              </span>
            </div>
          </div>
        </div>
      </div>

      {/* Mobile tabs */}
      <div className="md:hidden border-b border-border bg-background px-5 py-3 overflow-x-auto scrollbar-none">
        <HubTabs
          tabs={TABS}
          active={tab}
          onChange={setTab}
          className="max-w-none p-0 border-none bg-transparent shadow-none"
        />
      </div>

      <main className="mx-auto w-full">
        {tab === "pix" ? <Saques /> : <SaquesCrypto />}
      </main>
    </div>
  );
}
