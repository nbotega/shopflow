import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { createAdminClient } from "@/lib/supabase/admin";
import {
  scrapeTikTokProfileVideos,
  extractProfileFromVideos,
  extractHashtagNames,
} from "@/lib/services/apify";

export const runtime = "nodejs";
export const maxDuration = 60;

/**
 * POST /api/enrich/[creatorId]
 *
 * Enriquece UMA afiliada via Apify clockworks/tiktok-scraper:
 * - Pega últimos 20 vídeos
 * - Atualiza perfil (followers, bio, avatar)
 * - Insere vídeos na tabela videos
 * - Marca creator como 'enriched'
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

  // Carrega creator
  const { data: creator, error: creatorError } = await admin
    .from("creators")
    .select("id, tiktok_handle")
    .eq("id", creatorId)
    .single();

  if (creatorError || !creator) {
    return NextResponse.json(
      { error: "Creator não encontrado" },
      { status: 404 }
    );
  }

  // Marca como enriching
  await admin
    .from("creators")
    .update({ enrichment_status: "enriching", enrichment_error: null })
    .eq("id", creator.id);

  try {
    const rawVideos = await scrapeTikTokProfileVideos(creator.tiktok_handle, 20);
    // Filtra vídeos sem id (algumas linhas do Apify vêm sem campo, quebrava o INSERT)
    const videos = rawVideos.filter((v) => typeof v.id === "string" && v.id.length > 0);

    if (videos.length === 0) {
      await admin
        .from("creators")
        .update({
          enrichment_status: "failed",
          enrichment_error: "Apify retornou 0 vídeos (perfil privado ou não existe)",
          last_enriched_at: new Date().toISOString(),
        })
        .eq("id", creator.id);

      return NextResponse.json(
        {
          success: false,
          handle: creator.tiktok_handle,
          videos_count: 0,
          error: "Nenhum vídeo retornado",
        },
        { status: 200 }
      );
    }

    // Atualiza perfil a partir do snapshot
    const profile = extractProfileFromVideos(videos);
    if (profile) {
      await admin
        .from("creators")
        .update({
          tiktok_user_id: profile.id ?? null,
          display_name: profile.nickName ?? null,
          bio: profile.signature ?? null,
          follower_count: profile.fans ?? null,
          following_count: profile.following ?? null,
          total_likes: profile.heart ?? null,
          avatar_url: profile.avatar ?? null,
          verified: Boolean(profile.verified),
          region: profile.region ?? null,
        })
        .eq("id", creator.id);
    }

    // Insere vídeos
    const videoRows = videos.map((v) => ({
      creator_id: creator.id,
      tiktok_video_id: v.id,
      url: v.webVideoUrl ?? `https://www.tiktok.com/@${creator.tiktok_handle}/video/${v.id}`,
      caption: v.text ?? null,
      hashtags: extractHashtagNames(v.hashtags),
      duration_seconds: v.videoMeta?.duration ?? null,
      view_count: v.playCount ?? null,
      like_count: v.diggCount ?? null,
      comment_count: v.commentCount ?? null,
      share_count: v.shareCount ?? null,
      posted_at: v.createTimeISO
        ? v.createTimeISO
        : v.createTime
          ? new Date(v.createTime * 1000).toISOString()
          : null,
      products_featured: v.isTikTokShop ? { is_tiktok_shop: true } : null,
      thumbnail_url: v.videoMeta?.coverUrl ?? null,
      raw_apify_data: v as unknown as Record<string, unknown>,
    }));

    const { error: videosError } = await admin
      .from("videos")
      .upsert(videoRows, { onConflict: "tiktok_video_id", ignoreDuplicates: false });

    // Atualiza status final
    await admin
      .from("creators")
      .update({
        enrichment_status: videosError ? "failed" : "enriched",
        enrichment_error: videosError?.message ?? null,
        last_enriched_at: new Date().toISOString(),
        raw_apify_data: { last_scrape: { videos_count: videos.length } },
      })
      .eq("id", creator.id);

    return NextResponse.json({
      success: !videosError,
      handle: creator.tiktok_handle,
      videos_count: videos.length,
      profile_updated: !!profile,
      error: videosError?.message ?? null,
    });
  } catch (err) {
    const msg = err instanceof Error ? err.message : String(err);
    await admin
      .from("creators")
      .update({
        enrichment_status: "failed",
        enrichment_error: msg.slice(0, 500),
        last_enriched_at: new Date().toISOString(),
      })
      .eq("id", creator.id);

    return NextResponse.json(
      { success: false, handle: creator.tiktok_handle, error: msg },
      { status: 500 }
    );
  }
}
