import Link from "next/link";
import { notFound } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { SiteHeader } from "@/components/site-header";
import { ScoreBadge, HumanLabelBadge } from "@/components/score-badge";
import { CreatorAvatar } from "@/components/creator-avatar";
import { ContactActions } from "@/components/contact-actions";
import { DeleteCreatorButton } from "@/components/delete-creator-button";

const ADMIN_EMAILS = ["nelbotega@gmail.com"];

const CRITERIA_LABELS: Record<string, string> = {
  tom_de_voz: "Tone of voice",
  estetica_visual: "Visual aesthetics",
  vocabulario_de_beleza: "Beauty vocabulary",
  qualidade_de_producao: "Production quality",
  compatibilidade_de_portfolio: "Portfolio compatibility",
  consistencia_com_persona_marca: "Brand persona consistency",
};

const TIER_STYLES: Record<string, { bg: string; label: string }> = {
  luxo: { bg: "bg-gold/20 border-gold/40 text-gold", label: "Luxury" },
  concorrente_loreal: {
    bg: "bg-destructive/15 border-destructive/40 text-destructive",
    label: "Competitor",
  },
  premium: { bg: "bg-accent border-accent text-accent-foreground", label: "Premium" },
  massmarket: {
    bg: "bg-muted border-border text-muted-foreground",
    label: "Mass",
  },
};

function fmtNum(n: number | null): string {
  if (n === null || n === undefined) return "—";
  if (n >= 1_000_000) return `${(n / 1_000_000).toFixed(1)}M`;
  if (n >= 1_000) return `${(n / 1_000).toFixed(1)}k`;
  return n.toLocaleString("en-US");
}

