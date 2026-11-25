import { VERIFY_SNIPPET } from "../SignatureGuide";

/** Tudo o que a documentação mostra como exemplo. Os eventos e o formato dos webhooks são os que o banco e o worker enviam de verdade. */

export const SIGNATURE_HEADER = "X-Venxpay-Signature";

export const WEBHOOK_HEADERS: Array<[string, string]> = [
  [SIGNATURE_HEADER, "t=<hora>,v1=<assinatura>. A hora vem em segundos."],
  ["X-Venxpay-Event", "Nome do evento, como payment.approved."],
  ["X-Venxpay-Delivery", "ID da entrega. É o mesmo em todas as tentativas do mesmo evento."],
  ["X-Venxpay-Timestamp", "Hora do envio, em segundos. É o mesmo t da assinatura."],
  ["Content-Type", "application/json"],
  ["User-Agent", "Venxpay-Webhooks/1.0"],
];

export const PAYMENT_EVENT_EXAMPLE = `{
  "event": "payment.approved",
  "created_at": "2026-11-24T21:10:32Z",
  "data": {
    "id": "b4b1c1e0-9f6a-4a2c-8f7f-1e2d3c4b5a6d",
    "external_id": null,
    "status": "completed",
    "amount_cents": 19700,
    "net_amount_cents": 18620,
    "payment_method": "pix",
    "processor": "hotzfy",
    "customer": {
      "name": "Maria Souza",
      "email": "maria@exemplo.com",
      "document": "12345678900"
    },
    "metadata": {},
    "created_at": "2026-11-24T21:08:05.412Z"
  }
}`;

export const PAYOUT_EVENT_EXAMPLE = `{
  "event": "payout.approved",
  "created_at": "2026-11-24T21:30:00Z",
  "data": {
    "id": "7c0e2a9d-5b1f-4e63-9a8d-2f4b6c8e0a13",
    "status": "approved",
    "amount_cents": 150000,
    "net_amount_cents": 147500,
    "fee_cents": 2500,
    "withdrawal_type": "pix",
    "created_at": "2026-11-24T20:55:41.120Z"
  }
}`;

export const PAYMENT_FIELDS: Array<{ name: string; type: string; desc: string }> = [
  { name: "event", type: "texto", desc: "Nome do evento, igual ao cabeçalho X-Venxpay-Event." },
  { name: "created_at", type: "data ISO", desc: "Quando o evento foi gerado, em UTC." },
  { name: "data.id", type: "uuid", desc: "ID da venda. Use para ligar o evento ao seu pedido." },
  { name: "data.external_id", type: "texto ou nulo", desc: "ID do pedido no seu sistema, quando houver." },
  { name: "data.status", type: "texto", desc: "Situação da venda no momento do evento, a mesma que aparece em Vendas." },
  { name: "data.amount_cents", type: "inteiro", desc: "Valor cobrado do cliente, em centavos. 19700 é R$ 197,00." },
  { name: "data.net_amount_cents", type: "inteiro", desc: "O que sobra para você depois das taxas, em centavos." },
  { name: "data.payment_method", type: "texto", desc: "pix, boleto ou cartão." },
  { name: "data.customer", type: "objeto", desc: "Nome, e-mail e documento do cliente." },
  { name: "data.metadata", type: "objeto", desc: "Dados extras da venda, como UTMs." },
];

export const NODE_RECEIVER = `${VERIFY_SNIPPET}

import express from "express";

const app = express();

// express.raw entrega o corpo sem alterar, que é o que a assinatura cobre
app.post("/webhooks/vemprapay", express.raw({ type: "application/json" }), (req, res) => {
  const raw = req.body.toString("utf8");
  if (!isFromVemprapay(raw, req.header("X-Venxpay-Signature") ?? "", process.env.VEMPRAPAY_WEBHOOK_SECRET)) {
    return res.sendStatus(401);
  }
  const evento = JSON.parse(raw);
  // guarde req.header("X-Venxpay-Delivery") para ignorar repetidos e trate evento.event
  res.sendStatus(200);
});`;

export const PYTHON_RECEIVER = `import hashlib
import hmac
import os
import time

from flask import Flask, request

app = Flask(__name__)


def is_from_vemprapay(raw_body: bytes, header: str, secret: str) -> bool:
    parts = dict(p.split("=", 1) for p in header.split(",") if "=" in p)
    t = parts.get("t", "")
    expected = hmac.new(secret.encode(), f"{t}.".encode() + raw_body, hashlib.sha256).hexdigest()
    fresh = t.isdigit() and abs(time.time() - int(t)) < 300
    return fresh and hmac.compare_digest(parts.get("v1", ""), expected)


@app.post("/webhooks/vemprapay")
def webhook():
    header = request.headers.get("X-Venxpay-Signature", "")
    if not is_from_vemprapay(request.get_data(), header, os.environ["VEMPRAPAY_WEBHOOK_SECRET"]):
        return "", 401
    evento = request.get_json()
    # guarde X-Venxpay-Delivery para ignorar repetidos e trate evento["event"]
    return "", 200`;

