import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { scrapeTikTokProfile, normalizeProfile } from "@/lib/services/apify";

export const runtime = "nodejs";
export const maxDuration = 60;

/**
 * POST /api/refresh-profile/[creatorId]
 * Atualiza avatar + métricas via Apify clockworks/tiktok-profile-scraper.
 * Custo: ~$0.0005 por creator.
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
    .select("id, tiktok_handle")
    .eq("id", creatorId)
    .single();

  if (!creator) {
    return NextResponse.json(
      { error: "Creator não encontrado" },
      { status: 404 }
    );
  }

  try {
    const profile = await scrapeTikTokProfile(creator.tiktok_handle);

    if (!profile) {
      return NextResponse.json({
        success: false,
        handle: creator.tiktok_handle,
        error: "Apify não retornou dados (perfil privado ou inexistente)",
      });
    }

    const n = normalizeProfile(profile);

    await admin
      .from("creators")
      .update({
        tiktok_user_id: n.user_id,
        display_name: n.display_name,
        bio: n.bio,
        avatar_url: n.avatar_url,
        verified: n.verified,
        follower_count: n.follower_count,
        following_count: n.following_count,
        total_likes: n.total_likes,
        region: n.region,
      })
      .eq("id", creator.id);

    return NextResponse.json({
      success: true,
      handle: creator.tiktok_handle,
      avatar: n.avatar_url,
      followers: n.follower_count,
      verified: n.verified,
    });
  } catch (err) {
    const msg = err instanceof Error ? err.message : String(err);
    return NextResponse.json(
      { success: false, handle: creator.tiktok_handle, error: msg },
      { status: 500 }
    );
  }
}
