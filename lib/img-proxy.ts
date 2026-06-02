/**
 * Wrapper utility — transforma URLs TikTok CDN em URLs proxied
 * pelo nosso endpoint /api/img, que bypassa hotlinking protection.
 */
export function proxyImageUrl(url: string | null | undefined): string | null {
  if (!url) return null;
  // Se já é proxied ou não é TikTok CDN, retorna direto
  if (url.startsWith("/api/img")) return url;
  if (!/(tiktokcdn|ttcdn|tiktok\.com)/i.test(url)) return url;
  return `/api/img?url=${encodeURIComponent(url)}`;
}
