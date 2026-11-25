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
  id?: string;
};

export function BankCombobox({
  bankName,
  bankCode,
  onSelect,
  onBankNameChange,
  invalid,
  placeholder = "Escolha o banco",
  id,
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
          id={id}
          type="button"
          aria-invalid={invalid || undefined}
          className={cn(
            // o estado vai em box-shadow: a regra legada [class*="border"] recolore qualquer borda
            "group vp-r16 flex h-12 w-full items-center gap-3 bg-card px-4 text-left transition-shadow",
            "focus:outline-none focus-visible:ring-2 focus-visible:ring-primary",
            invalid ? "shadow-[inset_0_0_0_1px_hsl(var(--destructive))]" : "shadow-[inset_0_0_0_1px_hsl(var(--border))] hover:shadow-[inset_0_0_0_1px_hsl(var(--primary)/.5)]",
          )}
        >
          <Building2 aria-hidden className={cn("h-[18px] w-[18px] shrink-0", selected ? "text-primary" : "text-muted-foreground")} />
          <span className="min-w-0 flex-1">
            {selected || bankName ? (
              <span className="flex items-center gap-2">
                {selected && <span className="rounded-md bg-muted px-1.5 py-0.5 font-mono text-[11.5px] font-bold tabular-nums text-foreground">{selected.code}</span>}
                <span className="truncate text-[15px] text-foreground">{selected ? selected.name : bankName}</span>
              </span>
            ) : (
              <span className="text-[15px] text-muted-foreground/70">{placeholder}</span>
            )}
          </span>
          <ChevronsUpDown aria-hidden className="h-4 w-4 shrink-0 text-muted-foreground/70" />
        </button>
      </PopoverTrigger>
      <PopoverContent
        align="start"
        sideOffset={6}
        collisionPadding={16}
        className="w-[var(--radix-popover-trigger-width)] min-w-[300px] overflow-hidden rounded-[16px] bg-popover p-0 shadow-2xl"
      >
        <div className="relative border-b border-border bg-card p-2">
          <Search aria-hidden className="pointer-events-none absolute left-[22px] top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
          <input
            ref={inputRef}
            value={query}
            onChange={(e) => {
              setQuery(e.target.value);
              onBankNameChange(e.target.value);
            }}
            id="bank-search" aria-label="Buscar banco"
            placeholder="Nome ou código (ex.: 260, Nubank)"
            className="vp-field !h-10 !pl-10 !text-[14px]"
          />
        </div>
        <div className="max-h-[min(320px,var(--radix-popover-content-available-height))] overflow-y-auto p-1.5">
          {results.length === 0 ? (
            <p className="px-4 py-8 text-center text-[13.5px] text-muted-foreground">Nenhum banco encontrado. Confira o nome ou o código.</p>
          ) : (
            results.map((b) => {
              const active = bankCode === b.code;
              return (
                <button
                  key={b.code}
                  type="button"
                  onClick={() => handlePick(b)}
                  className={cn(
                    "flex w-full items-center gap-3 rounded-[12px] px-3 py-2.5 text-left transition-colors focus:outline-none focus-visible:bg-muted",
                    active ? "bg-accent" : "hover:bg-muted/60",
                  )}
                >
                  <span className={cn("w-10 shrink-0 rounded-md px-1.5 py-0.5 text-center font-mono text-[11.5px] font-bold tabular-nums", active ? "bg-primary text-primary-foreground" : "bg-muted text-foreground/80")}>{b.code}</span>
                  <span className="min-w-0 flex-1 truncate text-[14px] font-medium text-foreground">{b.name}</span>
                  {active && <Check aria-hidden className="h-4 w-4 shrink-0 text-primary" strokeWidth={3} />}
                </button>
              );
            })
          )}
        </div>
      </PopoverContent>
    </Popover>
  );
}
