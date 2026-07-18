import * as React from "react";
import { Check, ChevronsUpDown, Building2, Search } from "lucide-react";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { cn } from "@/lib/utils";
import { BR_BANKS, searchBanks, type BrBank } from "@/data/br-banks";

type BankComboboxProps = {
  bankName: string;
  bankCode: string;
  onSelect: (bank: BrBank) => void;
  onBankNameChange: (name: string) => void;
  invalid?: boolean;
  placeholder?: string;
};

export function BankCombobox({
  bankName,
  bankCode,
  onSelect,
  onBankNameChange,
  invalid,
  placeholder = "Selecione ou pesquise um banco",
}: BankComboboxProps) {
  const [open, setOpen] = React.useState(false);
  const [query, setQuery] = React.useState("");
  const inputRef = React.useRef<HTMLInputElement>(null);

  const results = React.useMemo(() => searchBanks(query, 80), [query]);

  React.useEffect(() => {
    if (open) {
      setQuery("");
      // Não auto-focar em touch devices — evita abrir teclado ao selecionar banco no mobile
      const isTouch = typeof window !== "undefined"
        && (window.matchMedia?.("(pointer: coarse)").matches || "ontouchstart" in window);
      if (!isTouch) setTimeout(() => inputRef.current?.focus(), 40);
    }
  }, [open]);

  const selected: BrBank | undefined =
    bankCode ? BR_BANKS.find((b) => b.code === bankCode) : undefined;

  const handlePick = (bank: BrBank) => {
    onSelect(bank);
    setOpen(false);
  };

  return (
    <Popover open={open} onOpenChange={setOpen}>
      <PopoverTrigger asChild>
        <button
          type="button"
          aria-invalid={invalid}
          className={cn(
            "group flex h-11 w-full items-center gap-3 rounded-xl border bg-background px-3.5 text-left transition-all",
            "hover:border-primary/45 focus:outline-none focus-visible:ring-2 focus-visible:ring-primary/40",
            invalid ? "border-destructive/60 bg-destructive/[0.04]" : "border-border/70",
          )}
        >
          <span
            className={cn(
              "flex h-7 w-7 shrink-0 items-center justify-center rounded-lg border transition-colors",
              selected
                ? "border-primary/35 bg-primary/10 text-primary"
                : "border-border/60 bg-muted/30 text-muted-foreground",
            )}
          >
            <Building2 className="h-3.5 w-3.5" strokeWidth={2.25} />
          </span>
          <span className="min-w-0 flex-1">
            {selected || bankName ? (
              <span className="flex items-center gap-2">
                {selected && (
                  <span className="rounded-md border border-border/60 bg-muted/40 px-1.5 py-0.5 font-mono text-[10px] font-black tabular-nums text-foreground">
                    {selected.code}
                  </span>
                )}
                <span className="truncate text-[13px] font-heading font-black tracking-tight text-foreground">
                  {selected ? selected.name : bankName}
                </span>
              </span>
            ) : (
              <span className="text-[13px] font-medium text-muted-foreground/70">{placeholder}</span>
            )}
          </span>
          <ChevronsUpDown className="h-3.5 w-3.5 shrink-0 text-muted-foreground/60 transition-transform group-data-[state=open]:rotate-180" />
        </button>
      </PopoverTrigger>
      <PopoverContent
        align="start"
        sideOffset={6}
        className="w-[var(--radix-popover-trigger-width)] min-w-[320px] overflow-hidden rounded-2xl border border-border/70 bg-popover p-0 shadow-2xl"
      >
        <div className="flex items-center gap-2 border-b border-border/60 bg-card px-3 py-2.5">
          <Search className="h-3.5 w-3.5 text-muted-foreground/60" strokeWidth={2.5} />
          <input
            ref={inputRef}
            value={query}
            onChange={(e) => {
              setQuery(e.target.value);
              onBankNameChange(e.target.value);
            }}
            placeholder="Nome ou código do banco (ex: 260, Nubank)"
            className="h-8 flex-1 bg-transparent text-[13px] font-medium text-foreground placeholder:text-muted-foreground/50 focus:outline-none"
          />
        </div>
        <div className="max-h-[320px] overflow-y-auto p-1.5">
          {results.length === 0 ? (
            <div className="px-4 py-8 text-center text-[11px] font-bold uppercase tracking-widest text-muted-foreground/60">
              Nenhum banco encontrado
            </div>
          ) : (
            results.map((b) => {
              const active = bankCode === b.code;
              return (
                <button
                  key={b.code}
                  type="button"
                  onClick={() => handlePick(b)}
                  className={cn(
                    "group/row flex w-full items-center gap-3 rounded-xl px-2.5 py-2.5 text-left transition-all",
                    active
                      ? "bg-primary/[0.09] text-foreground"
                      : "hover:bg-muted/50 focus:bg-muted/50",
                  )}
                >
                  <span
                    className={cn(
                      "rounded-md border px-1.5 py-1 font-mono text-[10.5px] font-black tabular-nums",
                      active
                        ? "border-primary/40 bg-primary/10 text-primary"
                        : "border-border/60 bg-muted/40 text-foreground/80",
                    )}
                  >
                    {b.code}
                  </span>
                  <span className="min-w-0 flex-1 truncate text-[12.5px] font-heading font-bold tracking-tight text-foreground/90">
                    {b.name}
                  </span>
                  {active && <Check className="h-3.5 w-3.5 shrink-0 text-primary" strokeWidth={3} />}
                </button>
              );
            })
          )}
        </div>
      </PopoverContent>
    </Popover>
  );
}
