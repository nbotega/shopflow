import { NextResponse } from "next/server";

export const runtime = "nodejs";

const ALLOWED_HOSTS = [
  "tiktokcdn.com",
  "tiktokcdn-us.com",
  "tiktokcdn-eu.com",
  "ttcdn-us.com",
  "tiktok.com",
];

/**
 * GET /api/img?url=<tiktok-cdn-url>
 * Server-side image proxy — bypassa o hotlinking protection
 * do TikTok CDN e serve com cache agressivo.
 */
export async function GET(request: Request) {
  const url = new URL(request.url);
  const target = url.searchParams.get("url");
  if (!target) return new NextResponse("missing url", { status: 400 });

  // Whitelist por host (segurança)
  let parsed: URL;
  try {
    parsed = new URL(target);
  } catch {
    return new NextResponse("invalid url", { status: 400 });
  }

  const allowed = ALLOWED_HOSTS.some((h) => parsed.host.endsWith(h));
  if (!allowed) return new NextResponse("host not allowed", { status: 400 });

  // Tenta múltiplas combinações de headers — alguns CDNs do TikTok bloqueiam
  // certos User-Agents ou exigem Referer específico
  const headerSets = [
    {
      "User-Agent":
        "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0 Safari/537.36",
      Accept: "image/avif,image/webp,image/png,image/jpeg,*/*",
      Referer: "https://www.tiktok.com/",
    },
    {
      "User-Agent":
        "Mozilla/5.0 (iPhone; CPU iPhone OS 17_0 like Mac OS X) AppleWebKit/605.1.15",
      Accept: "image/*,*/*;q=0.8",
    },
    {
      Accept: "*/*",
    },
  ];

  let lastError = "unknown";
  for (const headers of headerSets) {
    try {
      const upstream = await fetch(target, {
        headers,
        redirect: "follow",
        signal: AbortSignal.timeout(8000),
      });

      if (!upstream.ok) {
        lastError = `${upstream.status} ${upstream.statusText}`;
        continue;
      }

      const contentType = upstream.headers.get("content-type") ?? "image/jpeg";
      // Algumas CDNs retornam text/html em erro mesmo com 200
      if (!contentType.startsWith("image/")) {
        lastError = `not an image: ${contentType}`;
        continue;
      }

      const buffer = await upstream.arrayBuffer();

      return new NextResponse(buffer, {
        status: 200,
        headers: {
          "Content-Type": contentType,
          "Cache-Control": "public, max-age=604800, s-maxage=604800, immutable",
        },
      });
    } catch (err) {
      lastError = err instanceof Error ? err.message : "unknown";
    }
  }

  return new NextResponse(`proxy failed: ${lastError}`, { status: 502 });
}
