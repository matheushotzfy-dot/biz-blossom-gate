// Shared CPF/CNPJ checksum validation used by any function that accepts
// Brazilian tax documents (signup, PIX/bank account registration, etc).

const digitsOnly = (value: string) => value.replace(/\D/g, "");

export function validCpf(value: string): boolean {
  const d = digitsOnly(value);
  if (d.length !== 11 || /^(\d)\1+$/.test(d)) return false;
  const digit = (length: number) => {
    let sum = 0;
    for (let i = 0; i < length; i++) sum += Number(d[i]) * (length + 1 - i);
    const result = (sum * 10) % 11;
    return result === 10 ? 0 : result;
  };
  return digit(9) === Number(d[9]) && digit(10) === Number(d[10]);
}

export function validCnpj(value: string): boolean {
  const d = digitsOnly(value);
  if (d.length !== 14 || /^(\d)\1+$/.test(d)) return false;
  const calculate = (base: string, weights: number[]) => {
    const sum = base.split("").reduce((total, n, index) => total + Number(n) * weights[index], 0);
    const remainder = sum % 11;
    return remainder < 2 ? 0 : 11 - remainder;
  };
  const first = calculate(d.slice(0, 12), [5, 4, 3, 2, 9, 8, 7, 6, 5, 4, 3, 2]);
  const second = calculate(`${d.slice(0, 12)}${first}`, [6, 5, 4, 3, 2, 9, 8, 7, 6, 5, 4, 3, 2]);
  return first === Number(d[12]) && second === Number(d[13]);
}

export function validCpfOrCnpj(value: string): boolean {
  const d = digitsOnly(value);
  if (d.length === 11) return validCpf(d);
  if (d.length === 14) return validCnpj(d);
  return false;
}
