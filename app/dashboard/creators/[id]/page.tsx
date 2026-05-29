import Link from "next/link";
import { notFound } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { SiteHeader } from "@/components/site-header";
import { ScoreBadge, HumanLabelBadge } from "@/components/score-badge";
import { CreatorAvatar } from "@/components/creator-avatar";

const CRITERIA_LABELS: Record<string, string> = {
  tom_de_voz: "Tom de voz",
  estetica_visual: "Estética visual",
  vocabulario_de_beleza: "Vocabulário de beleza",
  qualidade_de_producao: "Qualidade de produção",
  compatibilidade_de_portfolio: "Compatibilidade de portfólio",
  consistencia_com_persona_marca: "Consistência com persona",
};

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
      "id, tiktok_handle, display_name, bio, follower_count, total_likes, verified, gmv_total_brl, orders_total, avg_ticket_brl, loreal_human_label, loreal_human_label_normalized, avatar_url"
    )
    .eq("id", id)
    .single();

  if (!creator) notFound();

  const { data: scores } = await supabase
    .from("scores")
    .select(
      "luxo_fit_score, recommendation, justificativa_resumida, scores_by_criteria, evidencias, red_flags, sugestao_acao, brand:brands(name, slug)"
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
    .limit(6);

  const videoIds = (videos ?? []).map((v) => v.id);
  const [{ data: transcripts }, { data: visualAnalyses }] = await Promise.all([
    videoIds.length > 0
      ? supabase
          .from("transcripts")
          .select("video_id, full_text")
          .in("video_id", videoIds)
      : Promise.resolve({
          data: [] as { video_id: string; full_text: string }[],
        }),
    videoIds.length > 0
      ? supabase
          .from("visual_analyses")
          .select(
            "video_id, detected_elements, production_quality_score, visual_summary"
          )
          .in("video_id", videoIds)
      : Promise.resolve({
          data: [] as Array<{
            video_id: string;
            detected_elements: Record<string, unknown> | null;
            production_quality_score: number | null;
            visual_summary: string | null;
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
    <>
      <SiteHeader active="afiliadas" />
      <main className="max-w-5xl mx-auto px-6 py-12 space-y-16">
        {/* Hero */}
        <section className="flex flex-col md:flex-row items-start gap-8">
          <CreatorAvatar
            avatarUrl={creator.avatar_url}
            handle={creator.tiktok_handle}
            displayName={creator.display_name}
            size="xl"
          />
          <div className="flex-1 min-w-0">
            <div className="flex items-center gap-3 mb-2">
              <div className="text-[10px] uppercase tracking-[0.3em] text-muted-foreground">
                Afiliada
              </div>
              <HumanLabelBadge
                label={creator.loreal_human_label_normalized}
              />
              {creator.verified && (
                <span className="text-[10px] uppercase tracking-wider text-gold">
                  ✓ Verificada
                </span>
              )}
            </div>
            <h1 className="font-display text-5xl tracking-tighter leading-none">
              {creator.display_name ?? creator.tiktok_handle}
            </h1>
            <div className="text-sm text-muted-foreground font-mono mt-2">
              <a
                href={`https://www.tiktok.com/@${creator.tiktok_handle}`}
                target="_blank"
                rel="noreferrer"
                className="hover:text-foreground transition-colors"
              >
                @{creator.tiktok_handle} ↗
              </a>
            </div>
            {creator.bio && (
              <p className="text-sm mt-5 text-muted-foreground max-w-lg leading-relaxed italic">
                &ldquo;{creator.bio}&rdquo;
              </p>
            )}
          </div>
        </section>

        {/* Métricas comerciais */}
        <section className="grid grid-cols-2 md:grid-cols-4 gap-10 py-8 border-y border-border">
          {[
            {
              label: "Vendas",
              value: creator.gmv_total_brl
                ? `R$ ${Number(creator.gmv_total_brl).toLocaleString("pt-BR")}`
                : "—",
            },
            {
              label: "Pedidos",
              value: creator.orders_total?.toLocaleString("pt-BR") ?? "—",
            },
            {
              label: "Ticket médio",
              value: creator.avg_ticket_brl
                ? `R$ ${Number(creator.avg_ticket_brl).toLocaleString("pt-BR")}`
                : "—",
            },
            {
              label: "Seguidores",
              value: creator.follower_count?.toLocaleString("pt-BR") ?? "—",
            },
          ].map((m) => (
            <div key={m.label}>
              <div className="text-[10px] uppercase tracking-[0.25em] text-muted-foreground mb-2">
                {m.label}
              </div>
              <div className="font-display text-2xl tabular-nums">
                {m.value}
              </div>
            </div>
          ))}
        </section>

        {/* Avaliações por marca */}
        <section className="space-y-6">
          <h2 className="font-display text-3xl tracking-tight">Curadoria</h2>
          {(scores ?? []).length === 0 ? (
            <p className="text-muted-foreground text-sm">
              Ainda não avaliada.
            </p>
          ) : (
            <div className="grid md:grid-cols-2 gap-6">
              {(scores ?? []).map((s, i) => {
                const brandName = Array.isArray(s.brand)
                  ? s.brand[0]?.name
                  : (s.brand as { name?: string } | null)?.name ?? "—";
                const criteria = (s.scores_by_criteria ?? {}) as Record<
                  string,
                  number
                >;
                const redFlags = (s.red_flags as string[]) ?? [];
                return (
                  <article
                    key={i}
                    className="border border-border bg-card p-8 space-y-6"
                  >
                    <div className="flex items-start justify-between gap-4">
                      <div>
                        <div className="text-[10px] uppercase tracking-[0.25em] text-muted-foreground mb-1">
                          L&apos;Oréal Luxe
                        </div>
                        <h3 className="font-display text-3xl tracking-tight">
                          {brandName}
                        </h3>
                      </div>
                      <ScoreBadge
                        score={s.luxo_fit_score}
                        recommendation={s.recommendation}
                        size="lg"
                      />
                    </div>

                    <p className="text-sm leading-relaxed">
                      {s.justificativa_resumida}
                    </p>

                    {/* Sub-scores */}
                    <div className="space-y-2 pt-2">
                      {Object.entries(criteria).map(([k, v]) => (
                        <div
                          key={k}
                          className="grid grid-cols-[1fr_auto] gap-3 items-center text-xs"
                        >
                          <div className="space-y-1">
                            <div className="flex justify-between">
                              <span className="text-muted-foreground">
                                {CRITERIA_LABELS[k] ?? k}
                              </span>
                              <span className="tabular-nums">{v}</span>
                            </div>
                            <div className="h-px bg-muted overflow-hidden">
                              <div
                                className="h-full bg-foreground"
                                style={{ width: `${v}%`, height: "2px" }}
                              />
                            </div>
                          </div>
                        </div>
                      ))}
                    </div>

                    {redFlags.length > 0 && (
                      <div className="border-l-2 border-destructive/50 pl-3 py-1 space-y-1">
                        <div className="text-[10px] uppercase tracking-[0.25em] text-destructive font-medium">
                          Atenção
                        </div>
                        <ul className="text-xs text-muted-foreground space-y-1">
                          {redFlags.map((f, idx) => (
                            <li key={idx}>{f}</li>
                          ))}
                        </ul>
                      </div>
                    )}

                    {s.sugestao_acao && (
                      <div className="border-t border-border pt-4">
                        <div className="text-[10px] uppercase tracking-[0.25em] text-muted-foreground mb-2">
                          Recomendação
                        </div>
                        <p className="text-sm italic">{s.sugestao_acao}</p>
                      </div>
                    )}

                    {(s.evidencias as string[])?.length > 0 && (
                      <details className="text-xs">
                        <summary className="cursor-pointer text-muted-foreground hover:text-foreground uppercase tracking-wider">
                          Evidências
                        </summary>
                        <ul className="list-disc list-inside mt-3 space-y-2 text-muted-foreground">
                          {(s.evidencias as string[]).map((e, idx) => (
                            <li key={idx}>{e}</li>
                          ))}
                        </ul>
                      </details>
                    )}
                  </article>
                );
              })}
            </div>
          )}
        </section>

        {/* Vídeos */}
        {(videos ?? []).length > 0 && (
          <section className="space-y-6">
            <div className="flex items-end justify-between">
              <h2 className="font-display text-3xl tracking-tight">
                Conteúdo recente
              </h2>
              <div className="text-xs text-muted-foreground uppercase tracking-wider">
                Top {videos?.length} por audiência
              </div>
            </div>
            <div className="grid grid-cols-2 md:grid-cols-3 gap-6">
              {(videos ?? []).map((v) => {
                const va = visualMap.get(v.id);
                const detected = (va?.detected_elements ?? null) as {
                  paleta?: string[];
                  iluminacao?: string;
                  vibe?: string;
                } | null;
                return (
                  <a
                    key={v.id}
                    href={v.url}
                    target="_blank"
                    rel="noreferrer"
                    className="group block space-y-3"
                  >
                    <div className="aspect-[9/14] bg-muted overflow-hidden border border-border relative">
                      {v.thumbnail_url ? (
                        // eslint-disable-next-line @next/next/no-img-element
                        <img
                          src={v.thumbnail_url}
                          alt=""
                          className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-500"
                        />
                      ) : (
                        <div className="w-full h-full flex items-center justify-center text-muted-foreground text-xs">
                          sem capa
                        </div>
                      )}
                      <div className="absolute bottom-2 right-2 text-[10px] font-mono text-white bg-black/60 px-1.5 py-0.5">
                        {v.view_count
                          ? `${(v.view_count / 1000).toFixed(0)}k`
                          : "—"}
                      </div>
                    </div>
                    <div className="space-y-1">
                      {v.caption && (
                        <p className="text-xs line-clamp-2 leading-relaxed">
                          {v.caption}
                        </p>
                      )}
                      {detected?.vibe && (
                        <p className="text-[10px] text-muted-foreground uppercase tracking-wider italic">
                          {detected.vibe}
                        </p>
                      )}
                      {transcriptMap.get(v.id) && (
                        <details className="text-[10px] text-muted-foreground">
                          <summary className="cursor-pointer hover:text-foreground">
                            Transcrição
                          </summary>
                          <p className="mt-2 leading-relaxed whitespace-pre-wrap">
                            {transcriptMap.get(v.id)?.slice(0, 800)}
                          </p>
                        </details>
                      )}
                    </div>
                  </a>
                );
              })}
            </div>
          </section>
        )}
      </main>
    </>
  );
}
