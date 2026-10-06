import type { AnalyticsSeller } from "./analyticsModel";

export function csvCell(value: string | number): string {
  const text = String(value);
  const safe = /^[\s]*[=+@-]/.test(text) ? `'${text}` : text;
  return `"${safe.replace(/"/g, '""')}"`;
}

export function topSellersCSV(rows: AnalyticsSeller[], from: string, to: string, offset = 0): string {
  const header = ["Posição", "Início", "Fim", "Seller ID", "Seller", "E-mail", "Situação", "Vendas", "Tentativas", "Volume aprovado", "Clientes", "Ticket médio", "Conversão %", "Taxas", "Custo adquirente", "Resultado taxas", "Reembolsos", "Valor reembolso", "Chargebacks", "Valor chargeback", "MED PIX", "Valor MED PIX"];
  const values = rows.map((s, index) => [offset + index + 1, from, to, s.user_id, s.name, s.email, s.account_status ?? "", s.sales, s.attempts, s.volume.toFixed(2), s.clients, (s.sales ? s.volume / s.sales : 0).toFixed(2), (s.attempts ? s.sales / s.attempts * 100 : 0).toFixed(2), s.fees.toFixed(2), s.acquirer.toFixed(2), (s.fees - s.acquirer).toFixed(2), s.refunds, s.refund_amount.toFixed(2), s.chargebacks, s.chargeback_amount.toFixed(2), s.med, s.med_amount.toFixed(2)]);
  return "\uFEFF" + [header, ...values].map(row => row.map(csvCell).join(";")).join("\r\n");
}