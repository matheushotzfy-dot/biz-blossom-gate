# Pré-lançamento — Pendências para revisão do usuário

## Bloco 1 (visual/dados) — pendente OK do usuário
- [ ] **Helper de fuso SP global** (`src/lib/datetime.ts`): centralizar `formatDateTimeSP()` / `formatDateSP()` com `timeZone: America/Sao_Paulo` + `ptBR`. Substituir ~15 call-sites (`AdminWithdrawalsTab`, `StaffManagementTab`, `ManagerDashboard`, `SaquesCrypto`, `NotasFiscais`, `Saques`, `MemberLayout`, `NotificationPanel`, etc.) que hoje usam `new Date(x).toLocaleString("pt-BR")` sem timezone.
- [ ] **Glossário seller↔admin** (`src/lib/glossary.ts`): unificar termos divergentes:
  - "Faturamento" (seller) ↔ "Receita"/"TPV"/"Volume" (admin) → escolher 1
  - "Saldo Liberado" (seller) ↔ "Disponível" (admin) → escolher 1
  - "Saque" (seller) ↔ "Withdrawal"/"Payout" (admin) → escolher 1
- [ ] **Status labels em edge functions/emails**: notificações geradas server-side usam strings cruas (`"paid"`, `"refunded"`). Criar mapper compartilhado equivalente ao `StatusBadge`.

## Bloco 2 (backend/auth) — pendente OK do usuário
- [ ] **Logs estruturados em edge functions**: helper `logEvent({fn, req_id, level, msg})` para correlacionar requests. Hoje cada função usa `console.log/error` solto.

## Bloco 1 (visual/dados) — JÁ APLICADO ✅
- `AdminWithdrawalsTab.tsx`: substituídos 5 usos de `R$ ${x.toFixed(2)}` por `formatCurrency()`.

## Bloco 2 (backend/auth) — JÁ VERIFICADO ✅
- Edge functions: error handling genérico OK
- Auth flow: session hydration OK
- `.maybeSingle()` em todo o src OK
- 70 warnings do linter sobre SECURITY DEFINER → **falso positivo esperado**, não aplicar revogação

## Bloco 3 (fluxo seller) — JÁ APLICADO ✅
- **Crítico:** trigger `enforce_kyc_on_withdrawal` adicionado → bloqueia saque se KYC não aprovado ou conta congelada.

## Bloco 3 — opcional pendente
- [ ] Scaffold de auth email templates customizados com branding (signup, recovery, magic-link). Hoje usa templates default da Lovable — funciona, mas sem branding.
