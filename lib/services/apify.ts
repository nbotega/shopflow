/**
 * Apify API wrapper — actor clockworks/tiktok-scraper
 * Docs: https://apify.com/clockworks/tiktok-scraper/api
 * Auth: ?token=apify_api_xxx
 * Custo: $1.70 / 1.000 results
 */

const BASE_URL = "https://api.apify.com/v2";
const ACTOR_ID = "clockworks~tiktok-scraper";

function getToken(): string {
  const t = process.env.APIFY_TOKEN;
  if (!t) throw new Error("APIFY_TOKEN não configurada");
  return t;
}

// ============================================================
// TIPOS — só campos que a gente usa do output
// ============================================================

export type ApifyTikTokAuthor = {
  id?: string;
  uid?: string;
  uniqueId?: string; // handle
  nickName?: string;
  nickname?: string;
  fans?: number; // follower count
  following?: number;
  heart?: number; // total likes
  video?: number; // video count
  verified?: boolean;
  signature?: string; // bio
  avatar?: string;
  avatar_larger?: { url_list?: Record<string, string> | string[] };
  avatar_medium?: { url_list?: Record<string, string> | string[] };
  region?: string;
};

export type ApifyTikTokVideo = {
  id: string; // video id
  text?: string; // caption
  createTime?: number; // unix
  createTimeISO?: string;
  authorMeta?: ApifyTikTokAuthor;
  videoMeta?: {
    duration?: number;
    height?: number;
    width?: number;
    downloadAddr?: string; // MP4 URL temporário
    coverUrl?: string;
    originalCoverUrl?: string;
  };
  webVideoUrl?: string;
  diggCount?: number; // likes
  shareCount?: number;
  playCount?: number; // views
  commentCount?: number;
  collectCount?: number;
  hashtags?: Array<{ id?: string; name?: string; title?: string }>;
  mentions?: string[];
  musicMeta?: { musicName?: string; musicAuthor?: string };
  // produtos TikTok Shop (se houver)
  isTikTokShop?: boolean;
};

// ============================================================
// API CALLS
// ============================================================

/**
 * Roda o actor síncrono e retorna os items do dataset.
 * Timeout do Apify default é 5min; pra perfil curto leva ~10-30s.
 *
 * Input shape pro clockworks/tiktok-scraper:
 * - profiles: array de handles (sem @)
 * - resultsPerPage: vídeos por perfil
 * - shouldDownloadVideos: false (pegamos só URL, baixamos sob demanda)
 */
export async function scrapeTikTokProfileVideos(
  handle: string,
  videosPerProfile: number = 20
): Promise<ApifyTikTokVideo[]> {
  const url = `${BASE_URL}/acts/${ACTOR_ID}/run-sync-get-dataset-items?token=${getToken()}`;

  const input = {
    profiles: [handle],
    resultsPerPage: videosPerProfile,
    profileScrapeSections: ["videos"],
    profileSorting: "latest",
    excludePinnedPosts: false,
    shouldDownloadVideos: false,
    shouldDownloadCovers: false,
    shouldDownloadSubtitles: false,
    shouldDownloadSlideshowImages: false,
    proxyCountryCode: "BR",
  };

  const res = await fetch(url, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(input),
  });

  if (!res.ok) {
    const body = await res.text().catch(() => "");
    throw new Error(
      `Apify TikTok scraper failed (${handle}): ${res.status} ${res.statusText} — ${body.slice(0, 300)}`
    );
  }

  const data = (await res.json()) as ApifyTikTokVideo[];
  return Array.isArray(data) ? data : [];
}

/**
 * Extrai um snapshot do perfil a partir do primeiro vídeo retornado.
 * (clockworks scraper anexa authorMeta em cada vídeo)
 */
export function extractProfileFromVideos(
  videos: ApifyTikTokVideo[]
): ApifyTikTokAuthor | null {
  for (const v of videos) {
    if (v.authorMeta?.uniqueId) return v.authorMeta;
  }
  return null;
}

// ============================================================
// PROFILE SCRAPER — actor dedicado clockworks/tiktok-profile-scraper
// Mais barato e direto que o scraper completo
// ============================================================

const PROFILE_ACTOR_ID = "clockworks~tiktok-profile-scraper";

export type ApifyTikTokProfile = {
  id?: string;
  uniqueId?: string;
  name?: string;
  nickName?: string;
  bio?: string;
  signature?: string;
  fans?: number;
  followers?: number;
  following?: number;
  heart?: number;
  hearts?: number;
  video?: number;
  videoCount?: number;
  verified?: boolean;
  region?: string;
  avatar?: string;
  avatarLarger?: string;
  avatarMedium?: string;
  avatarThumb?: string;
  // Alguns scrapers usam nested `authorMeta`:
  authorMeta?: ApifyTikTokAuthor;
};

/**
 * Pega snapshot público do perfil via Apify clockworks/tiktok-profile-scraper.
 * Retorna 1 record com avatar + métricas.
 */
