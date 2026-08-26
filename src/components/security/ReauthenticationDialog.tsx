import { useState } from "react";
import { LockKeyhole } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";

export interface ReauthenticationDialogProps {
  open: boolean;
  busy?: boolean;
  title?: string;
  description?: string;
  onOpenChange: (open: boolean) => void;
  onConfirm: (password: string) => Promise<void>;
}

export function ReauthenticationDialog({
  open,
  busy = false,
  title = "Confirme sua identidade",
  description = "Digite sua senha atual para autorizar esta operação sensível.",
  onOpenChange,
  onConfirm,
}: ReauthenticationDialogProps) {
  const [password, setPassword] = useState("");

  const handleOpenChange = (next: boolean) => {
    if (!busy) {
      if (!next) setPassword("");
      onOpenChange(next);
    }
  };

  const handleSubmit = async (event: React.FormEvent) => {
    event.preventDefault();
    if (password.length < 6 || busy) return;
    await onConfirm(password);
  };

  return (
    <Dialog open={open} onOpenChange={handleOpenChange}>
      <DialogContent className="max-w-sm">
        <DialogHeader>
          <div className="mb-2 flex h-10 w-10 items-center justify-center rounded-lg border border-primary/20 bg-primary/10 text-primary">
            <LockKeyhole className="h-4 w-4" />
          </div>
          <DialogTitle>{title}</DialogTitle>
          <DialogDescription>{description}</DialogDescription>
        </DialogHeader>
        <form onSubmit={handleSubmit} className="space-y-4 pt-2">
          <div className="space-y-2">
            <Label htmlFor="reauth-password">Senha atual</Label>
            <Input
              id="reauth-password"
              type="password"
              autoComplete="current-password"
              value={password}
              onChange={(event) => setPassword(event.target.value)}
              minLength={6}
              maxLength={128}
              autoFocus
              required
            />
          </div>
          <Button type="submit" className="w-full" disabled={busy || password.length < 6}>
            {busy ? "Confirmando..." : "Confirmar e continuar"}
          </Button>
        </form>
      </DialogContent>
    </Dialog>
  );
}