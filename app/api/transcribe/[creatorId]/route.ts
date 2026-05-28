import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { createAdminClient } from "@/lib/supabase/admin";
import {
  getTikTokTranscript,
  parseWebVTT,
} from "@/lib/services/sociavault";

export const runtime = "nodejs";
export const maxDuration = 60;

const PARALLEL = 4; // requests SociaVault simultâneas por creator

/**
 * POST /api/transcribe/[creatorId]
 *
 * Transcreve TODOS vídeos não-transcritos de UMA afiliada via SociaVault.
 * Custo: 1 crédito por vídeo (pula vídeos que já têm transcript).
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

  // Marca como transcribing
  await admin
    .from("creators")
    .update({ transcripts_status: "transcribing", transcripts_error: null })
    .eq("id", creator.id);

  // Pega vídeos sem transcript
  const { data: videos } = await admin
    .from("videos")
    .select("id, url, tiktok_video_id")
    .eq("creator_id", creator.id);

  if (!videos || videos.length === 0) {
    await admin
      .from("creators")
      .update({
        transcripts_status: "done",
        transcripts_done_count: 0,
      })
      .eq("id", creator.id);
    return NextResponse.json({
      success: true,
      handle: creator.tiktok_handle,
      transcribed: 0,
      message: "Sem vídeos pra transcrever",
    });
  }

  // Filtra os que já têm transcript
  const videoIds = videos.map((v) => v.id);
  const { data: existing } = await admin
    .from("transcripts")
    .select("video_id")
    .in("video_id", videoIds);

  const existingSet = new Set((existing ?? []).map((t) => t.video_id));
  const pending = videos.filter((v) => !existingSet.has(v.id));

  if (pending.length === 0) {
    await admin
      .from("creators")
      .update({
        transcripts_status: "done",
        transcripts_done_count: videos.length,
      })
      .eq("id", creator.id);
    return NextResponse.json({
      success: true,
      handle: creator.tiktok_handle,
      transcribed: 0,
      total: videos.length,
      message: "Todos vídeos já transcritos",
    });
  }

  // Processa em chunks paralelos
  let succeeded = 0;
  let failed = 0;
  let creditsUsed = 0;
  const errors: string[] = [];

  for (let i = 0; i < pending.length; i += PARALLEL) {
    const chunk = pending.slice(i, i + PARALLEL);
    const results = await Promise.allSettled(
      chunk.map(async (v) => {
        const t0 = Date.now();
        const resp = await getTikTokTranscript(v.url, "pt", false);
        const parsed = parseWebVTT(resp.data?.transcript ?? "");
        const duration = Date.now() - t0;

        if (!parsed.fullText) {
          throw new Error("transcript vazio (sem áudio ou não disponível)");
        }

        const { error: insertErr } = await admin.from("transcripts").upsert(
          {
            video_id: v.id,
            language: "pt",
            full_text: parsed.fullText,
            segments: parsed.segments,
            word_count: parsed.fullText.split(/\s+/).filter(Boolean).length,
            whisper_model: "sociavault-transcript",
            duration_ms: duration,
            cost_usd: (resp.credits_used ?? 1) * 0.002,
          },
          { onConflict: "video_id" }
        );

        if (insertErr) throw new Error(`DB insert: ${insertErr.message}`);
        return resp.credits_used ?? 1;
      })
    );

    for (let j = 0; j < results.length; j++) {
      const r = results[j];
      if (r.status === "fulfilled") {
        succeeded++;
        creditsUsed += r.value;
      } else {
        failed++;
        errors.push(
          `${chunk[j].tiktok_video_id}: ${String(r.reason).slice(0, 100)}`
        );
      }
    }
  }

  const totalDone = videos.length - (pending.length - succeeded);

  await admin
    .from("creators")
    .update({
      transcripts_status: failed === pending.length ? "failed" : "done",
      transcripts_done_count: totalDone,
      transcripts_error: errors.length ? errors.slice(0, 5).join(" | ") : null,
    })
    .eq("id", creator.id);

  return NextResponse.json({
    success: succeeded > 0,
    handle: creator.tiktok_handle,
    total_videos: videos.length,
    already_done: videos.length - pending.length,
    succeeded,
    failed,
    credits_used: creditsUsed,
    cost_usd: creditsUsed * 0.002,
    errors: errors.slice(0, 10),
  });
}
