export interface CepAddress { street: string; neighborhood: string; city: string; state: string }

export class CepNotFound extends Error {}

const clean = (value: unknown, max: number) => (typeof value === "string" ? value.trim().slice(0, max) : "");

/** ViaCEP primeiro, BrasilAPI de reserva. Lança CepNotFound quando nenhum conhece o CEP e outro erro quando a rede falha. */
export async function lookupCep(digits: string, signal?: AbortSignal): Promise<CepAddress> {
  if (!/^\d{8}$/.test(digits)) throw new CepNotFound();
  let reachedAServer = false;
  try {
    const response = await fetch(`https://viacep.com.br/ws/${digits}/json/`, { signal });
    if (response.ok) {
      reachedAServer = true;
      const data = await response.json();
      if (data && !data.erro) {
        return { street: clean(data.logradouro, 160), neighborhood: clean(data.bairro, 100), city: clean(data.localidade, 100), state: clean(data.uf, 2).toUpperCase() };
      }
    }
  } catch (error) {
    if (signal?.aborted) throw error;
  }
  try {
    const response = await fetch(`https://brasilapi.com.br/api/cep/v2/${digits}`, { signal });
    if (response.ok) {
      reachedAServer = true;
      const data = await response.json();
      if (data) return { street: clean(data.street, 160), neighborhood: clean(data.neighborhood, 100), city: clean(data.city, 100), state: clean(data.state, 2).toUpperCase() };
    } else if (response.status === 404) {
      reachedAServer = true;
    }
  } catch (error) {
    if (signal?.aborted) throw error;
  }
  if (reachedAServer) throw new CepNotFound();
  throw new Error("cep_lookup_failed");
}
