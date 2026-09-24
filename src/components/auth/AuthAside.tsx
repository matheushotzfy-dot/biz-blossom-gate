import { motion, useReducedMotion } from "framer-motion";
import { Box, Braces, Link2, QrCode, UserRound, UsersRound, Webhook } from "lucide-react";
import { VenxpayLogo } from "@/components/VenxpayLogo";
import { cn } from "@/lib/utils";

interface AuthAsideProps {
  className?: string;
}

const MODULES = [
  { label: "PIX", icon: QrCode, x: 18, y: 20 },
  { label: "LINKS", icon: Link2, x: 18, y: 35 },
  { label: "API", icon: Braces, x: 18, y: 50 },
  { label: "WEBHOOKS", icon: Webhook, x: 18, y: 65 },
  { label: "AFILIADOS", icon: UsersRound, x: 18, y: 80 },
] as const;

export function AuthAside({ className }: AuthAsideProps) {
  const reducedMotion = useReducedMotion();

  return (
    <aside className={cn("auth-network relative isolate overflow-hidden", className)} aria-label="Ecossistema VENXPAY">
      <div className="auth-network-grid absolute inset-0" aria-hidden="true" />
      <div className="absolute right-7 top-7 flex items-center gap-2 text-[10px] font-semibold uppercase text-muted-foreground">
        <span className="h-1.5 w-1.5 rounded-full bg-primary" /> Sistema operacional
      </div>

      <div className="absolute inset-0 flex items-center justify-center">
        <div className="relative h-[500px] w-full max-w-[680px]">
          <h2 className="absolute inset-x-0 top-3 text-center font-heading text-[27px] font-medium leading-tight text-foreground">
            Pagamentos de um jeito <strong className="font-bold">simples.</strong>
          </h2>

          <svg className="absolute inset-0 h-full w-full" viewBox="0 0 680 500" aria-hidden="true">
            {MODULES.map((item) => (
              <motion.path
                key={item.label}
                d={`M ${item.x * 6.8 + 20} ${item.y * 5} C 260 ${item.y * 5}, 320 250, 356 250`}
                fill="none"
                stroke="hsl(var(--border))"
                strokeWidth="1"
                strokeDasharray="5 7"
                initial={{ pathLength: 0, opacity: 0 }}
                animate={{ pathLength: 1, opacity: 0.8 }}
                transition={{ duration: reducedMotion ? 0 : 1.1, delay: reducedMotion ? 0 : item.y / 180 }}
              />
            ))}
            <motion.path
              d="M 392 250 C 475 250, 510 250, 568 250"
              fill="none"
              stroke="hsl(var(--primary))"
              strokeWidth="1.5"
              initial={{ pathLength: 0 }}
              animate={{ pathLength: 1 }}
              transition={{ duration: reducedMotion ? 0 : 1, delay: 0.45 }}
            />
          </svg>

          {MODULES.map((item, index) => {
            const Icon = item.icon;
            return (
              <motion.div
                key={item.label}
                className="group absolute flex -translate-x-1/2 -translate-y-1/2 flex-col items-center gap-2"
                style={{ left: `${item.x}%`, top: `${item.y}%` }}
                initial={{ opacity: 0, x: -8 }}
                animate={{ opacity: 1, x: 0 }}
                transition={{ duration: reducedMotion ? 0 : 0.45, delay: reducedMotion ? 0 : 0.1 + index * 0.08 }}
              >
                <span className="flex h-10 w-10 items-center justify-center rounded-full border border-border bg-background text-foreground transition-colors duration-300 group-hover:border-primary group-hover:text-primary">
                  <Icon className="h-4 w-4" />
                </span>
                <span className="text-[9px] font-bold uppercase text-muted-foreground">{item.label}</span>
              </motion.div>
            );
          })}

          <motion.div
            className="absolute left-[55%] top-1/2 flex h-[62px] w-[62px] -translate-x-1/2 -translate-y-1/2 items-center justify-center rounded-full border border-primary bg-background"
            initial={{ opacity: 0, scale: 0.8 }}
            animate={{ opacity: 1, scale: 1 }}
            transition={{ duration: reducedMotion ? 0 : 0.55, delay: reducedMotion ? 0 : 0.3 }}
          >
            <VenxpayLogo size={34} plate={false} />
          </motion.div>

          <motion.div
            className="absolute left-[84%] top-1/2 flex -translate-x-1/2 -translate-y-1/2 flex-col items-center gap-2"
            initial={{ opacity: 0, x: 8 }}
            animate={{ opacity: 1, x: 0 }}
            transition={{ duration: reducedMotion ? 0 : 0.45, delay: reducedMotion ? 0 : 0.65 }}
          >
            <span className="flex h-10 w-10 items-center justify-center rounded-full border border-primary bg-primary text-primary-foreground">
              <UserRound className="h-4 w-4" />
            </span>
            <span className="text-[9px] font-bold uppercase text-muted-foreground">VOCÊ</span>
          </motion.div>

          <p className="absolute inset-x-0 bottom-4 text-center font-heading text-[27px] font-medium text-foreground">
            Tudo conectado à <strong className="font-bold text-primary">VENXPAY.</strong>
          </p>
        </div>
      </div>

      <div className="absolute bottom-7 right-7 flex items-center gap-2 text-[10px] font-medium text-muted-foreground">
        <Box className="h-3.5 w-3.5 text-primary" /> Infraestrutura para vender sem limites
      </div>
    </aside>
  );
}

export default AuthAside;