import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { createAdminClient } from "@/lib/supabase/admin";
import {
  judgeCreatorForBrand,
  type CreatorContextForJudgment,
} from "@/lib/services/claude";

export const runtime = "nodejs";
export const maxDuration = 60;

/**
 * POST /api/judge/[assignmentId]
 *
 * Roda Claude judgment em UM assignment (creator × brand específico).
 * Carrega contexto completo, chama Claude com Brand Constitution,
 * salva score na tabela scores.
 */
export async function POST(
  request: Request,
  ctx: { params: Promise<{ assignmentId: string }> }
) {
  const supabase = await createClient();
  const {
    data: { user },
    error: authError,
  } = await supabase.auth.getUser();

  if (authError || !user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const { assignmentId } = await ctx.params;
  const admin = createAdminClient();

  // Carrega assignment + brand + creator
  const { data: assignment, error: assignError } = await admin
    .from("creator_brand_assignments")
    .select(
      `
      id, status,
      creator:creators(
        id, tiktok_handle, display_name, bio, follower_count, total_likes,
        verified, gmv_total_brl, orders_total, avg_ticket_brl
      ),
      brand:brands(id, name, brand_constitution, client_id)
      `
    )
    .eq("id", assignmentId)
    .single();

  if (assignError || !assignment) {
    return NextResponse.json(
      { error: "Assignment não encontrado" },
      { status: 404 }
    );
  }

  // Supabase nested select pode vir como array OU object — normaliza
  const creatorRow = Array.isArray(assignment.creator)
    ? assignment.creator[0]
    : assignment.creator;
  const brandRow = Array.isArray(assignment.brand)
    ? assignment.brand[0]
    : assignment.brand;

  if (!creatorRow || !brandRow) {
    return NextResponse.json(
      { error: "Creator ou brand não encontrados no assignment" },
      { status: 404 }
    );
  }

  // Marca como analyzing
  await admin
    .from("creator_brand_assignments")
    .update({ status: "analyzing" })
    .eq("id", assignmentId);

  try {
    // Carrega vídeos + transcripts (top 15 mais vistos)
    const { data: videos } = await admin
      .from("videos")
      .select(
        "id, caption, hashtags, view_count, like_count, duration_seconds, posted_at, products_featured"
      )
      .eq("creator_id", creatorRow.id)
      .order("view_count", { ascending: false, nullsFirst: false })
      .limit(15);

    const videoIds = (videos ?? []).map((v) => v.id);
    const { data: transcripts } = await admin
      .from("transcripts")
      .select("video_id, full_text")
      .in("video_id", videoIds);

    const transcriptMap = new Map(
      (transcripts ?? []).map((t) => [t.video_id, t.full_text])
    );

    const creatorContext: CreatorContextForJudgment = {
      handle: creatorRow.tiktok_handle,
      display_name: creatorRow.display_name,
      bio: creatorRow.bio,
      follower_count: creatorRow.follower_count,
      total_likes: creatorRow.total_likes,
      verified: Boolean(creatorRow.verified),
      gmv_total_brl: creatorRow.gmv_total_brl,
      orders_total: creatorRow.orders_total,
      avg_ticket_brl: creatorRow.avg_ticket_brl,
      videos: (videos ?? []).map((v) => ({
        caption: v.caption,
        hashtags: (v.hashtags as string[]) ?? [],
        view_count: v.view_count,
        like_count: v.like_count,
        duration_seconds: v.duration_seconds,
        posted_at: v.posted_at,
        transcript: transcriptMap.get(v.id) ?? null,
        is_tiktok_shop: Boolean(
          (v.products_featured as { is_tiktok_shop?: boolean } | null)
            ?.is_tiktok_shop
        ),
      })),
    };

    const judgment = await judgeCreatorForBrand(
      brandRow.name,
      brandRow.brand_constitution ?? "",
      creatorContext
    );

    // Invalida scores antigos
    await admin
      .from("scores")
      .update({ is_latest: false })
      .eq("assignment_id", assignmentId)
      .eq("is_latest", true);

    // Salva novo score
    const { error: scoreError } = await admin.from("scores").insert({
      assignment_id: assignmentId,
      creator_id: creatorRow.id,
      brand_id: brandRow.id,
      client_id: brandRow.client_id,
      luxo_fit_score: judgment.score.luxo_fit_score,
      recommendation: judgment.score.recommendation,
      scores_by_criteria: judgment.score.scores_by_criteria,
      justificativa_resumida: judgment.score.justificativa_resumida,
      evidencias: judgment.score.evidencias,
      red_flags: judgment.score.red_flags,
      sugestao_acao: judgment.score.sugestao_acao,
      videos_analyzed: creatorContext.videos.length,
      claude_model: judgment.model,
      cost_usd: judgment.cost_usd,
      raw_response: judgment.raw_response,
      is_latest: true,
    });

    if (scoreError) {
      await admin
        .from("creator_brand_assignments")
        .update({ status: "failed" })
        .eq("id", assignmentId);
      throw new Error(`DB save: ${scoreError.message}`);
    }

    await admin
      .from("creator_brand_assignments")
      .update({ status: "completed" })
      .eq("id", assignmentId);

    return NextResponse.json({
      success: true,
      handle: creatorRow.tiktok_handle,
      brand: brandRow.name,
      score: judgment.score.luxo_fit_score,
      recommendation: judgment.score.recommendation,
      cost_usd: judgment.cost_usd,
      tokens: {
        input: judgment.input_tokens,
        output: judgment.output_tokens,
      },
    });
  } catch (err) {
    const msg = err instanceof Error ? err.message : String(err);
    await admin
      .from("creator_brand_assignments")
      .update({ status: "failed" })
      .eq("id", assignmentId);
    return NextResponse.json(
      { success: false, error: msg },
      { status: 500 }
    );
  }
}
