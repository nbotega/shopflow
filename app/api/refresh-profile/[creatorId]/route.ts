import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { getTikTokProfile } from "@/lib/services/sociavault";

export const runtime = "nodejs";
export const maxDuration = 30;

/**
 * POST /api/refresh-profile/[creatorId]
 * Atualiza avatar + métricas do perfil via SociaVault.
 * Custo: 1 crédito por creator.
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
    const resp = await getTikTokProfile(creator.tiktok_handle);
    const u = resp.data?.user;
    const s = resp.data?.stats;

    if (!u) {
      return NextResponse.json({
        success: false,
        handle: creator.tiktok_handle,
        error: "SociaVault não retornou user",
      });
    }

    await admin
      .from("creators")
      .update({
        tiktok_user_id: u.id ?? null,
        display_name: u.nickname ?? null,
        bio: u.signature ?? null,
        avatar_url: u.avatarLarger ?? u.avatarMedium ?? u.avatarThumb ?? null,
        verified: Boolean(u.verified),
        follower_count: s?.followerCount ?? null,
        following_count: s?.followingCount ?? null,
        total_likes: s?.heart ?? s?.heartCount ?? null,
      })
      .eq("id", creator.id);

    return NextResponse.json({
      success: true,
      handle: creator.tiktok_handle,
      avatar: u.avatarLarger ?? u.avatarMedium ?? u.avatarThumb ?? null,
      followers: s?.followerCount ?? null,
      verified: Boolean(u.verified),
    });
  } catch (err) {
    const msg = err instanceof Error ? err.message : String(err);
    return NextResponse.json(
      { success: false, handle: creator.tiktok_handle, error: msg },
      { status: 500 }
    );
  }
}
