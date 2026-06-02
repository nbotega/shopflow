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

  try {
    const upstream = await fetch(target, {
      headers: {
        "User-Agent":
          "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0 Safari/537.36",
        Accept: "image/avif,image/webp,image/png,image/jpeg,*/*",
        Referer: "https://www.tiktok.com/",
      },
      // 10s timeout
      signal: AbortSignal.timeout(10000),
    });

    if (!upstream.ok) {
      return new NextResponse(`upstream ${upstream.status}`, {
        status: upstream.status,
      });
    }

    const contentType =
      upstream.headers.get("content-type") ?? "image/jpeg";
    const buffer = await upstream.arrayBuffer();

    return new NextResponse(buffer, {
      status: 200,
      headers: {
        "Content-Type": contentType,
        // 7 dias de cache
        "Cache-Control": "public, max-age=604800, s-maxage=604800, immutable",
      },
    });
  } catch (err) {
    return new NextResponse(
      `proxy failed: ${err instanceof Error ? err.message : "unknown"}`,
      { status: 500 }
    );
  }
}
