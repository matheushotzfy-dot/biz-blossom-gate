import { useCallback, useMemo, useState } from "react";
import {
  checkoutCustomerSchema, formatCheckoutCep, formatCheckoutDocument, formatCheckoutPhone,
  type CheckoutCustomer,
} from "./checkoutSchema";
import type { CepAddress } from "./cep";

export interface FormValues {
  name: string; email: string; emailConfirm: string; document: string; phone: string;
  cep: string; street: string; number: string; complement: string; neighborhood: string; city: string; state: string;
}
export type FieldName = keyof FormValues;

const EMPTY: FormValues = {
  name: "", email: "", emailConfirm: "", document: "", phone: "",
  cep: "", street: "", number: "", complement: "", neighborhood: "", city: "", state: "",
};

/** Ordem em que a pessoa preenche (e em que o foco vai para o primeiro campo com problema). */
export const FIELD_ORDER: FieldName[] = ["name", "email", "emailConfirm", "document", "phone", "cep", "number", "street", "neighborhood", "city", "state"];

const LIMITS: Partial<Record<FieldName, number>> = {
  name: 120, email: 255, emailConfirm: 255, street: 160, number: 20, complement: 100, neighborhood: 100, city: 100,
};

function clean(field: FieldName, raw: string): string {
  switch (field) {
    case "document": return formatCheckoutDocument(raw);
    case "phone": return formatCheckoutPhone(raw);
    case "cep": return formatCheckoutCep(raw);
    case "state": return raw.replace(/[^a-z]/gi, "").toUpperCase().slice(0, 2);
    default: return raw.slice(0, LIMITS[field] ?? 255);
  }
}

export function useCheckoutForm(opts: { addressRequired: boolean; emailConfirm: boolean }) {
  const [values, setValues] = useState<FormValues>(EMPTY);
  const [touched, setTouched] = useState<Partial<Record<FieldName, boolean>>>({});
  const [submitted, setSubmitted] = useState(false);

  const parsed = useMemo(
    () => checkoutCustomerSchema.safeParse({ ...values, emailConfirm: opts.emailConfirm ? values.emailConfirm : undefined, addressRequired: opts.addressRequired }),
    [values, opts.addressRequired, opts.emailConfirm],
  );

  const errors = useMemo(() => {
    const out: Partial<Record<FieldName, string>> = {};
    if (!parsed.success) {
      for (const issue of parsed.error.issues) {
        const field = issue.path[0];
        if (typeof field === "string" && !(field in out)) out[field as FieldName] = issue.message;
      }
    }
    return out;
  }, [parsed]);

  /** Só mostra o erro de quem já saiu do campo (ou depois de tentar enviar): nada de tela vermelha logo na entrada. */
  const visibleErrors = useMemo(() => {
    const out: Partial<Record<FieldName, string>> = {};
    for (const field of Object.keys(errors) as FieldName[]) if (submitted || touched[field]) out[field] = errors[field];
    return out;
  }, [errors, touched, submitted]);

  const setValue = useCallback((field: FieldName, raw: string) => setValues((prev) => ({ ...prev, [field]: clean(field, raw) })), []);
  const touch = useCallback((field: FieldName) => setTouched((prev) => (prev[field] ? prev : { ...prev, [field]: true })), []);
  const fillAddress = useCallback((address: CepAddress) => setValues((prev) => ({
    ...prev,
    street: address.street || prev.street,
    neighborhood: address.neighborhood || prev.neighborhood,
    city: address.city || prev.city,
    state: address.state || prev.state,
  })), []);

  /** Marca tudo como visto e devolve os dados limpos, ou o primeiro campo a corrigir. */
  const validate = useCallback((): { ok: true; customer: CheckoutCustomer } | { ok: false; first: FieldName; count: number } => {
    setSubmitted(true);
    if (parsed.success) return { ok: true, customer: parsed.data };
    const invalid = FIELD_ORDER.filter((field) => field in errors);
    return { ok: false, first: invalid[0] ?? "name", count: invalid.length };
  }, [parsed, errors]);

  return { values, errors: visibleErrors, setValue, touch, fillAddress, validate };
}
