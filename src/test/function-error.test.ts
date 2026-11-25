import { describe, expect, it } from "vitest";
import { functionErrorMessage } from "@/lib/functionError";

const http = (body: unknown) => ({ name: "FunctionsHttpError", message: "Edge Function returned a non-2xx status code", context: { json: async () => body } });

describe("functionErrorMessage", () => {
  it("lê o texto que a função devolveu em 4xx (o supabase-js não entrega `data` nesses casos)", async () => {
    expect(await functionErrorMessage(http({ error: "E-mail já cadastrado." }))).toBe("E-mail já cadastrado.");
  });
  it("prefere o `data.error` quando a função respondeu 200 com erro", async () => {
    expect(await functionErrorMessage(null, { error: "Senha fraca." })).toBe("Senha fraca.");
  });
  it("sem rede, diz que é a conexão", async () => {
    expect(await functionErrorMessage({ name: "FunctionsFetchError", message: "Failed to send a request" })).toContain("Sem conexão");
  });
  it("corpo ilegível não vaza o texto técnico", async () => {
    const err = { name: "FunctionsHttpError", message: "Edge Function returned a non-2xx status code", context: { json: async () => { throw new Error("x"); } } };
    expect(await functionErrorMessage(err, null, "Não foi possível redefinir a senha.")).toBe("Não foi possível redefinir a senha.");
  });
});
