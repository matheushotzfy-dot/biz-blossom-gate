import { useEffect, useRef, useState } from "react";
import { Loader2 } from "lucide-react";
import { CepNotFound, lookupCep, type CepAddress } from "../cep";
import { TextField } from "./TextField";
import type { FieldApi } from "./CustomerSection";

type CepStatus = "idle" | "loading" | "found" | "notfound" | "error";

const CEP_MESSAGE: Record<CepStatus, string | undefined> = {
  idle: undefined,
  loading: "Buscando o endereço…",
  found: "Endereço encontrado. Confira o número e o complemento.",
  notfound: "Não achamos esse CEP. Confira os números ou preencha o endereço abaixo.",
  error: "Não deu para buscar o CEP agora. Preencha o endereço abaixo.",
};

export function AddressSection({ api, step, fillAddress }: { api: FieldApi; step: number; fillAddress: (address: CepAddress) => void }) {
  const { values, errors, setValue, touch, register } = api;
  const [status, setStatus] = useState<CepStatus>("idle");
  const cepEl = useRef<HTMLInputElement | null>(null);
  const numberEl = useRef<HTMLInputElement | null>(null);
  const fillRef = useRef(fillAddress);
  fillRef.current = fillAddress;
  const digits = values.cep.replace(/\D/g, "");

  useEffect(() => {
    if (digits.length !== 8) { setStatus("idle"); return; }
    const controller = new AbortController();
    setStatus("loading");
    lookupCep(digits, controller.signal)
      .then((address) => {
        if (controller.signal.aborted) return;
        fillRef.current(address);
        setStatus("found");
        if (document.activeElement === cepEl.current) numberEl.current?.focus();
      })
      .catch((error) => {
        if (controller.signal.aborted) return;
        setStatus(error instanceof CepNotFound ? "notfound" : "error");
      });
    return () => controller.abort();
  }, [digits]);

  const cepMessage = errors.cep ? undefined : CEP_MESSAGE[status];

  return (
    <section className="ck-card" aria-labelledby="ck-h-address">
      <div className="ck-card-head">
        <span className="ck-step" aria-hidden="true">{step}</span>
        <div>
          <h2 id="ck-h-address">Endereço</h2>
          <p className="ck-card-sub">O vendedor pede o endereço para esta compra.</p>
        </div>
      </div>
      <div className="ck-fields">
        <div className="ck-cols-2">
          <TextField
            id="ck-cep"
            ref={(element) => { cepEl.current = element; register("cep")(element); }}
            label="CEP" inputMode="numeric" autoComplete="postal-code" placeholder="00000-000"
            value={values.cep} onValue={(v) => setValue("cep", v)} onBlur={() => touch("cep")}
            error={errors.cep} hint={cepMessage}
            trailing={status === "loading" ? <Loader2 className="ck-spin" size={16} aria-hidden="true" /> : undefined}
          />
          <TextField id="ck-neighborhood" ref={register("neighborhood")} label="Bairro" value={values.neighborhood} onValue={(v) => setValue("neighborhood", v)} onBlur={() => touch("neighborhood")} error={errors.neighborhood} autoComplete="address-level3" />
        </div>
        <TextField id="ck-street" ref={register("street")} label="Rua ou avenida" value={values.street} onValue={(v) => setValue("street", v)} onBlur={() => touch("street")} error={errors.street} autoComplete="address-line1" />
        <div className="ck-cols-num">
          <TextField id="ck-number" ref={(element) => { numberEl.current = element; register("number")(element); }} label="Número" inputMode="numeric" value={values.number} onValue={(v) => setValue("number", v)} onBlur={() => touch("number")} error={errors.number} autoComplete="off" placeholder="Nº" />
          <TextField id="ck-complement" label="Complemento" optional value={values.complement} onValue={(v) => setValue("complement", v)} autoComplete="address-line2" placeholder="Apto, bloco, sala" />
        </div>
        <div className="ck-cols-uf">
          <TextField id="ck-city" ref={register("city")} label="Cidade" value={values.city} onValue={(v) => setValue("city", v)} onBlur={() => touch("city")} error={errors.city} autoComplete="address-level2" />
          <TextField id="ck-state" ref={register("state")} label="UF" value={values.state} onValue={(v) => setValue("state", v)} onBlur={() => touch("state")} error={errors.state} autoComplete="address-level1" placeholder="UF" />
        </div>
      </div>
    </section>
  );
}