export async function scrapeTikTokProfile(
  handle: string
): Promise<ApifyTikTokProfile | null> {
  const url = `${BASE_URL}/acts/${PROFILE_ACTOR_ID}/run-sync-get-dataset-items?token=${getToken()}`;
  const input = {
    profiles: [handle],
    resultsPerPage: 1,
    shouldDownloadVideos: false,
    shouldDownloadCovers: false,
    shouldDownloadSubtitles: false,
  };
  const res = await fetch(url, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(input),
  });
  if (!res.ok) {
    const body = await res.text().catch(() => "");
    throw new Error(
      `Apify profile-scraper falhou (${handle}): ${res.status} ${res.statusText} — ${body.slice(0, 200)}`
    );
  }
  const data = (await res.json()) as ApifyTikTokProfile[];
  if (!Array.isArray(data) || data.length === 0) return null;
  return data[0];
}

/**
 * Normaliza diferentes shapes que o actor pode devolver pra um objeto único.
 */
export function normalizeProfile(p: ApifyTikTokProfile): {
  user_id: string | null;
  display_name: string | null;
  bio: string | null;
  avatar_url: string | null;
  verified: boolean;
  follower_count: number | null;
  following_count: number | null;
  total_likes: number | null;
  video_count: number | null;
  region: string | null;
} {
  const meta = p.authorMeta;
  const fans = p.fans ?? p.followers ?? meta?.fans ?? null;
  const heart = p.heart ?? p.hearts ?? meta?.heart ?? null;
  const videoCount = p.video ?? p.videoCount ?? meta?.video ?? null;
  const following = p.following ?? meta?.following ?? null;
  const avatar =
    p.avatarLarger ??
    p.avatarMedium ??
    p.avatar ??
    p.avatarThumb ??
    meta?.avatar ??
    (typeof meta?.avatar_larger === "object"
      ? extractFirstUrl(meta?.avatar_larger?.url_list)
      : null);

  return {
    user_id: p.id ?? meta?.uid ?? null,
    display_name: p.nickName ?? p.name ?? meta?.nickname ?? null,
    bio: p.signature ?? p.bio ?? meta?.signature ?? null,
    avatar_url: avatar ?? null,
    verified: Boolean(p.verified ?? meta?.verified),
    follower_count: typeof fans === "number" ? fans : null,
    following_count: typeof following === "number" ? following : null,
    total_likes: typeof heart === "number" ? heart : null,
    video_count: typeof videoCount === "number" ? videoCount : null,
    region: p.region ?? meta?.region ?? null,
  };
}

function extractFirstUrl(
  list: Record<string, string> | string[] | undefined
): string | null {
  if (!list) return null;
  if (Array.isArray(list)) return list[0] ?? null;
  const values = Object.values(list);
  return values[0] ?? null;
}

// ============================================================
// DISCOVERY POR HASHTAG (clockworks/tiktok-scraper)
// Usa o mesmo actor principal com input de hashtags
// ============================================================

const HASHTAG_ACTOR_ID = "clockworks~tiktok-scraper";

/**
 * Busca vídeos populares por hashtag e retorna lista de authors únicos.
 * Útil pra descobrir afiliadas TikTok Shop BR ativas via hashtags como
 * #tiktokshopbrasil, #shopcreator, #beautybrasil.
 */
export async function scrapeTikTokByHashtags(
  hashtags: string[],
  resultsPerPage: number = 60
): Promise<ApifyTikTokVideo[]> {
  const url = `${BASE_URL}/acts/${HASHTAG_ACTOR_ID}/run-sync-get-dataset-items?token=${getToken()}`;
  const cleanHashtags = hashtags.map((h) => h.replace(/^#/, "").trim()).filter(Boolean);

  const input = {
    hashtags: cleanHashtags,
    resultsPerPage,
    shouldDownloadVideos: false,
    shouldDownloadCovers: false,
    shouldDownloadSubtitles: false,
    proxyCountryCode: "BR",
  };

  const res = await fetch(url, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(input),
  });

  if (!res.ok) {
    const body = await res.text().catch(() => "");
    throw new Error(
      `Apify hashtag scraper falhou: ${res.status} ${res.statusText} — ${body.slice(0, 200)}`
    );
  }

  const data = (await res.json()) as ApifyTikTokVideo[];
  return Array.isArray(data) ? data : [];
}

/**
 * Dedupica authors únicos a partir de uma lista de vídeos.
 */
export function extractUniqueAuthors(
  videos: ApifyTikTokVideo[]
): Map<string, ApifyTikTokAuthor> {
  const map = new Map<string, ApifyTikTokAuthor>();
  for (const v of videos) {
    const a = v.authorMeta;
    if (a?.uniqueId && !map.has(a.uniqueId)) {
      map.set(a.uniqueId, a);
    }
  }
  return map;
}

/**
 * Extrai hashtags como array de strings.
 */
export function extractHashtagNames(
  hashtags: ApifyTikTokVideo["hashtags"]
): string[] {
  if (!hashtags) return [];
  return hashtags
    .map((h) => h.name ?? h.title ?? "")
    .filter((s) => s.length > 0);
}
