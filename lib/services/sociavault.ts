/**
 * SociaVault API wrapper
 * Docs: https://docs.sociavault.com/api-reference/introduction
 * Auth: header X-API-Key: sk_live_xxx
 * Base: https://api.sociavault.com
 */

const BASE_URL = "https://api.sociavault.com";

function getApiKey(): string {
  const key = process.env.SOCIAVAULT_KEY;
  if (!key) throw new Error("SOCIAVAULT_KEY não configurada");
  return key;
}

async function sociavaultGet<T>(
  path: string,
  params: Record<string, string | number | undefined>
): Promise<T> {
  const url = new URL(`${BASE_URL}${path}`);
  Object.entries(params).forEach(([k, v]) => {
    if (v !== undefined && v !== null) url.searchParams.set(k, String(v));
  });

  const res = await fetch(url.toString(), {
    headers: {
      "X-API-Key": getApiKey(),
      Accept: "application/json",
    },
  });

  if (!res.ok) {
    const body = await res.text().catch(() => "");
    throw new Error(
      `SociaVault ${path} failed: ${res.status} ${res.statusText} — ${body.slice(0, 200)}`
    );
  }

  return res.json();
}

// ============================================================
// TIPOS — só os campos que a gente realmente usa.
// ============================================================

export type SociavaultUserInfo = {
  unique_id: string;
  uid: string;
  sec_uid?: string;
  nickname?: string;
  signature?: string;
  follower_count?: number;
  following_count?: number;
  total_favorited?: number;
  aweme_count?: number;
  custom_verify?: string;
  avatar_larger?: { url_list?: Record<string, string> | string[] };
  avatar_medium?: { url_list?: Record<string, string> | string[] };
};

export type SociavaultUserResult = {
  user_info: SociavaultUserInfo;
};

export type SociavaultSearchUsersResponse = {
  success: boolean;
  data: {
    cursor: number;
    has_more: number;
    user_list: Record<string, SociavaultUserResult> | SociavaultUserResult[];
    input_keyword?: string;
  };
  credits_used: number;
  endpoint: string;
};

export type SociavaultShopProduct = {
  product_id: string;
  title: string;
  sold_info?: { sold_count?: number };
  rate_info?: { score?: number; review_count?: string };
  seller_info?: { seller_id?: string; shop_name?: string };
  seo_url?: { canonical_url?: string; slug?: string };
};

export type SociavaultShopSearchResponse = {
  success: boolean;
  data: {
    success: boolean;
    query: string;
    total_products: number;
    products: Record<string, SociavaultShopProduct> | SociavaultShopProduct[];
  };
  credits_used: number;
  endpoint: string;
};

// SociaVault returns objects with numeric string keys instead of arrays. Normalize.
export function normalizeRecordToArray<T>(
  input: Record<string, T> | T[] | undefined | null
): T[] {
  if (!input) return [];
  if (Array.isArray(input)) return input;
  return Object.values(input);
}

export function extractAvatarUrl(
  avatar: SociavaultUserInfo["avatar_larger"] | undefined
): string | null {
  if (!avatar?.url_list) return null;
  const list = avatar.url_list;
  if (Array.isArray(list)) return list[0] ?? null;
  const values = Object.values(list);
  return values[0] ?? null;
}

// ============================================================
// ENDPOINTS
// ============================================================

/**
 * Search TikTok users matching a keyword.
 * Custo: 1 crédito por chamada. Retorna até 30 users por página.
 */
export async function searchTikTokUsers(
  query: string,
  cursor?: number
): Promise<SociavaultSearchUsersResponse> {
  return sociavaultGet<SociavaultSearchUsersResponse>(
    "/v1/scrape/tiktok/search/users",
    { query, cursor }
  );
}

/**
 * Search TikTok Shop products by keyword + region.
 * Útil pra descobrir produtos da marca sendo vendidos no shop.
 */
export async function searchTikTokShop(
  query: string,
  region: string = "BR",
  page?: number
): Promise<SociavaultShopSearchResponse> {
  return sociavaultGet<SociavaultShopSearchResponse>(
    "/v1/scrape/tiktok-shop/search",
    { query, region, page }
  );
}

/**
 * Get current credits balance (1 credit = 1 standard call).
 */
export async function getCreditsBalance(): Promise<{
  success: boolean;
  credits: number;
}> {
  return sociavaultGet("/v1/scrape/credits", {});
}

// ============================================================
// PROFILE
// ============================================================

export type SociavaultProfileResponse = {
  success: boolean;
  data: {
    success: boolean;
    user: {
      id: string;
      uniqueId: string;
      nickname?: string;
      avatarLarger?: string;
      avatarMedium?: string;
      avatarThumb?: string;
      signature?: string;
      verified?: boolean;
      privateAccount?: boolean;
      secUid?: string;
      bioLink?: { link?: string };
    };
    stats: {
      followerCount?: number;
      followingCount?: number;
      heart?: number;
      heartCount?: number;
      videoCount?: number;
    };
  };
  credits_used: number;
  endpoint: string;
};

export async function getTikTokProfile(
  handle: string
): Promise<SociavaultProfileResponse> {
  return sociavaultGet<SociavaultProfileResponse>(
    "/v1/scrape/tiktok/profile",
    { handle }
  );
}

// ============================================================
// TRANSCRIPT
// ============================================================

export type SociavaultTranscriptResponse = {
  success: boolean;
  data: {
    id: string;
    url: string;
    transcript: string; // formato WEBVTT
  };
  credits_used: number;
  endpoint: string;
};

/**
 * Pega transcript de UM vídeo TikTok via SociaVault.
 * Custo: 1 crédito (10 com AI fallback).
 * Retorna WEBVTT que precisa ser parseado pra texto puro.
 */
export async function getTikTokTranscript(
  url: string,
  language: string = "pt",
  useAiFallback: boolean = false
): Promise<SociavaultTranscriptResponse> {
  return sociavaultGet<SociavaultTranscriptResponse>(
    "/v1/scrape/tiktok/transcript",
    {
      url,
      language,
      use_ai_as_fallback: useAiFallback ? "true" : undefined,
    }
  );
}

/**
 * Parse WEBVTT em (a) texto puro e (b) segments com timestamps.
 * Formato esperado:
 *   WEBVTT
 *
 *   00:00:00.120 --> 00:00:01.840
 *   Alright, pizza review time.
 */
export function parseWebVTT(vtt: string): {
  fullText: string;
  segments: Array<{ start: string; end: string; text: string }>;
} {
  const segments: Array<{ start: string; end: string; text: string }> = [];
  if (!vtt) return { fullText: "", segments };

  const lines = vtt.split(/\r?\n/);
  let i = 0;
  // Skip header
  while (i < lines.length && !lines[i].includes("-->")) i++;

  while (i < lines.length) {
    const tsLine = lines[i];
    const match = tsLine.match(
      /^(\d\d:\d\d:\d\d[.,]\d{3})\s*-->\s*(\d\d:\d\d:\d\d[.,]\d{3})/
    );
    if (!match) {
      i++;
      continue;
    }
    const start = match[1];
    const end = match[2];
    const textLines: string[] = [];
    i++;
    while (i < lines.length && lines[i].trim() !== "") {
      // pula se for outro timestamp (não deveria, mas safety)
      if (lines[i].includes("-->")) break;
      textLines.push(lines[i].trim());
      i++;
    }
    const text = textLines.join(" ").trim();
    if (text) segments.push({ start, end, text });
    i++;
  }

  const fullText = segments.map((s) => s.text).join(" ").trim();
  return { fullText, segments };
}
