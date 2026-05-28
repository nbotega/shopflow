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
  uniqueId?: string; // handle
  nickName?: string;
  fans?: number; // follower count
  following?: number;
  heart?: number; // total likes
  video?: number; // video count
  verified?: boolean;
  signature?: string; // bio
  avatar?: string;
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