export default async function CreatorDetailPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  const isAdmin = ADMIN_EMAILS.includes(user?.email ?? "");

  const { data: creator } = await supabase
    .from("creators")
    .select(
      "id, tiktok_handle, display_name, bio, follower_count, following_count, total_likes, verified, gmv_total_brl, orders_total, avg_ticket_brl, loreal_human_label, loreal_human_label_normalized, avatar_url, brands_sold, contact_phone, contact_email"
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
      "id, tiktok_video_id, url, caption, view_count, like_count, comment_count, share_count, duration_seconds, posted_at, thumbnail_url"
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
          .select("video_id, detected_elements")
          .in("video_id", videoIds)
      : Promise.resolve({
          data: [] as Array<{
            video_id: string;
            detected_elements: Record<string, unknown> | null;
          }>,
        }),
  ]);

  const transcriptMap = new Map(
    (transcripts ?? []).map((t) => [t.video_id, t.full_text])
  );
  const visualMap = new Map(
    (visualAnalyses ?? []).map((v) => [v.video_id, v])
  );

  const totalViews = (videos ?? []).reduce(
    (a, v) => a + (v.view_count ?? 0),
    0
  );
  const totalLikes = (videos ?? []).reduce(
    (a, v) => a + (v.like_count ?? 0),
    0
  );
  const engagementRate =
    totalViews > 0 ? ((totalLikes / totalViews) * 100).toFixed(1) : "—";

  const brandsSold = (creator.brands_sold as Array<{
    brand: string;
    tier: string;
    mentions: number;
  }>) ?? [];

  return (
    <>
      <SiteHeader active="afiliadas" />
      <div className="ambient-bg min-h-screen">
        <main className="max-w-6xl mx-auto px-6 py-12 space-y-12">
          {/* HERO */}
          <section className="card-glass p-10 flex flex-col md:flex-row items-start gap-8">
            <CreatorAvatar
              avatarUrl={creator.avatar_url}
              handle={creator.tiktok_handle}
              displayName={creator.display_name}
              size="xl"
            />
            <div className="flex-1 min-w-0 space-y-5">
              <div>
                <div className="flex items-center gap-3 mb-3">
                  <div className="text-[10px] uppercase tracking-[0.3em] text-gold/80">
                    Affiliate · TikTok Shop Brazil
                  </div>
                  <HumanLabelBadge
                    label={creator.loreal_human_label_normalized}
                  />
                  {creator.verified && (
                    <span className="text-[10px] uppercase tracking-wider text-gold">
                      ✓ Verified
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
                  <p className="text-sm mt-4 text-muted-foreground max-w-lg leading-relaxed italic">
                    &ldquo;{creator.bio}&rdquo;
                  </p>
                )}
              </div>

              <ContactActions
                handle={creator.tiktok_handle}
                displayName={creator.display_name}
                phone={creator.contact_phone}
                email={creator.contact_email}
              />
            </div>
          </section>

          {/* METRICS */}
          <section className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-6 gap-3">
            {[
              {
                label: "TikTok Sales",
                value: creator.gmv_total_brl
                  ? `R$ ${Number(creator.gmv_total_brl).toLocaleString("pt-BR")}`
                  : "—",
                hint: "Total GMV",
              },
              {
                label: "Orders",
                value: creator.orders_total?.toLocaleString("en-US") ?? "—",
                hint: "in the Shop",
              },
              {
                label: "Avg. ticket",
                value: creator.avg_ticket_brl
                  ? `R$ ${Number(creator.avg_ticket_brl).toFixed(0)}`
                  : "—",
                hint: "per order",
              },
              {
                label: "Followers",
                value: fmtNum(creator.follower_count),
                hint: "TikTok",
              },
              {
                label: "Likes",
                value: fmtNum(creator.total_likes),
                hint: "lifetime",
              },
              {
                label: "Engagement",
                value: `${engagementRate}%`,
                hint: "likes/views",
              },
            ].map((m) => (
              <div
                key={m.label}
                className="card-glass p-5 hover:border-gold/30 transition-colors"
              >
                <div className="text-[9px] uppercase tracking-[0.25em] text-muted-foreground">
                  {m.label}
                </div>
                <div className="font-display text-2xl tabular-nums mt-2">
                  {m.value}
                </div>
                <div className="text-[10px] text-muted-foreground mt-1">
                  {m.hint}
                </div>
              </div>
            ))}
          </section>

          {/* CURATION */}
          <section className="space-y-6">
            <div>
              <div className="text-[10px] uppercase tracking-[0.3em] text-muted-foreground mb-1">
                Editorial review
              </div>
              <h2 className="font-display text-3xl tracking-tight">Curation</h2>
            </div>
            {(scores ?? []).length === 0 ? (
              <p className="text-muted-foreground text-sm">
                Not yet reviewed.
              </p>
            ) : (
              <div className="grid md:grid-cols-2 gap-5">
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
                      className="card-glass p-7 space-y-5"
                    >
                      <div className="flex items-start justify-between gap-4">
                        <div>
                          <div className="text-[10px] uppercase tracking-[0.3em] text-gold/70 mb-1">
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

                      <p className="text-sm leading-relaxed text-foreground/90">
                        {s.justificativa_resumida}
                      </p>

                      <div className="space-y-2 pt-2 border-t border-border/40">
                        {Object.entries(criteria).map(([k, v]) => (
                          <div key={k} className="text-xs">
                            <div className="flex justify-between mb-1">
                              <span className="text-muted-foreground">
                                {CRITERIA_LABELS[k] ?? k}
                              </span>
                              <span className="tabular-nums">{v}</span>
                            </div>
                            <div className="h-px bg-border overflow-hidden">
                              <div
                                className="h-full bg-gold"
                                style={{ width: `${v}%`, height: "1.5px" }}
                              />
                            </div>
                          </div>
                        ))}
                      </div>

                      {redFlags.length > 0 && (
                        <div className="border-l-2 border-destructive/50 pl-3 py-1 space-y-1">
                          <div className="text-[10px] uppercase tracking-[0.25em] text-destructive font-medium">
                            Caution
                          </div>
                          <ul className="text-xs text-muted-foreground space-y-1">
                            {redFlags.map((f, idx) => (
                              <li key={idx}>{f}</li>
                            ))}
                          </ul>
                        </div>
                      )}

                      {s.sugestao_acao && (
                        <div className="border-t border-border/40 pt-4">
                          <div className="text-[10px] uppercase tracking-[0.3em] text-gold/70 mb-2">
                            Recommendation
                          </div>
                          <p className="text-sm italic text-foreground/90">
                            {s.sugestao_acao}
                          </p>
                        </div>
                      )}

                      {(s.evidencias as string[])?.length > 0 && (
                        <details className="text-xs">
                          <summary className="cursor-pointer text-muted-foreground hover:text-foreground uppercase tracking-wider">
                            Evidence
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

          {/* BRANDS SOLD */}
          {brandsSold.length > 0 && (
            <section className="space-y-6">
              <div>
                <div className="text-[10px] uppercase tracking-[0.3em] text-muted-foreground mb-1">
                  Detected portfolio
                </div>
                <h2 className="font-display text-3xl tracking-tight">
                  Brands she promotes
                </h2>
                <p className="text-sm text-muted-foreground mt-2 max-w-xl">
                  Detected in captions, hashtags and transcripts of recent
                  videos.
                </p>
              </div>
              <div className="flex flex-wrap gap-2">
                {brandsSold.map((b) => {
                  const tier = TIER_STYLES[b.tier] ?? TIER_STYLES.massmarket;
                  return (
                    <div
                      key={b.brand}
                      className={`group inline-flex items-center gap-2 border ${tier.bg} px-3 py-1.5 rounded-full text-sm`}
                    >
                      <span className="font-medium">{b.brand}</span>
                      <span className="text-[10px] opacity-60">
                        {b.mentions}×
                      </span>
                    </div>
                  );
                })}
              </div>
            </section>
          )}

          {/* CONTENT */}
          {(videos ?? []).length > 0 && (
            <section className="space-y-6">
              <div className="flex items-end justify-between">
                <div>
                  <div className="text-[10px] uppercase tracking-[0.3em] text-muted-foreground mb-1">
                    Performance
                  </div>
                  <h2 className="font-display text-3xl tracking-tight">
                    Featured content
                  </h2>
                </div>
                <div className="text-xs text-muted-foreground uppercase tracking-wider">
                  Top {videos?.length} by audience
                </div>
              </div>
              <div className="grid grid-cols-2 md:grid-cols-3 gap-5">
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
                      <div className="aspect-[9/14] bg-muted overflow-hidden border border-border/60 relative rounded-sm">
                        {v.thumbnail_url ? (
                          // eslint-disable-next-line @next/next/no-img-element
                          <img
                            src={v.thumbnail_url}
                            alt=""
                            className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-700"
                          />
                        ) : (
                          <div className="w-full h-full flex items-center justify-center text-muted-foreground text-xs">
                            no cover
                          </div>
                        )}
                        <div className="absolute inset-x-0 bottom-0 p-2.5 bg-gradient-to-t from-black via-black/60 to-transparent">
                          <div className="flex items-center justify-between text-[10px] text-white">
                            <span className="font-mono tabular-nums">
                              ▶ {fmtNum(v.view_count)}
                            </span>
                            <span className="font-mono tabular-nums">
                              ♥ {fmtNum(v.like_count)}
                            </span>
                          </div>
                        </div>
                      </div>
                      <div className="space-y-1">
                        {v.caption && (
                          <p className="text-xs line-clamp-2 leading-relaxed text-foreground/90">
                            {v.caption}
                          </p>
                        )}
                        {detected?.vibe && (
                          <p className="text-[10px] text-gold/70 uppercase tracking-wider italic">
                            {detected.vibe}
                          </p>
                        )}
                        {transcriptMap.get(v.id) && (
                          <details className="text-[10px] text-muted-foreground">
                            <summary className="cursor-pointer hover:text-foreground">
                              Transcript
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

          {/* Footer */}
          <div className="border-t border-border pt-8 flex items-center justify-between">
            <Link
              href="/dashboard/creators"
              className="text-xs text-muted-foreground hover:text-foreground transition-colors uppercase tracking-wider"
            >
              ← All affiliates
            </Link>
            {isAdmin && (
              <DeleteCreatorButton
                creatorId={creator.id}
                handle={creator.tiktok_handle}
                variant="text"
              />
            )}
          </div>
        </main>
      </div>
    </>
  );
}
