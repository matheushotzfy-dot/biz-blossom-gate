# Plano: API PIX Pública + Redesign das Abas de Integrações

## Objetivo
Transformar o Hotzfy num **gateway PIX confiável** para integradores externos. Hoje existe `pk_live/sk_live` no banco mas **nenhum endpoint público real** que aceite essas chaves — vamos criar isso do zero, com segurança de produção, e dar uma cara profissional às 3 abas.

---

## Parte 1 — Infraestrutura da API PIX (foco principal)

### 1.1 Nova Edge Function pública: `pix-api`
Endpoint único versionado em `/v1` que aceita autenticação por chave secreta (`sk_live_...`) via header `Authorization: Bearer sk_live_xxx` ou `X-API-Key`. Rotas:

| Método | Path | Função |
|---|---|---|
| POST | `/v1/pix/charges` | Criar cobrança PIX (retorna `qr_code`, `qr_code_base64`, `copy_paste`, `expires_at`, `transaction_id`) |
| GET | `/v1/pix/charges/:id` | Consultar status de uma cobrança |
| GET | `/v1/pix/charges` | Listar cobranças (paginação cursor) |
| POST | `/v1/pix/charges/:id/refund` | Reembolsar (opcional fase 2) |
| GET | `/v1/ping` | Health-check autenticado |

**Validação rigorosa de input com Zod** (amount em centavos, customer name/email/document, expiration, metadata, external_id de idempotência).

**Respostas padronizadas** — sempre JSON, com `error.code`, `error.message`, `error.request_id`. Nunca vaza stack trace, nunca vaza `user_id` de outro vendedor, nunca expõe campos internos (`fee_amount`, retenção, etc) — só os campos públicos documentados.

### 1.2 Autenticação por chave secreta
- Hash SHA-256 da `sk_live` no banco (já existe `secret_key_hash`).
- Lookup via `secret_key_prefix` (12 chars) + comparação constante-tempo do hash completo.
- Bloqueio se `is_active=false` ou `expires_at` vencido.
- Atualiza `last_used_at` async (sem atrasar a resposta).
- **Nunca** loga a chave em texto, nem em logs de erro nem em activity_logs.

### 1.3 Rate limiting (anti-bot / anti-flood)
Nova tabela `api_rate_limits` (em memória curta via tabela com TTL ou sliding window):
- **Burst:** 30 req / 10s por `api_key_id`
- **Sustentado:** 600 req / minuto por `api_key_id`
- **Criação de cobrança:** 60/min por chave + 10/min por `customer_document` (anti-fraude)
- **IP fallback:** 100 req / 10s por IP quando chave inválida (impede brute force de chaves)

Resposta `429` com headers `X-RateLimit-Limit`, `X-RateLimit-Remaining`, `X-RateLimit-Reset`, `Retry-After`. Logs em `api_rate_limit_events` para o admin ver abusos.

### 1.4 Idempotência
Header `Idempotency-Key` (UUID enviado pelo integrador). Tabela `api_idempotency_keys` (chave + hash do body + response). TTL 24h. Garante que retry de rede não cria cobranças duplicadas.

### 1.5 Webhooks (entrega para o integrador)
Quando a transação muda de status, dispara HTTP POST para `webhook_configs.url` ativo do vendedor:
- Assinatura **HMAC-SHA256** no header `X-Hotzfy-Signature` (segredo = `webhook_configs.secret`).
- Header `X-Hotzfy-Event` (`charge.paid`, `charge.expired`, `charge.refunded`, `charge.chargeback`).
- **Retry exponencial:** 5 tentativas (10s, 30s, 2min, 10min, 1h). Nova tabela `webhook_deliveries` com status e response.
- Timeout de 10s. Só URLs `https://` (validador já existe).
- Endpoint na UI para reenviar manualmente e ver histórico de entregas.

### 1.6 Logs e auditoria
Nova tabela `api_request_logs` (api_key_id, endpoint, status_code, latency_ms, ip, user_agent, created_at, request_id). **Sem corpo** da requisição (PII). Retenção 30 dias. Aparece num painel "Logs da API" para o vendedor debugar.

### 1.7 Hardening de segurança
- CORS restritivo (a API pública é server-to-server — sem CORS aberto; só `OPTIONS` para health-check).
- Rejeita requests sem `Content-Type: application/json` em POST.
- Limite de body 100KB.
- Strip de campos não-whitelisted no input (evita mass-assignment).
- RLS reforçado: `api_keys`, `webhook_configs`, `api_request_logs`, `webhook_deliveries`, `api_idempotency_keys` — só dono vê, service_role processa.
- Erros 500 retornam apenas `request_id` — detalhe fica no log do servidor.

