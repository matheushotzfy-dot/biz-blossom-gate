// Compact list of most-used Brazilian banks (COMPE / ISPB names).
// Not exhaustive — covers the top ~80 institutions sellers actually use.
export type BrBank = { code: string; name: string; short?: string };

export const BR_BANKS: BrBank[] = [
  { code: "001", name: "Banco do Brasil", short: "BB" },
  { code: "033", name: "Santander" },
  { code: "104", name: "Caixa Econômica Federal", short: "Caixa" },
  { code: "237", name: "Bradesco" },
  { code: "341", name: "Itaú Unibanco", short: "Itaú" },
  { code: "260", name: "Nu Pagamentos (Nubank)", short: "Nubank" },
  { code: "077", name: "Banco Inter" },
  { code: "212", name: "Banco Original" },
  { code: "336", name: "C6 Bank" },
  { code: "290", name: "PagBank (PagSeguro)" },
  { code: "323", name: "Mercado Pago" },
  { code: "380", name: "PicPay" },
  { code: "197", name: "Stone" },
  { code: "301", name: "BPP / Dock" },
  { code: "208", name: "Banco BTG Pactual" },
  { code: "422", name: "Banco Safra" },
  { code: "070", name: "BRB - Banco de Brasília" },
  { code: "756", name: "Sicoob" },
  { code: "748", name: "Sicredi" },
  { code: "085", name: "Cooperativa Ailos" },
  { code: "655", name: "Banco Votorantim / Neon", short: "Neon" },
  { code: "735", name: "Banco Neon" },
  { code: "746", name: "Banco Modal" },
  { code: "364", name: "Gerencianet / Efí" },
  { code: "473", name: "Banco Caixa Geral" },
  { code: "218", name: "Banco BS2" },
  { code: "121", name: "Banco Agibank" },
  { code: "004", name: "Banco do Nordeste" },
  { code: "021", name: "Banestes" },
  { code: "037", name: "Banco do Estado do Pará" },
  { code: "041", name: "Banrisul" },
  { code: "047", name: "Banco do Estado de Sergipe" },
  { code: "389", name: "Banco Mercantil do Brasil" },
  { code: "745", name: "Citibank" },
  { code: "399", name: "HSBC Bank Brasil" },
  { code: "184", name: "Banco Itaú BBA" },
  { code: "633", name: "Banco Rendimento" },
  { code: "637", name: "Banco Sofisa" },
  { code: "643", name: "Banco Pine" },
  { code: "652", name: "Itaú Unibanco Holding" },
  { code: "654", name: "Banco A.J. Renner" },
  { code: "707", name: "Banco Daycoval" },
  { code: "712", name: "Banco Ourinvest" },
  { code: "741", name: "Banco Ribeirão Preto" },
  { code: "743", name: "Banco Semear" },
  { code: "747", name: "Banco Rabobank" },
  { code: "751", name: "Scotiabank Brasil" },
  { code: "752", name: "BNP Paribas Brasil" },
  { code: "755", name: "Bank of America Merrill Lynch" },
  { code: "025", name: "Banco Alfa" },
  { code: "063", name: "Banco Bradescard" },
  { code: "094", name: "Banco Finaxis" },
  { code: "125", name: "Plural" },
  { code: "128", name: "MS Bank" },
  { code: "129", name: "UBS Brasil" },
  { code: "132", name: "ICBC do Brasil" },
  { code: "133", name: "Cresol" },
  { code: "136", name: "Unicred" },
  { code: "144", name: "BexsBanco" },
  { code: "157", name: "Icap do Brasil" },
  { code: "159", name: "Casa Credit" },
  { code: "163", name: "Commerzbank Brasil" },
  { code: "173", name: "BRL Trust" },
  { code: "174", name: "Pefisa" },
  { code: "177", name: "Guide Investimentos" },
  { code: "180", name: "CM Capital Markets" },
  { code: "183", name: "Socred" },
  { code: "191", name: "Nova Futura" },
  { code: "243", name: "Banco Máxima" },
  { code: "246", name: "Banco ABC Brasil" },
  { code: "265", name: "Banco Fator" },
  { code: "266", name: "Banco Cédula" },
  { code: "318", name: "Banco BMG" },
  { code: "320", name: "China Construction Bank" },
  { code: "329", name: "QI Sociedade de Crédito" },
  { code: "394", name: "Banco Bradesco Financiamentos" },
  { code: "403", name: "Cora SCD" },
  { code: "412", name: "Banco Capital" },
  { code: "600", name: "Banco Luso Brasileiro" },
  { code: "604", name: "Banco Industrial do Brasil" },
  { code: "610", name: "Banco VR" },
  { code: "611", name: "Banco Paulista" },
  { code: "612", name: "Banco Guanabara" },
  { code: "623", name: "Banco Pan" },
  { code: "630", name: "Banco Smartbank" },
  { code: "739", name: "Banco Cetelem" },
];

const norm = (s: string) =>
  s
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .toLowerCase();

export function searchBanks(query: string, limit = 60): BrBank[] {
  const q = norm(query.trim());
  if (!q) return BR_BANKS.slice(0, limit);
  return BR_BANKS.filter((b) => {
    return (
      b.code.startsWith(q) ||
      norm(b.name).includes(q) ||
      (b.short ? norm(b.short).includes(q) : false)
    );
  }).slice(0, limit);
}
