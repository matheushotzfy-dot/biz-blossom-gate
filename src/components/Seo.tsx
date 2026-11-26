import { Helmet } from "react-helmet-async";

const SITE_URL = "https://hotzfy.com.br";
/** Imagem das prévias de link (WhatsApp, Instagram, X). 1200×630, em `public/`. */
const DEFAULT_IMAGE = `${SITE_URL}/og-image.jpg`;

export interface SeoProps {
  title: string;
  description: string;
  path: string;
  ogType?: "website" | "article" | "product";
  jsonLd?: Record<string, unknown> | Record<string, unknown>[];
  noindex?: boolean;
  /** Endereço absoluto da imagem de prévia; sem ele, a imagem padrão da marca. */
  image?: string;
}

export function Seo({ title, description, path, ogType = "website", jsonLd, noindex, image = DEFAULT_IMAGE }: SeoProps) {
  const url = `${SITE_URL}${path}`;
  const blocks = jsonLd ? (Array.isArray(jsonLd) ? jsonLd : [jsonLd]) : [];
  return (
    <Helmet>
      <title>{title}</title>
      <meta name="description" content={description} />
      <link rel="canonical" href={url} />
      {noindex && <meta name="robots" content="noindex,nofollow" />}
      <meta property="og:title" content={title} />
      <meta property="og:description" content={description} />
      <meta property="og:url" content={url} />
      <meta property="og:type" content={ogType} />
      <meta property="og:image" content={image} />
      <meta name="twitter:image" content={image} />
      <meta name="twitter:title" content={title} />
      <meta name="twitter:description" content={description} />
      {blocks.map((data, i) => (
        <script key={i} type="application/ld+json">{JSON.stringify(data)}</script>
      ))}
    </Helmet>
  );
}