---

## Parte 2 — Redesign das 3 abas (UI profissional, sem cara de AI)

### Princípios
- Zero "cards padrão piscando". Layout editorial, denso, com hierarquia clara.
- Tipografia: Space Grotesk para números/chaves, JetBrains Mono para snippets de código, Plus Jakarta Sans para texto.
- Bordas 1px sólidas (sem glow/blur — respeita memória "Billion-Dollar SaaS").
- Sem animações de entrada em listas. Transições só em hover/foco (220ms).

### 2.1 Aba **Credenciais API**
Layout em duas colunas:
- **Esquerda:** lista de chaves com nome editável inline, prefixo da `sk_live_xxx••••`, status pill, último uso ("há 2h"), botão de rotacionar, botão de revogar com confirmação.
- **Direita:** painel de detalhe da chave selecionada — `public_key` (copiável), `secret_key` (só visível 1x após criação, depois substituída por aviso), permissões (read/write), IPs permitidos (allowlist opcional), expires_at.
- Modal de criação com fluxo "copie agora — não mostraremos de novo" (cópia para clipboard + download .env).
- Banner discreto no topo com link para Docs.

### 2.2 Aba **Webhooks**
- Tabela densa: URL, eventos (chips), status (Ativo/Pausado), última entrega (✓/✗ + timestamp), taxa de sucesso (últimas 100).
- Drawer lateral ao clicar numa linha: editor de URL, seleção de eventos por checkbox, secret (gerar/rotacionar), botão "Enviar evento de teste" (envia payload mock).
- Sub-aba "Entregas" com timeline das últimas tentativas (status_code, latência, response body truncado, botão reenviar).
- Indicador visual claro de webhook quebrado (3+ falhas seguidas → badge âmbar).

### 2.3 Aba **API Docs**
Substituir as duas docs atuais por **uma única doc estilo Stripe**:
- Sidebar fixa com sumário (Autenticação, Idempotência, Erros, Rate Limits, Cobranças PIX, Webhooks, Changelog).
- Conteúdo em coluna central com snippets em tabs (cURL / Node / PHP / Python) — código real, copiável.
- Bloco "Try it" inline em cada endpoint: form + botão "Testar com minha chave" (usa a `sk_live` do usuário logado).
- Tabela de códigos de erro com `code`, `http_status`, descrição, como resolver.
- Sem hero genérico. Header simples com versão da API + status (puxa de `status.hotzfy.com.br`).

---

## Detalhes técnicos

**Migrations necessárias:**
- `api_request_logs` (id, api_key_id, user_id, endpoint, method, status_code, latency_ms, ip, request_id, created_at) + RLS dono + service_role.
- `api_idempotency_keys` (api_key_id, key, request_hash, response jsonb, expires_at) + UNIQUE(api_key_id, key).
- `webhook_deliveries` (id, webhook_config_id, transaction_id, event, payload jsonb, status, attempt, response_status, response_body, next_retry_at, created_at) + RLS dono.
- `api_rate_limit_events` (api_key_id, window_start, count) — ou usar Deno KV se preferir, mas tabela é mais auditável.
- Função `verify_api_secret(_prefix text, _full_key text)` SECURITY DEFINER que faz hash + lookup constante-tempo.
- GRANTs explícitos para todas tabelas novas.

**Edge functions novas/alteradas:**
- `pix-api` (nova, único entry com roteamento interno por path).
- `webhook-dispatcher` (nova, invocada por trigger DB em mudança de status de `transactions`).
- `generate-api-key` (manter, mas adicionar action `rotate` e `revoke` se já não existir).

**Frontend:**
- `src/pages/vendas/ApiKeys.tsx` reescrita.
- `src/pages/vendas/Webhooks.tsx` reescrita + nova sub-página de deliveries.
- `src/pages/vendas/Documentacao.tsx` + `ApiDocsComplete.tsx` → consolidar em `ApiDocs.tsx` única.
- Novos componentes: `CodeBlock` (com tabs de linguagem e cópia), `KeyRevealOnce` (modal de criação), `WebhookTestPanel`, `DeliveryTimeline`.

**Sem mexer em:**
- `quick-pix` (endpoint interno do dashboard continua igual).
- Fluxo de checkout / transações / ledger — só consumimos, não alteramos.

---

## Fora de escopo (perguntar antes de começar?)
1. **Refunds via API** — fase 2 ou já incluir no MVP?
2. **Sandbox/test mode** (`sk_test_...` separado) — ou só `live` por enquanto?
3. **IP allowlist por chave** — incluir agora ou deixar para depois?

Me confirma esses 3 pontos e qualquer ajuste no escopo das abas, que eu já mando ver na implementação.
