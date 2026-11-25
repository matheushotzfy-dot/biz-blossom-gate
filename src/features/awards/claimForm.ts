/** Formulário de resgate: máscaras, validação, busca de CEP e tradução dos erros do banco. */
import { maskDocument, maskPhone } from "@/lib/financial-input";
import { isValidCNPJ, isValidCPF } from "@/lib/validation";

export const UF_LIST = [
  "AC", "AL", "AP", "AM", "BA", "CE", "DF", "ES", "GO", "MA", "MT", "MS", "MG", "PA", "PB", "PR", "PE", "PI", "RJ", "RN", "RS", "RO", "RR", "SC", "SP", "SE", "TO",
] as const;

export interface ClaimForm {
  recipient_name: string;
  phone: string;
  document: string;
  shipping_zip: string;
  shipping_street: string;
  shipping_number: string;
  shipping_complement: string;
  shipping_neighborhood: string;
  shipping_city: string;
  shipping_state: string;
}

export type ClaimErrors = Partial<Record<keyof ClaimForm, string>>;

export const EMPTY_CLAIM: ClaimForm = {
  recipient_name: "", phone: "", document: "", shipping_zip: "", shipping_street: "", shipping_number: "",
  shipping_complement: "", shipping_neighborhood: "", shipping_city: "", shipping_state: "",
};

const digits = (v: string) => v.replace(/\D/g, "");

export const maskCep = (v: string) => digits(v).slice(0, 8).replace(/(\d{5})(\d)/, "$1-$2");
export { maskDocument, maskPhone };

/** Telefone brasileiro: DDD de 11 a 99 e 8 ou 9 dígitos (celular começa com 9). */
export function isValidPhone(value: string): boolean {
  const d = digits(value).replace(/^55(?=\d{10,11}$)/, "");
  if (d.length !== 10 && d.length !== 11) return false;
  if (Number(d.slice(0, 2)) < 11) return false;
  return d.length === 10 || d[2] === "9";
}

export function validateClaim(form: ClaimForm): ClaimErrors {
  const e: ClaimErrors = {};
  const name = form.recipient_name.trim().replace(/\s+/g, " ");
  if (name.length < 3) e.recipient_name = "Informe o nome de quem vai receber.";
  else if (!name.includes(" ")) e.recipient_name = "Digite nome e sobrenome.";

  if (!isValidPhone(form.phone)) e.phone = "Informe o telefone com DDD, por exemplo (44) 99999-0000.";

  const doc = digits(form.document);
  if (doc && !(doc.length === 11 ? isValidCPF(doc) : doc.length === 14 ? isValidCNPJ(doc) : false)) e.document = "CPF ou CNPJ inválido.";

  if (digits(form.shipping_zip).length !== 8) e.shipping_zip = "Informe o CEP com 8 números.";
  if (form.shipping_street.trim().length < 2) e.shipping_street = "Informe a rua.";
  if (!form.shipping_number.trim()) e.shipping_number = "Informe o número ou s/n.";
  if (form.shipping_neighborhood.trim().length < 2) e.shipping_neighborhood = "Informe o bairro.";
  if (form.shipping_city.trim().length < 2) e.shipping_city = "Informe a cidade.";
  if (!(UF_LIST as readonly string[]).includes(form.shipping_state.trim().toUpperCase())) e.shipping_state = "Escolha o estado.";
  return e;
}

/** Valores prontos para gravar: sem espaços sobrando, com máscaras uniformes e UF em maiúsculas. */
export function normalizeClaim(form: ClaimForm) {
  const t = (v: string) => v.trim().replace(/\s+/g, " ");
  const doc = digits(form.document);
  return {
    recipient_name: t(form.recipient_name),
    phone: maskPhone(form.phone),
    document: doc ? maskDocument(doc) : null,
    shipping_zip: maskCep(form.shipping_zip),
    shipping_street: t(form.shipping_street),
    shipping_number: t(form.shipping_number),
    shipping_complement: t(form.shipping_complement) || null,
    shipping_neighborhood: t(form.shipping_neighborhood),
    shipping_city: t(form.shipping_city),
    shipping_state: form.shipping_state.trim().toUpperCase(),
  };
}

export function claimErrorMessage(error: { message?: string; code?: string } | null | undefined): string {
  const text = `${error?.message ?? ""}`;
  if (text.includes("reward_already_claimed")) return "Esta peça já foi solicitada nesta conta. Veja o andamento em Seus resgates.";
  if (error?.code === "42501" || /row-level security/i.test(text)) return "Sua conta não pode solicitar este resgate agora. Fale com o suporte.";
  return "Não foi possível registrar o resgate. Confira a conexão e tente de novo.";
}

export interface CepResult { street: string; neighborhood: string; city: string; state: string }

/** Consulta o ViaCEP. Devolve null se o CEP não existe e lança se a consulta falhar (rede ou tempo). */
export async function lookupCep(cep: string, signal?: AbortSignal): Promise<CepResult | null> {
  const d = digits(cep);
  if (d.length !== 8) return null;
  const res = await fetch(`https://viacep.com.br/ws/${d}/json/`, { signal });
  if (!res.ok) throw new Error(`cep:${res.status}`);
  const j = (await res.json()) as { erro?: boolean | string; logradouro?: string; bairro?: string; localidade?: string; uf?: string };
  if (j.erro) return null;
  return { street: j.logradouro ?? "", neighborhood: j.bairro ?? "", city: j.localidade ?? "", state: (j.uf ?? "").toUpperCase() };
}
