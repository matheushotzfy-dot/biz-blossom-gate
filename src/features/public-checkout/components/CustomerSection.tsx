import type { FieldName, FormValues } from "../useCheckoutForm";
import { TextField } from "./TextField";

export interface FieldApi {
  values: FormValues;
  errors: Partial<Record<FieldName, string>>;
  setValue: (field: FieldName, raw: string) => void;
  touch: (field: FieldName) => void;
  register: (field: FieldName) => (element: HTMLInputElement | null) => void;
}

export function SectionHead({ step, title, sub }: { step?: number; title: string; sub?: string }) {
  return (
    <div className="ck-card-head">
      {step !== undefined && <span className="ck-step" aria-hidden="true">{step}</span>}
      <div>
        <h2>{title}</h2>
        {sub && <p className="ck-card-sub">{sub}</p>}
      </div>
    </div>
  );
}

export function CustomerSection({ api, confirmEmail }: { api: FieldApi; confirmEmail: boolean }) {
  const { values, errors, setValue, touch, register } = api;
  return (
    <section className="ck-card" aria-labelledby="ck-h-customer">
      <div className="ck-card-head">
        <span className="ck-step" aria-hidden="true">1</span>
        <div>
          <h2 id="ck-h-customer">Seus dados</h2>
          <p className="ck-card-sub">Use o e-mail certo: é por ele que você acessa a compra.</p>
        </div>
      </div>
      <div className="ck-fields">
        <TextField id="ck-name" ref={register("name")} label="Nome completo" value={values.name} onValue={(v) => setValue("name", v)} onBlur={() => touch("name")} error={errors.name} autoComplete="name" placeholder="Como está no seu documento" />
        <div className={confirmEmail ? "ck-cols-2" : undefined}>
          <TextField id="ck-email" ref={register("email")} label="E-mail" type="email" inputMode="email" autoCapitalize="none" spellCheck={false} value={values.email} onValue={(v) => setValue("email", v)} onBlur={() => touch("email")} error={errors.email} autoComplete="email" placeholder="voce@email.com" />
          {confirmEmail && (
            <TextField id="ck-email-confirm" ref={register("emailConfirm")} label="Confirme o e-mail" type="email" inputMode="email" autoCapitalize="none" spellCheck={false} value={values.emailConfirm} onValue={(v) => setValue("emailConfirm", v)} onBlur={() => touch("emailConfirm")} error={errors.emailConfirm} autoComplete="off" placeholder="Digite o e-mail de novo" />
          )}
        </div>
        <div className="ck-cols-2">
          <TextField id="ck-document" ref={register("document")} label="CPF ou CNPJ" inputMode="numeric" value={values.document} onValue={(v) => setValue("document", v)} onBlur={() => touch("document")} error={errors.document} autoComplete="off" placeholder="000.000.000-00" />
          <TextField id="ck-phone" ref={register("phone")} label="WhatsApp (com DDD)" type="tel" inputMode="tel" value={values.phone} onValue={(v) => setValue("phone", v)} onBlur={() => touch("phone")} error={errors.phone} autoComplete="tel" placeholder="(00) 00000-0000" />
        </div>
      </div>
    </section>
  );
}
