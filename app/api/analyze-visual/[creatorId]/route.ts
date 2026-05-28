import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { analyzeImagesAesthetics } from "@/lib/services/gemini";

export const runtime = "nodejs";
export const maxDuration = 60;

// Pega top 3 thumbnails. Mais leve que vídeo, cabe no timeout, e dá pra
// inferir padrão estético consistente entre vários frames.
const TOP_N_VIDEOS = 3;

async function downloadImageBytes(
  url: string
): Promise<{ bytes: Buffer; mimeType: string }> {
  const res = await fetch(url, {
    headers: {
      "User-Agent":
        "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36",
    },
  });
  if (!res.ok) {
    throw new Error(`Download cover HTTP ${res.status}`);
  }
  const buf = Buffer.from(await res.arrayBuffer());
  // Sniff content-type (TikTok CDN às vezes não manda)
  let mimeType = res.headers.get("content-type") ?? "image/jpeg";
  if (mimeType.includes("text") || mimeType.includes("html")) {
    mimeType = "image/jpeg"; // fallback
  }
  return { bytes: buf, mimeType };
}

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

  // Pega TOP N vídeos com thumbnail
  const { data: videos } = await admin
    .from("videos")
    .select("id, url, tiktok_video_id, view_count, thumbnail_url")
    .eq("creator_id", creator.id)
    .not("thumbnail_url", "is", null)
    .order("view_count", { ascending: false, nullsFirst: false })
    .limit(TOP_N_VIDEOS);

  if (!videos || videos.length === 0) {
    return NextResponse.json({
      success: false,
      handle: creator.tiktok_handle,
      errors: ["Sem vídeos com thumbnail pra analisar"],
    });
  }

  // Baixa todas as thumbnails em paralelo
  const downloads = await Promise.allSettled(
    videos.map((v) => downloadImageBytes(v.thumbnail_url as string))
  );

  const validMedia: Array<{ bytes: Buffer; mimeType: string; videoId: string }> = [];
  const downloadErrors: string[] = [];

  for (let i = 0; i < downloads.length; i++) {
    const d = downloads[i];
    if (d.status === "fulfilled") {
      validMedia.push({ ...d.value, videoId: videos[i].id });
    } else {
      downloadErrors.push(
        `${videos[i].tiktok_video_id}: ${String(d.reason).slice(0, 100)}`
      );
    }
  }

  if (validMedia.length === 0) {
    return NextResponse.json({
      success: false,
      handle: creator.tiktok_handle,
      errors: ["Nenhuma thumbnail baixou", ...downloadErrors],
    });
  }

  // UMA única chamada Gemini com TODAS as thumbnails — análise conjunta
  try {
    const result = await analyzeImagesAesthetics(
      validMedia.map((m) => ({ bytes: m.bytes, mimeType: m.mimeType }))
    );

    // Salva a mesma análise em todos os videos analisados juntos
    const rows = validMedia.map((m) => ({
      video_id: m.videoId,
      model: result.model,
      aesthetic_score: Math.max(
        result.analysis.brand_aesthetic_match.ysl_score,
        result.analysis.brand_aesthetic_match.lancome_score
      ),
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
      cost_usd: result.cost_usd / validMedia.length,
    }));

    const { error: saveErr } = await admin
      .from("visual_analyses")
      .upsert(rows, { onConflict: "video_id" });

    if (saveErr) {
      return NextResponse.json({
        success: false,
        handle: creator.tiktok_handle,
        errors: [`DB save: ${saveErr.message}`, ...downloadErrors],
      });
    }

    return NextResponse.json({
      success: true,
      handle: creator.tiktok_handle,
      analyzed: validMedia.length,
      cost_usd: result.cost_usd,
      model: result.model,
      preview: {
        paleta: result.analysis.paleta_dominante,
        iluminacao: result.analysis.iluminacao,
        vibe: result.analysis.vibe,
        ysl_score: result.analysis.brand_aesthetic_match.ysl_score,
        lancome_score: result.analysis.brand_aesthetic_match.lancome_score,
      },
      errors: downloadErrors,
    });
  } catch (err) {
    const msg = err instanceof Error ? err.message : String(err);
    console.error(`[analyze-visual] ${creator.tiktok_handle}:`, err);
    return NextResponse.json(
      {
        success: false,
        handle: creator.tiktok_handle,
        errors: [msg, ...downloadErrors],
      },
      { status: 500 }
    );
  }
}
