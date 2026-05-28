import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { getTikTokDownloadUrl, downloadVideoBytes } from "@/lib/services/tikwm";
import { analyzeVideoAesthetics } from "@/lib/services/gemini";

export const runtime = "nodejs";
export const maxDuration = 60;

// Top 1 vídeo só, pra caber no timeout de 60s do Vercel Hobby
// (cada vídeo: ~5s download + ~15-25s Gemini = ~30s, sobra margem)
const TOP_N_VIDEOS = 1;

/**
 * POST /api/analyze-visual/[creatorId]
 *
 * Pega TOP 3 vídeos mais vistos do creator,
 * baixa MP4 sem watermark via TikWM,
 * manda pro Gemini analisar estética,
 * salva em visual_analyses.
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

  // Pega TOP 3 vídeos por views
  const { data: videos } = await admin
    .from("videos")
    .select("id, url, tiktok_video_id, view_count, duration_seconds")
    .eq("creator_id", creator.id)
    .order("view_count", { ascending: false, nullsFirst: false })
    .limit(TOP_N_VIDEOS);

  if (!videos || videos.length === 0) {
    return NextResponse.json({
      success: false,
      handle: creator.tiktok_handle,
      error: "Sem vídeos pra analisar",
    });
  }

  // Filtra vídeos que já têm análise
  const videoIds = videos.map((v) => v.id);
  const { data: existing } = await admin
    .from("visual_analyses")
    .select("video_id")
    .in("video_id", videoIds);

  const existingSet = new Set((existing ?? []).map((a) => a.video_id));
  const pending = videos.filter((v) => !existingSet.has(v.id));

  if (pending.length === 0) {
    return NextResponse.json({
      success: true,
      handle: creator.tiktok_handle,
      analyzed: 0,
      message: "Top vídeos já analisados",
    });
  }

  let succeeded = 0;
  let failed = 0;
  let totalCost = 0;
  const errors: string[] = [];

  for (const v of pending) {
    try {
      const { mp4Url, sizeBytes } = await getTikTokDownloadUrl(v.url);
      if (sizeBytes > 18 * 1024 * 1024) {
        errors.push(`${v.tiktok_video_id}: vídeo > 18MB`);
        failed++;
        continue;
      }

      const buffer = await downloadVideoBytes(mp4Url);
      const result = await analyzeVideoAesthetics(buffer);
      totalCost += result.cost_usd;

      const { error: saveErr } = await admin.from("visual_analyses").upsert(
        {
          video_id: v.id,
          model: result.model,
          aesthetic_score:
            result.analysis.brand_aesthetic_match.ysl_score >=
            result.analysis.brand_aesthetic_match.lancome_score
              ? result.analysis.brand_aesthetic_match.ysl_score
              : result.analysis.brand_aesthetic_match.lancome_score,
          production_quality_score: result.analysis.producao_quality_score,
          visual_summary: result.analysis.summary,
          detected_elements: {
            paleta: result.analysis.paleta_dominante,
            iluminacao: result.analysis.iluminacao,
            cenario: result.analysis.cenario,
            vibe: result.analysis.vibe,
            luxo: result.analysis.elementos_luxo_detectados,
            anti_luxo: result.analysis.elementos_anti_luxo_detectados,
          },
          brand_aesthetic_match: result.analysis.brand_aesthetic_match,
          raw_response: result.raw_response,
          cost_usd: result.cost_usd,
        },
        { onConflict: "video_id" }
      );

      if (saveErr) {
        errors.push(`${v.tiktok_video_id}: DB ${saveErr.message}`);
        failed++;
      } else {
        succeeded++;
      }
    } catch (err) {
      const msg = err instanceof Error ? err.message : String(err);
      errors.push(`${v.tiktok_video_id}: ${msg.slice(0, 100)}`);
      failed++;
    }
  }

  return NextResponse.json({
    success: succeeded > 0,
    handle: creator.tiktok_handle,
    analyzed: succeeded,
    failed,
    cost_usd: totalCost,
    errors,
  });
}
