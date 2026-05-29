import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { scrapeTikTokByHashtags, extractUniqueAuthors } from "@/lib/services/apify";

export const runtime = "nodejs";
export const maxDuration = 60;

const DEFAULT_HASHTAGS = [
  "tiktokshopbrasil",
  "shopcreator",
  "tiktokshopbr",
  "maquiagemtiktok",
  "beautybrasil",
  "tiktokshopbeauty",
];

/**
 * POST /api/discover/by-hashtag
 * Body: { hashtags?: string[], resultsPerPage?: number }
 *
 * Descobre afiliadas TikTok Shop BR via hashtags populares.
 * Cria creators novas (com GMV null — virão depois via outras fontes ou CSV).
 */
export async function POST(request: Request) {
  const supabase = await createClient();
  const {
    data: { user },
    error: authError,
  } = await supabase.auth.getUser();

  if (authError || !user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const body = (await request.json().catch(() => ({}))) as {
    hashtags?: string[];
    resultsPerPage?: number;
  };

  const hashtags = body.hashtags?.length ? body.hashtags : DEFAULT_HASHTAGS;
  const resultsPerPage = Math.min(Math.max(body.resultsPerPage ?? 60, 20), 200);

  const admin = createAdminClient();

  try {
    const videos = await scrapeTikTokByHashtags(hashtags, resultsPerPage);
    const authors = extractUniqueAuthors(videos);

    if (authors.size === 0) {
      return NextResponse.json({
        success: true,
        hashtags,
        videos_scraped: videos.length,
        unique_authors: 0,
        new_creators: 0,
      });
    }

    // Verifica quais já existem
    const handles = Array.from(authors.keys()).map((h) => h.toLowerCase());
    const { data: existing } = await admin
      .from("creators")
      .select("tiktok_handle")
      .in("tiktok_handle", handles);
    const existingSet = new Set((existing ?? []).map((c) => c.tiktok_handle));

    // Insere os novos
    const newAuthors = Array.from(authors.entries()).filter(
      ([h]) => !existingSet.has(h.toLowerCase())
    );

    const rows = newAuthors.map(([handle, a]) => ({
      tiktok_handle: handle.toLowerCase(),
      tiktok_user_id: a.id ?? null,
      display_name: a.nickName ?? a.nickname ?? null,
      bio: a.signature ?? null,
      follower_count: typeof a.fans === "number" ? a.fans : null,
      total_likes: typeof a.heart === "number" ? a.heart : null,
      avatar_url:
        a.avatar ??
        (a.avatar_larger
          ? extractFirstUrlSafe(a.avatar_larger.url_list)
          : null),
      verified: Boolean(a.verified),
      region: a.region ?? "BR",
      import_source: `hashtag:${hashtags.join(",")}`,
      enrichment_status: "pending",
    }));

    let inserted = 0;
    if (rows.length > 0) {
      const { data: inserted_rows, error } = await admin
        .from("creators")
        .upsert(rows, { onConflict: "tiktok_handle", ignoreDuplicates: true })
        .select("id");
      if (error) {
        return NextResponse.json(
          { success: false, error: `DB insert: ${error.message}` },
          { status: 500 }
        );
      }
      inserted = inserted_rows?.length ?? 0;

      // Cria assignments pras 2 brands ativas
      const { data: brands } = await admin
        .from("brands")
        .select("id, client_id")
        .eq("active", true);

      if (inserted_rows && brands && brands.length > 0) {
        const assignments = inserted_rows.flatMap((c) =>
          brands.map((b) => ({
            creator_id: c.id,
            brand_id: b.id,
            client_id: b.client_id,
            discovery_source: `hashtag`,
            status: "pending" as const,
          }))
        );
        await admin
          .from("creator_brand_assignments")
          .upsert(assignments, {
            onConflict: "creator_id,brand_id,client_id",
            ignoreDuplicates: true,
          });
      }
    }

    return NextResponse.json({
      success: true,
      hashtags,
      videos_scraped: videos.length,
      unique_authors: authors.size,
      already_in_pool: authors.size - newAuthors.length,
      new_creators: inserted,
    });
  } catch (err) {
    const msg = err instanceof Error ? err.message : String(err);
    return NextResponse.json(
      { success: false, error: msg },
      { status: 500 }
    );
  }
}

function extractFirstUrlSafe(
  list: Record<string, string> | string[] | undefined
): string | null {
  if (!list) return null;
  if (Array.isArray(list)) return list[0] ?? null;
  const v = Object.values(list);
  return v[0] ?? null;
}