export const PHP_RECEIVER = `<?php
$secret = getenv('VEMPRAPAY_WEBHOOK_SECRET');
$raw = file_get_contents('php://input');
$header = $_SERVER['HTTP_X_VENXPAY_SIGNATURE'] ?? '';

parse_str(str_replace(',', '&', $header), $parts); // t=...&v1=...
$t = $parts['t'] ?? '';
$expected = hash_hmac('sha256', $t . '.' . $raw, $secret);
$fresh = ctype_digit($t) && abs(time() - (int) $t) < 300;

if (!$fresh || !hash_equals($expected, $parts['v1'] ?? '')) {
    http_response_code(401);
    exit;
}

$evento = json_decode($raw, true);
// guarde X-Venxpay-Delivery para ignorar repetidos e trate $evento['event']
http_response_code(200);`;

/** Prévia da API de cobranças. Ainda não está no ar: nada aqui responde hoje. */
export const CHARGE_REQUEST = `curl -X POST "https://SEU-ENDERECO/v1/pix/charges" \\
  -H "Authorization: Bearer sk_live_suachave" \\
  -H "Content-Type: application/json" \\
  -H "Idempotency-Key: $(uuidgen)" \\
  -d '{
    "amount_cents": 4990,
    "customer": {
      "name": "João Silva",
      "email": "joao@email.com",
      "document": "12345678900"
    },
    "external_id": "pedido-000123",
    "expires_in_minutes": 30
  }'`;

export const CHARGE_RESPONSE = `{
  "data": {
    "id": "b4b1c1e0-9f6a-4a2c-8f7f-1e2d3c4b5a6d",
    "object": "charge",
    "external_id": "pedido-000123",
    "status": "pending",
    "amount_cents": 4990,
    "net_amount_cents": 4750,
    "payment_method": "pix",
    "pix": {
      "copy_paste": "00020126580014br.gov.bcb.pix0136...6304ABCD",
      "expires_at": "2026-11-24T21:40:32.000Z"
    },
    "created_at": "2026-11-24T21:10:32.789Z"
  }
}`;

export const CHARGE_PARAMS = [
  { name: "amount_cents", type: "inteiro", required: true, desc: "Valor em centavos, de 100 (R$ 1,00) a 9.999.999." },
  { name: "customer.name", type: "texto", required: true, desc: "Nome de quem paga, de 2 a 200 letras." },
  { name: "customer.email", type: "texto", required: true, desc: "E-mail válido de quem paga." },
  { name: "customer.document", type: "texto", required: true, desc: "CPF com 11 dígitos ou CNPJ com 14." },
  { name: "customer.phone", type: "texto", required: false, desc: "DDD e número, só dígitos." },
  { name: "external_id", type: "texto", required: false, desc: "ID do pedido no seu sistema, até 100 caracteres. Repetir devolve 409." },
  { name: "expires_in_minutes", type: "inteiro", required: false, desc: "Validade do PIX. Padrão 30, de 5 a 1440." },
  { name: "metadata", type: "objeto", required: false, desc: "Dados livres até 4 KB. Voltam nas consultas e nos webhooks." },
  { name: "product_id", type: "uuid", required: false, desc: "Liga a cobrança a um produto ativo da sua conta." },
] as const;

export const CHARGE_STATUS: Array<[string, string, string]> = [
  ["pending", "Esperando o pagamento", "Não"],
  ["completed", "PIX pago e confirmado", "Sim"],
  ["failed", "Falha no processamento", "Sim"],
  ["cancelled", "Cobrança cancelada ou expirada", "Sim"],
  ["refunded", "Valor devolvido ao cliente", "Sim"],
  ["chargeback", "Chargeback recebido", "Sim"],
];

export const API_ERRORS: Array<[string, string, string]> = [
  ["400", "validation_error", "Campo faltando ou inválido. O campo field diz qual."],
  ["400", "invalid_json", "O corpo não é um JSON válido."],
  ["401", "missing_api_key", "A chave não foi enviada."],
  ["401", "invalid_api_key", "Chave inexistente, expirada ou revogada."],
  ["403", "fraud_blocked", "A cobrança foi barrada pelas regras antifraude."],
  ["404", "not_found", "A cobrança não existe na sua conta."],
  ["409", "duplicate_external_id", "Já existe uma cobrança com esse external_id."],
  ["409", "idempotency_conflict", "A mesma Idempotency-Key foi usada com outro corpo."],
  ["413", "payload_too_large", "O corpo passou de 100 KB."],
  ["415", "unsupported_media_type", "O Content-Type precisa ser application/json."],
  ["429", "rate_limited", "Muitas chamadas em pouco tempo. O campo reset_at diz quando tentar de novo."],
  ["502", "provider_error", "O processador recusou ou demorou. Pode reenviar."],
  ["500", "internal_error", "Erro nosso. Fale com o suporte e informe o request_id."],
];

export const RATE_LIMITS: Array<[string, string, string]> = [
  ["Por IP", "100 chamadas a cada 10 segundos", "Barra tentativas com chaves inválidas."],
  ["Por chave, pico", "30 chamadas a cada 10 segundos", "Rajadas curtas."],
  ["Por chave, minuto", "600 chamadas a cada 60 segundos", "Volume sustentado."],
  ["Criar cobranças", "60 chamadas a cada 60 segundos", "Extra, só no POST de criação."],
];
