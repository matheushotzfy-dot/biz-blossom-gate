/**
 * Central error handler — converts raw Postgres / Supabase / network errors
 * into user-friendly Portuguese messages. Use in toast.error() calls to stop
 * leaking technical strings (e.g. "duplicate key value violates unique
 * constraint 'foo_pkey'") to end users.
 */

const PATTERNS: { test: RegExp; message: string }[] = [
  { test: /duplicate key|already exists|unique constraint/i, message: "Este registro já existe." },
  { test: /violates foreign key|foreign key constraint/i,    message: "Ação inválida: registro relacionado não existe." },
  { test: /violates not-null|null value in column/i,         message: "Preencha todos os campos obrigatórios." },
  { test: /violates check constraint/i,                       message: "Valor inválido para um dos campos." },
  { test: /permission denied|row-level security|rls/i,       message: "Você não tem permissão para esta ação." },
  { test: /jwt|token|unauthorized|401/i,                      message: "Sessão expirada. Faça login novamente." },
  { test: /rate limit|too many requests|429/i,                message: "Muitas tentativas. Aguarde alguns segundos." },
  { test: /network|failed to fetch|timeout|econn|fetch failed/i, message: "Sem conexão. Tente novamente." },
  { test: /invalid input syntax|invalid.*uuid/i,              message: "Dados inválidos." },
  { test: /value too long/i,                                  message: "Um dos campos excede o tamanho permitido." },
  { test: /404|not.?found/i,                                  message: "Registro não encontrado." },
];

export function friendlyError(err: unknown, fallback = "Não foi possível concluir a ação."): string {
  if (!err) return fallback;
  const raw = err instanceof Error
    ? err.message
    : typeof err === "string"
      ? err
      : typeof (err as { message?: unknown })?.message === "string"
        ? String((err as { message: string }).message)
        : "";
  if (!raw) return fallback;
  for (const { test, message } of PATTERNS) if (test.test(raw)) return message;
  // Never surface raw SQL/Postgres strings — those contain constraint names, table names, etc.
  if (/relation|column|constraint|pg_|postgres/i.test(raw)) return fallback;
  // Short human strings are fine to pass through
  return raw.length <= 140 ? raw : fallback;
}
