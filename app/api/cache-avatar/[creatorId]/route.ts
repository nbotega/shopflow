import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { createAdminClient } from "@/lib/supabase/admin";

export const runtime = "nodejs";
export const maxDuration = 30;

const FETCH_HEADERS_VARIANTS: Array<Record<string, string>> = [
  {
    "User-Agent":
      "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0 Safari/537.36",
    Accept: "image/avif,image/webp,image/*,*/*;q=0.8",
    Referer: "https://www.tiktok.com/",
  },
  {
    "User-Agent":
      "Mozilla/5.0 (iPhone; CPU iPhone OS 17_0 like Mac OS X) AppleWebKit/605.1.15",
    Accept: "*/*",
  },
];

async function fetchImage(url: string): Promise<{ buffer: Buffer; contentType: string } | null> {
  for (const headers of FETCH_HEADERS_VARIANTS) {
    try {
      const res = await fetch(url, {
        headers,
        redirect: "follow",
        signal: AbortSignal.timeout(8000),
      });
      if (!res.ok) continue;
      const contentType = res.headers.get("content-type") ?? "image/jpeg";
      if (!contentType.startsWith("image/")) continue;
      const buffer = Buffer.from(await res.arrayBuffer());
      return { buffer, contentType };
    } catch {
      // try next
    }
  }
  return null;
}

function extFromMime(mime: string): string {
  if (mime.includes("png")) return "png";
  if (mime.includes("webp")) return "webp";
  return "jpg";
}

/**
 * POST /api/cache-avatar/[creatorId]
 * Baixa avatar do TikTok CDN e salva no Supabase Storage.
 * Atualiza avatar_url pra apontar pro storage (URL permanente).
 */
export async function POST(
  request: Request,
  ctx: { params: Promise<{ creatorId: string }> }
) {
  const supabase = await createClient();
  const {
    data: { user },
    error: authError,
  } = await supabase.auth.getUser();

  if (authError || !user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const { creatorId } = await ctx.params;
  const admin = createAdminClient();

  const { data: creator } = await admin
    .from("creators")
    .select("id, tiktok_handle, avatar_url")
    .eq("id", creatorId)
    .single();

  if (!creator) {
    return NextResponse.json({ error: "not found" }, { status: 404 });
  }

  // Se avatar já tá no storage, pula
  if (creator.avatar_url?.includes("/storage/v1/object/public/avatars/")) {
    return NextResponse.json({
      success: true,
      handle: creator.tiktok_handle,
      skipped: "already_cached",
    });
  }

  if (!creator.avatar_url) {
    return NextResponse.json({
      success: false,
      handle: creator.tiktok_handle,
      error: "no avatar_url",
    });
  }

  const img = await fetchImage(creator.avatar_url);
  if (!img) {
    return NextResponse.json({
      success: false,
      handle: creator.tiktok_handle,
      error: "fetch failed all variants",
    });
  }

  const ext = extFromMime(img.contentType);
  const path = `${creator.tiktok_handle}.${ext}`;

  const { error: uploadErr } = await admin.storage
    .from("avatars")
    .upload(path, img.buffer, {
      contentType: img.contentType,
      upsert: true,
      cacheControl: "604800",
    });

  if (uploadErr) {
    return NextResponse.json(
      {
        success: false,
        handle: creator.tiktok_handle,
        error: `upload: ${uploadErr.message}`,
      },
      { status: 500 }
    );
  }

  const {
    data: { publicUrl },
  } = admin.storage.from("avatars").getPublicUrl(path);

  await admin
    .from("creators")
    .update({ avatar_url: publicUrl })
    .eq("id", creator.id);

  return NextResponse.json({
    success: true,
    handle: creator.tiktok_handle,
    new_url: publicUrl,
  });
}
