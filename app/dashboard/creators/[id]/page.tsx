import Link from "next/link";
import { notFound } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { Button } from "@/components/ui/button";
import { ScoreBadge, HumanLabelBadge } from "@/components/score-badge";

export default async function CreatorDetailPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  const supabase = await createClient();

  const { data: creator } = await supabase
    .from("creators")
    .select(
      "id, tiktok_handle, display_name, bio, follower_count, total_likes, verified, gmv_total_brl, orders_total, avg_ticket_brl, loreal_human_label, loreal_human_label_normalized, enrichment_status, transcripts_status, avatar_url"
    )
    .eq("id", id)
    .single();

  if (!creator) notFound();

  const { data: scores } = await supabase
    .from("scores")
    .select(
      "luxo_fit_score, recommendation, justificativa_resumida, scores_by_criteria, evidencias, red_flags, sugestao_acao, claude_model, cost_usd, brand:brands(name)"
    )
    .eq("creator_id", id)
    .eq("is_latest", true);

  const { data: videos } = await supabase
    .from("videos")
    .select(
      "id, tiktok_video_id, url, caption, view_count, like_count, duration_seconds, posted_at, thumbnail_url"
    )
    .eq("creator_id", id)
    .order("view_count", { ascending: false, nullsFirst: false })
    .limit(10);

  const videoIds = (videos ?? []).map((v) => v.id);
  const [{ data: transcripts }, { data: visualAnalyses }] = await Promise.all([
    videoIds.length > 0
      ? supabase
          .from("transcripts")
          .select("video_id, full_text")
          .in("video_id", videoIds)
      : Promise.resolve({ data: [] as { video_id: string; full_text: string }[] }),
    videoIds.length > 0
      ? supabase
          .from("visual_analyses")
          .select(
            "video_id, detected_elements, production_quality_score, visual_summary, brand_aesthetic_match"
          )
          .in("video_id", videoIds)
      : Promise.resolve({
          data: [] as Array<{
            video_id: string;
            detected_elements: Record<string, unknown> | null;
            production_quality_score: number | null;
            visual_summary: string | null;
            brand_aesthetic_match: Record<string, unknown> | null;
          }>,
        }),
  ]);

  const transcriptMap = new Map(
    (transcripts ?? []).map((t) => [t.video_id, t.full_text])
  );
  const visualMap = new Map(
    (visualAnalyses ?? []).map((v) => [v.video_id, v])
  );

  return (
    <div className="min-h-screen bg-background">
      <header className="border-b">
        <div className="max-w-5xl mx-auto px-6 py-4 flex items-center justify-between">
          <div className="flex items-center gap-3">
            <Link
              href="/dashboard/creators"
              className="text-xs text-muted-foreground hover:text-foreground"
            >
              ← Afiliadas
            </Link>
          </div>
          <Button variant="outline" size="sm" asChild>
            <a
              href={`https://www.tiktok.com/@${creator.tiktok_handle}`}
              target="_blank"
              rel="noreferrer"
            >
              Ver no TikTok ↗
            </a>
          </Button>
        </div>
      </header>

      <main className="max-w-5xl mx-auto px-6 py-8 space-y-10">
        {/* Hero */}
        <section className="flex items-start gap-6">
          {creator.avatar_url && (
            // eslint-disable-next-line @next/next/no-img-element
            <img
              src={creator.avatar_url}
              alt={creator.tiktok_handle}
              className="w-20 h-20 rounded-full border"
            />
          )}
          <div className="flex-1">
            <h1 className="text-3xl font-bold tracking-tight">
              {creator.display_name ?? creator.tiktok_handle}
            </h1>
            <p className="text-muted-foreground font-mono text-sm">
              @{creator.tiktok_handle}
              {creator.verified && " · verificada"}
            </p>
            {creator.bio && (
              <p className="text-sm mt-2 text-muted-foreground max-w-prose">
                {creator.bio}
              </p>
            )}
            <div className="flex flex-wrap gap-6 mt-4 text-sm">
              <div>
                <div className="text-xs text-muted-foreground">GMV total</div>
                <div className="font-semibold tabular-nums">
                  {creator.gmv_total_brl
                    ? `R$ ${Number(creator.gmv_total_brl).toLocaleString("pt-BR")}`
                    : "—"}
                </div>
              </div>
              <div>
                <div className="text-xs text-muted-foreground">Pedidos</div>
                <div className="font-semibold tabular-nums">
                  {creator.orders_total ?? "—"}
                </div>
              </div>
              <div>
                <div className="text-xs text-muted-foreground">Followers</div>
                <div className="font-semibold tabular-nums">
                  {creator.follower_count?.toLocaleString("pt-BR") ?? "—"}
                </div>
              </div>
              <div>
                <div className="text-xs text-muted-foreground">
                  Label humano L&apos;Oréal
                </div>
                <div className="mt-1 flex items-center gap-2">
                  <HumanLabelBadge
                    label={creator.loreal_human_label_normalized}
                  />
                  {creator.loreal_human_label && (
                    <span className="text-[10px] text-muted-foreground">
                      &quot;{creator.loreal_human_label}&quot;
                    </span>
                  )}
                </div>
              </div>
            </div>
          </div>
        </section>

        {/* Scores por brand */}
        <section className="space-y-3">
          <h2 className="text-xl font-bold tracking-tight">Avaliações IA</h2>
          {(scores ?? []).length === 0 ? (
            <p className="text-muted-foreground text-sm">
              Ainda não foi julgada por nenhuma marca.
            </p>
          ) : (
            <div className="grid md:grid-cols-2 gap-4">
              {(scores ?? []).map((s, i) => {
                const brandName = Array.isArray(s.brand)
                  ? s.brand[0]?.name
                  : (s.brand as { name?: string } | null)?.name ?? "—";
                const criteria = (s.scores_by_criteria ?? {}) as Record<string, number>;
                return (
                  <div key={i} className="border rounded-lg p-4 space-y-3">
                    <div className="flex items-start justify-between">
                      <h3 className="font-bold">{brandName}</h3>
                      <ScoreBadge
                        score={s.luxo_fit_score}
                        recommendation={s.recommendation}
                      />
                    </div>
                    <p className="text-sm text-muted-foreground">
                      {s.justificativa_resumida}
                    </p>
                    {/* Sub-scores */}
                    <div className="space-y-1.5 text-xs">
                      {Object.entries(criteria).map(([k, v]) => (
                        <div key={k} className="flex items-center gap-2">
                          <span className="w-44 text-muted-foreground">
                            {k.replace(/_/g, " ")}
                          </span>
                          <div className="flex-1 h-1.5 bg-muted rounded-full overflow-hidden">
                            <div
                              className="h-full bg-foreground"
                              style={{ width: `${v}%` }}
                            />
                          </div>
                          <span className="w-8 text-right tabular-nums">
                            {v}
                          </span>
                        </div>
                      ))}
                    </div>
                    {/* Red flags */}
                    {(s.red_flags as string[])?.length > 0 && (
                      <div className="text-xs bg-destructive/10 border border-destructive/30 rounded p-2 space-y-1">
                        <div className="font-semibold text-destructive">
                          Red flags
                        </div>
                        <ul className="list-disc list-inside text-destructive/90">
                          {(s.red_flags as string[]).map((f, idx) => (
                            <li key={idx}>{f}</li>
                          ))}
                        </ul>
                      </div>
                    )}
                    {/* Evidências */}
                    {(s.evidencias as string[])?.length > 0 && (
                      <details className="text-xs">
                        <summary className="cursor-pointer text-muted-foreground hover:text-foreground">
                          Ver {(s.evidencias as string[]).length} evidências
                        </summary>
                        <ul className="list-disc list-inside mt-2 space-y-1 text-muted-foreground">
                          {(s.evidencias as string[]).map((e, idx) => (
                            <li key={idx}>{e}</li>
                          ))}
                        </ul>
                      </details>
                    )}
                    {/* Sugestão */}
                    {s.sugestao_acao && (
                      <div className="text-xs border-t pt-2 text-muted-foreground italic">
                        💡 {s.sugestao_acao}
                      </div>
                    )}
                  </div>
                );
              })}
            </div>
          )}
        </section>

        {/* Vídeos com análise visual */}
        <section className="space-y-3">
          <h2 className="text-xl font-bold tracking-tight">
            Top vídeos analisados
          </h2>
          <div className="space-y-3">
            {(videos ?? []).map((v) => {
              const va = visualMap.get(v.id);
              const detected = (va?.detected_elements ?? null) as {
                paleta?: string[];
                iluminacao?: string;
                cenario?: string;
                vibe?: string;
                luxo?: string[];
                anti_luxo?: string[];
              } | null;
              const aesthetic = (va?.brand_aesthetic_match ?? null) as {
                ysl_score?: number;
                lancome_score?: number;
              } | null;
              return (
                <div
                  key={v.id}
                  className="border rounded-lg p-4 flex gap-4 items-start"
                >
                  {v.thumbnail_url && (
                    // eslint-disable-next-line @next/next/no-img-element
                    <img
                      src={v.thumbnail_url}
                      alt=""
                      className="w-20 h-28 object-cover rounded border"
                    />
                  )}
                  <div className="flex-1 space-y-2 min-w-0">
                    <div className="flex items-center gap-3 text-xs text-muted-foreground">
                      <a
                        href={v.url}
                        target="_blank"
                        rel="noreferrer"
                        className="hover:underline"
                      >
                        ↗ Abrir TikTok
                      </a>
                      <span>
                        {v.view_count?.toLocaleString("pt-BR") ?? "—"} views
                      </span>
                      <span>{v.duration_seconds ?? "?"}s</span>
                      <span>{v.posted_at?.slice(0, 10) ?? "—"}</span>
                    </div>
                    {v.caption && (
                      <p className="text-sm line-clamp-2">{v.caption}</p>
                    )}
                    {detected && (
                      <div className="text-xs space-y-1 bg-muted/30 rounded p-2">
                        {detected.paleta && (
                          <div>
                            <span className="text-muted-foreground">Paleta:</span>{" "}
                            {detected.paleta.join(", ")}
                          </div>
                        )}
                        {detected.iluminacao && (
                          <div>
                            <span className="text-muted-foreground">
                              Iluminação:
                            </span>{" "}
                            {detected.iluminacao} ·{" "}
                            <span className="text-muted-foreground">vibe:</span>{" "}
                            {detected.vibe}
                          </div>
                        )}
                        {va?.visual_summary && (
                          <div className="text-muted-foreground italic">
                            {va.visual_summary}
                          </div>
                        )}
                        {aesthetic && (
                          <div className="flex gap-3 pt-1">
                            <span>
                              YSL{" "}
                              <span className="font-semibold">
                                {aesthetic.ysl_score ?? "—"}
                              </span>
                            </span>
                            <span>
                              Lancôme{" "}
                              <span className="font-semibold">
                                {aesthetic.lancome_score ?? "—"}
                              </span>
                            </span>
                          </div>
                        )}
                      </div>
                    )}
                    {transcriptMap.get(v.id) && (
                      <details className="text-xs">
                        <summary className="cursor-pointer text-muted-foreground hover:text-foreground">
                          Ver transcrição
                        </summary>
                        <p className="mt-1 text-muted-foreground whitespace-pre-wrap">
                          {transcriptMap.get(v.id)}
                        </p>
                      </details>
                    )}
                  </div>
                </div>
              );
            })}
            {(videos ?? []).length === 0 && (
              <p className="text-muted-foreground text-sm">
                Sem vídeos ainda. Rode o enriquecimento Apify.
              </p>
            )}
          </div>
        </section>
      </main>
    </div>
  );
}
