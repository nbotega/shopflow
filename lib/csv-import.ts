import Papa from "papaparse";

/**
 * Tipo das linhas do CSV "Afiliadas Luxo - Mac + Too Faced".
 * Header esperado: `,Creator name,TikTok creator homepage,GMV Total,Pedidos totais,Ticket Médio,luxo?`
 */
export type AffiliateCSVRow = {
  "": string; // primeira coluna sem header (ok/blank)
  "Creator name": string;
  "TikTok creator homepage": string;
  "GMV Total": string;
  "Pedidos totais": string;
  "Ticket Médio": string;
  "luxo?": string;
};

export type ParsedAffiliate = {
  tiktok_handle: string;
  display_name: string;
  gmv_total_brl: number | null;
  orders_total: number | null;
  avg_ticket_brl: number | null;
  loreal_human_label: string | null; // texto original do CSV
  loreal_human_label_normalized: "sim" | "nao" | "maybe" | null; // normalizado
};

/**
 * Extrai handle TikTok da URL.
 * https://www.tiktok.com/@alinemellods → "alinemellods"
 */
export function extractTikTokHandle(url: string): string | null {
  if (!url) return null;
  const match = url.match(/@([a-zA-Z0-9._-]+)/);
  return match ? match[1].toLowerCase() : null;
}

/**
 * Converte string brasileira "20.586" ou "20,586.50" ou "20586" em número.
 * Trata casos com ponto como milhar e vírgula como decimal.
 */
export function parseBRNumber(value: string): number | null {
  if (!value || value === "#DIV/0!" || value === "") return null;
  const cleaned = value.trim();
  // Se tem vírgula, assume formato BR (1.234,56)
  if (cleaned.includes(",")) {
    const normalized = cleaned.replace(/\./g, "").replace(",", ".");
    const num = parseFloat(normalized);
    return isNaN(num) ? null : num;
  }
  // Sem vírgula, pode ser "20.586" (BR sem decimal) ou "20586"
  // Heurística: se tem ponto e os dígitos depois são 3, é separador de milhar
  const dotMatch = cleaned.match(/^(\d+)\.(\d{3})$/);
  if (dotMatch) {
    return parseInt(dotMatch[1] + dotMatch[2], 10);
  }
  const num = parseFloat(cleaned);
  return isNaN(num) ? null : num;
}

/**
 * Normaliza a coluna "luxo?" do CSV pra 3 categorias.
 * Exemplos do CSV real:
 *   "sim" → sim
 *   "sim se precisar" → maybe
 *   "não" / "kkk não" / "não - vende perfume paralelo" → nao
 *   "médio" / "maybe" / "se precisar sim mas não é o perfil ideal" → maybe
 *   "ainda não" → maybe (não definitivo)
 *   "" → null
 */
export function normalizeLuxoLabel(
  raw: string
): "sim" | "nao" | "maybe" | null {
  if (!raw) return null;
  const v = raw.toLowerCase().trim();
  if (!v) return null;

  // "Maybe" patterns (qualquer ambiguidade)
  if (
    v.includes("maybe") ||
    v.includes("médio") ||
    v.includes("medio") ||
    v.includes("se precisar") ||
    v.includes("ainda não") ||
    v.includes("ainda nao") ||
    v.includes("mudou de") ||
    v.includes("sim ne mas assim") ||
    v.includes("ne mas assim")
  ) {
    return "maybe";
  }

  // "Não" patterns (definitivo)
  if (
    v.startsWith("não") ||
    v.startsWith("nao") ||
    v === "kkk não" ||
    v.includes("não ")
  ) {
    return "nao";
  }

  // "Sim" patterns (definitivo)
  if (v === "sim" || v.startsWith("sim") || v === "ok") {
    return "sim";
  }

  return null; // não conseguiu classificar
}

/**
 * Processa o CSV bruto e retorna afiliadas válidas (com GMV > 0 e handle extraído).
 * Linhas com GMV=0 ou sem handle são descartadas (não são afiliadas vendendo).
 * Dedupica por handle (mantém o primeiro com maior GMV).
 */
export function parseAffiliateCSV(csvText: string): {
  valid: ParsedAffiliate[];
  skipped: number;
  duplicates: number;
  total: number;
} {
  const result = Papa.parse<AffiliateCSVRow>(csvText, {
    header: true,
    skipEmptyLines: true,
  });

  const byHandle = new Map<string, ParsedAffiliate>();
  let skipped = 0;
  let duplicates = 0;

  for (const row of result.data) {
    const url = row["TikTok creator homepage"]?.trim();
    const handle = extractTikTokHandle(url);
    const gmv = parseBRNumber(row["GMV Total"]);

    // Pula linhas sem handle ou sem GMV (afiliadas inativas)
    if (!handle || !gmv || gmv <= 0) {
      skipped++;
      continue;
    }

    const labelRaw = row["luxo?"]?.trim() || null;
    const candidate: ParsedAffiliate = {
      tiktok_handle: handle,
      display_name: row["Creator name"]?.trim() || handle,
      gmv_total_brl: gmv,
      orders_total: parseBRNumber(row["Pedidos totais"]),
      avg_ticket_brl: parseBRNumber(row["Ticket Médio"]),
      loreal_human_label: labelRaw,
      loreal_human_label_normalized: labelRaw
        ? normalizeLuxoLabel(labelRaw)
        : null,
    };

    const existing = byHandle.get(handle);
    if (existing) {
      duplicates++;
      // Mantém o de maior GMV (somando ou ficando com o maior)
      const existingGMV = existing.gmv_total_brl ?? 0;
      if ((candidate.gmv_total_brl ?? 0) > existingGMV) {
        // Se a versão nova tem label e a antiga não, preserva label
        if (!candidate.loreal_human_label && existing.loreal_human_label) {
          candidate.loreal_human_label = existing.loreal_human_label;
          candidate.loreal_human_label_normalized =
            existing.loreal_human_label_normalized;
        }
        byHandle.set(handle, candidate);
      } else {
        // Se a antiga não tem label e a nova tem, atualiza label
        if (!existing.loreal_human_label && candidate.loreal_human_label) {
          existing.loreal_human_label = candidate.loreal_human_label;
          existing.loreal_human_label_normalized =
            candidate.loreal_human_label_normalized;
        }
      }
      continue;
    }

    byHandle.set(handle, candidate);
  }

  return {
    valid: Array.from(byHandle.values()),
    skipped,
    duplicates,
    total: result.data.length,
  };
}
