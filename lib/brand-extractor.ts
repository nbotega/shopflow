/**
 * Extrai menções de marcas de beleza/luxo a partir de captions, hashtags e transcripts.
 * Whitelist curada — só detecta marcas conhecidas, evita falso positivo.
 */

type BrandHit = {
  brand: string; // nome canonical
  tier: "luxo" | "premium" | "massmarket" | "concorrente_loreal";
  mentions: number;
};

const BRAND_WHITELIST: Array<{
  canonical: string;
  patterns: RegExp[];
  tier: BrandHit["tier"];
}> = [
  // L'Oréal Luxe family (HOUSE — não conta como concorrente)
  { canonical: "YSL Beauté", patterns: [/\bysl\b/i, /yves\s*saint\s*laurent/i], tier: "luxo" },
  { canonical: "Lancôme", patterns: [/\blanc[ôo]me\b/i], tier: "luxo" },
  { canonical: "Kiehl's", patterns: [/\bkiehl[''']?s\b/i], tier: "luxo" },
  { canonical: "Urban Decay", patterns: [/\burban\s*decay\b/i], tier: "luxo" },
  { canonical: "Helena Rubinstein", patterns: [/\bhelena\s*rubinstein\b/i], tier: "luxo" },
  { canonical: "Biotherm", patterns: [/\bbiotherm\b/i], tier: "luxo" },
  { canonical: "Giorgio Armani Beauty", patterns: [/\barmani\s*beauty\b/i, /\bacqua\s*di\s*g[iì]o\b/i], tier: "luxo" },
  { canonical: "Prada Beauty", patterns: [/\bprada\s*beauty\b/i, /\bprada\s*paradigme\b/i], tier: "luxo" },
  { canonical: "Valentino Beauty", patterns: [/\bvalentino\s*beauty\b/i, /\bborn\s*in\s*roma\b/i], tier: "luxo" },
  { canonical: "Mugler", patterns: [/\bmugler\b/i, /\balien\s*(perfume|fragrance)\b/i], tier: "luxo" },
  { canonical: "IT Cosmetics", patterns: [/\bit\s*cosmetics\b/i], tier: "luxo" },

  // Luxo concorrente (Estée Lauder, LVMH, Coty)
  { canonical: "MAC Cosmetics", patterns: [/\bmac\s*cosmetics\b/i, /\bm[\.·]?a[\.·]?c\b/i], tier: "concorrente_loreal" },
  { canonical: "Too Faced", patterns: [/\btoo\s*faced\b/i], tier: "concorrente_loreal" },
  { canonical: "Estée Lauder", patterns: [/\best[ée]e\s*lauder\b/i], tier: "concorrente_loreal" },
  { canonical: "Clinique", patterns: [/\bclinique\b/i], tier: "concorrente_loreal" },
  { canonical: "Bobbi Brown", patterns: [/\bbobbi\s*brown\b/i], tier: "concorrente_loreal" },
  { canonical: "Dior Beauty", patterns: [/\bdior\b/i], tier: "concorrente_loreal" },
  { canonical: "Chanel Beauty", patterns: [/\bchanel\b/i], tier: "concorrente_loreal" },
  { canonical: "Charlotte Tilbury", patterns: [/\bcharlotte\s*tilbury\b/i], tier: "concorrente_loreal" },
  { canonical: "Pat McGrath", patterns: [/\bpat\s*mcgrath\b/i], tier: "concorrente_loreal" },
  { canonical: "Fenty Beauty", patterns: [/\bfenty\b/i], tier: "concorrente_loreal" },
  { canonical: "Rare Beauty", patterns: [/\brare\s*beauty\b/i], tier: "concorrente_loreal" },
  { canonical: "Tom Ford", patterns: [/\btom\s*ford\b/i], tier: "concorrente_loreal" },

  // Premium / mass premium
  { canonical: "Sephora", patterns: [/\bsephora\b/i], tier: "premium" },
  { canonical: "La Roche-Posay", patterns: [/\bla\s*roche[-\s]?posay\b/i], tier: "premium" },
  { canonical: "Vichy", patterns: [/\bvichy\b/i], tier: "premium" },
  { canonical: "CeraVe", patterns: [/\bcerave\b/i], tier: "premium" },
  { canonical: "The Ordinary", patterns: [/\bthe\s*ordinary\b/i], tier: "premium" },
  { canonical: "Medicube", patterns: [/\bmedicube\b/i], tier: "premium" },
  { canonical: "Sallve", patterns: [/\bsallve\b/i], tier: "premium" },
  { canonical: "Adcos", patterns: [/\badcos\b/i], tier: "premium" },

  // Massmarket BR
  { canonical: "Boca Rosa", patterns: [/\bboca\s*rosa\b/i], tier: "massmarket" },
  { canonical: "Mari Maria", patterns: [/\bmari\s*maria\b/i], tier: "massmarket" },
  { canonical: "Eudora", patterns: [/\beudora\b/i], tier: "massmarket" },
  { canonical: "Vult", patterns: [/\bvult\b/i], tier: "massmarket" },
  { canonical: "Avon", patterns: [/\bavon\b/i], tier: "massmarket" },
  { canonical: "Natura", patterns: [/\bnatura\b/i], tier: "massmarket" },
  { canonical: "Granado", patterns: [/\bgranado\b/i], tier: "massmarket" },
  { canonical: "Quem Disse Berenice", patterns: [/\bquem\s*disse\s*berenice\b/i, /\bqdb\b/i], tier: "massmarket" },
  { canonical: "Tracta", patterns: [/\btracta\b/i], tier: "massmarket" },
  { canonical: "Dailus", patterns: [/\bdailus\b/i], tier: "massmarket" },
  { canonical: "Ruby Rose", patterns: [/\bruby\s*rose\b/i], tier: "massmarket" },
  { canonical: "Océane", patterns: [/\boc[eé]ane\b/i], tier: "massmarket" },
  { canonical: "Niely", patterns: [/\bniely\b/i], tier: "massmarket" },
  { canonical: "Belas Garden", patterns: [/\bbelas\s*garden\b/i], tier: "massmarket" },
  { canonical: "Bien", patterns: [/\bbien\b/i], tier: "massmarket" },
  { canonical: "Byem", patterns: [/\bbyem\b/i], tier: "massmarket" },
  { canonical: "LP Beauty", patterns: [/\blp\s*beauty\b/i], tier: "massmarket" },
  { canonical: "SHEGLAM", patterns: [/\bsheglam\b/i], tier: "massmarket" },
  { canonical: "SHEIN", patterns: [/\bshein\b/i], tier: "massmarket" },
  { canonical: "L'Oréal Paris", patterns: [/l['']or[ée]al\s*paris/i], tier: "massmarket" },
  { canonical: "Maybelline", patterns: [/\bmaybelline\b/i], tier: "massmarket" },
  { canonical: "Garnier", patterns: [/\bgarnier\b/i], tier: "massmarket" },
  { canonical: "NYX", patterns: [/\bnyx\b/i], tier: "massmarket" },
  { canonical: "Revlon", patterns: [/\brevlon\b/i], tier: "massmarket" },
];

export function extractBrandMentions(corpus: string): BrandHit[] {
  if (!corpus) return [];
  const hits: BrandHit[] = [];
  for (const b of BRAND_WHITELIST) {
    let count = 0;
    for (const pattern of b.patterns) {
      const matches = corpus.match(new RegExp(pattern.source, pattern.flags + "g"));
      if (matches) count += matches.length;
    }
    if (count > 0) {
      hits.push({ brand: b.canonical, tier: b.tier, mentions: count });
    }
  }
  return hits.sort((a, b) => b.mentions - a.mentions);
}

/**
 * Extrai número de telefone BR e email da bio do creator.
 */
const PHONE_BR_REGEX = /(\+?55\s*)?(\(?\d{2}\)?\s*)9?\d{4}[\s-]?\d{4}/g;
const EMAIL_REGEX = /[a-zA-Z0-9._%+-]+@[a-zA-Z0-9.-]+\.[a-zA-Z]{2,}/g;

export function extractContact(bio: string | null): {
  phone: string | null;
  email: string | null;
} {
  if (!bio) return { phone: null, email: null };

  const phoneMatch = bio.match(PHONE_BR_REGEX);
  const emailMatch = bio.match(EMAIL_REGEX);

  return {
    phone: phoneMatch?.[0]?.replace(/[\s\-()]/g, "") ?? null,
    email: emailMatch?.[0] ?? null,
  };
}
