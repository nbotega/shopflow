import Link from "next/link";
import { createClient } from "@/lib/supabase/server";
import { SiteHeader } from "@/components/site-header";
import { CreatorAvatar } from "@/components/creator-avatar";
import { ScoreBadge } from "@/components/score-badge";

type CreatorMini = {
  id: string;
  tiktok_handle: string;
  display_name: string | null;
  avatar_url: string | null;
  gmv_total_brl: number | null;
};

type ScoreRow = {
  brand_id: string;
  recommendation: string;
  luxo_fit_score: number;
  creator: CreatorMini | CreatorMini[] | null;
};

function flat(v: CreatorMini | CreatorMini[] | null): CreatorMini | null {
  if (!v) return null;
  return Array.isArray(v) ? v[0] ?? null : v;
}

export default async function DashboardPage() {
  const supabase = await createClient();

  const { data: brands } = await supabase
    .from("brands")
    .select("id, name, slug")
    .eq("active", true)
    .order("name");

  const { data: scoresRaw } = await supabase
    .from("scores")
    .select(
      `brand_id, recommendation, luxo_fit_score,
       creator:creators!inner(id, tiktok_handle, display_name, avatar_url, gmv_total_brl)`
    )
    .eq("is_latest", true)
    .order("luxo_fit_score", { ascending: false });

  const scores = (scoresRaw ?? []) as ScoreRow[];

  // Totais e KPIs
  const { count: poolCount } = await supabase
    .from("creators")
    .select("id", { count: "exact", head: true });

  const { data: poolGMV } = await supabase
    .from("creators")
    .select("gmv_total_brl");

  const totalGMV =
    (poolGMV ?? []).reduce(
      (acc, r) => acc + Number(r.gmv_total_brl ?? 0),
      0
    );

  // Distribuição global
  const distribution = { approve: 0, monitor: 0, borderline: 0, reject: 0 };
  for (const s of scores) {
    if (s.recommendation in distribution) {
      distribution[s.recommendation as keyof typeof distribution]++;
    }
  }
  const totalEvals = scores.length || 1;

  // Top picks por marca
  const topByBrand = new Map<
    string,
    Array<{ score: number; creator: CreatorMini | null }>
  >();
  for (const s of scores) {
    if (s.recommendation === "reject") continue;
    if (!topByBrand.has(s.brand_id)) topByBrand.set(s.brand_id, []);
    const arr = topByBrand.get(s.brand_id)!;
    if (arr.length < 4) {
      arr.push({ score: s.luxo_fit_score, creator: flat(s.creator) });
    }
  }

  // Por marca: stats
  type BrandStat = {
    id: string;
    name: string;
    slug: string;
    approve: number;
    monitor: number;
    total: number;
    avg_score: number;
  };
  const brandStats: BrandStat[] = (brands ?? []).map((b) => {
    const brandScores = scores.filter((s) => s.brand_id === b.id);
    const total = brandScores.length;
    const approve = brandScores.filter((s) => s.recommendation === "approve").length;
    const monitor = brandScores.filter((s) => s.recommendation === "monitor").length;
    const avg = total
      ? Math.round(
          brandScores.reduce((a, s) => a + s.luxo_fit_score, 0) / total
        )
      : 0;
    return {
      id: b.id,
      name: b.name,
      slug: b.slug,
      approve,
      monitor,
      total,
      avg_score: avg,
    };
  });

  return (
    <>
      <SiteHeader active="overview" />
      <div className="ambient-bg min-h-screen">
        <main className="max-w-7xl mx-auto px-6 py-12 space-y-12">
          {/* Hero */}
          <section className="space-y-4 pt-4">
            <div className="text-[10px] uppercase tracking-[0.4em] text-gold/80">
              · Visão geral · {new Date().toLocaleDateString("pt-BR", { day: "2-digit", month: "long", year: "numeric" })}
            </div>
            <h1 className="font-display text-6xl md:text-7xl leading-[0.95] tracking-tighter">
              Curadoria de afiliadas
              <span className="block gold-text-gradient italic font-normal">
                para marcas premium.
              </span>
            </h1>
          </section>

          {/* KPIs */}
          <section className="grid grid-cols-2 lg:grid-cols-4 gap-4">
            {[
              {
                label: "Pool ativo",
                value: poolCount?.toLocaleString("pt-BR") ?? "0",
                suffix: "afiliadas",
              },
              {
                label: "Marcas curadas",
                value: brands?.length?.toString() ?? "0",
                suffix: "L'Oréal Luxe",
              },
              {
                label: "Avaliações",
                value: scores.length.toLocaleString("pt-BR"),
                suffix: "publicadas",
              },
              {
                label: "Volume mapeado",
                value: `R$ ${(totalGMV / 1000).toFixed(0)}k`,
                suffix: "em GMV TikTok",
              },
            ].map((kpi) => (
              <div
                key={kpi.label}
                className="card-glass p-6 group hover:border-gold/30 transition-colors"
              >
                <div className="text-[10px] uppercase tracking-[0.25em] text-muted-foreground mb-3">
                  {kpi.label}
                </div>
                <div className="font-display text-5xl tracking-tighter text-foreground">
                  {kpi.value}
                </div>
                <div className="text-[10px] uppercase tracking-wider text-muted-foreground mt-2">
                  {kpi.suffix}
                </div>
              </div>
            ))}
          </section>

          {/* Distribuição editorial */}
          <section className="card-glass p-8 space-y-6">
            <div className="flex items-end justify-between">
              <div>
                <div className="text-[10px] uppercase tracking-[0.25em] text-muted-foreground mb-1">
                  Distribuição
                </div>
                <h2 className="font-display text-2xl">Decisão editorial</h2>
              </div>
              <Link
                href="/dashboard/scores"
                className="text-xs uppercase tracking-[0.2em] text-muted-foreground hover:text-gold transition-colors"
              >
                Ver curadoria →
              </Link>
            </div>
            {/* Stacked bar */}
            <div className="h-3 flex overflow-hidden rounded-full bg-muted/50">
              {(
                [
                  { key: "approve", label: "Encaixam", color: "bg-gold" },
                  { key: "monitor", label: "Observar", color: "bg-gold/40" },
                  { key: "borderline", label: "Revisar", color: "bg-muted-foreground/40" },
                  { key: "reject", label: "Fora", color: "bg-muted-foreground/15" },
                ] as const
              ).map((seg) => {
                const v = distribution[seg.key];
                const pct = (v / totalEvals) * 100;
                if (pct === 0) return null;
                return (
                  <div
                    key={seg.key}
                    className={seg.color}
                    style={{ width: `${pct}%` }}
                    title={`${seg.label}: ${v}`}
                  />
                );
              })}
            </div>
            <div className="grid grid-cols-2 md:grid-cols-4 gap-6">
              {(
                [
                  { key: "approve", label: "Encaixam" },
                  { key: "monitor", label: "Observar" },
                  { key: "borderline", label: "Revisar" },
                  { key: "reject", label: "Fora" },
                ] as const
              ).map((seg) => (
                <div key={seg.key}>
                  <div className="text-[10px] uppercase tracking-[0.25em] text-muted-foreground mb-1">
                    {seg.label}
                  </div>
                  <div className="flex items-baseline gap-2">
                    <span className="font-display text-3xl">
                      {distribution[seg.key]}
                    </span>
                    <span className="text-xs text-muted-foreground tabular-nums">
                      {((distribution[seg.key] / totalEvals) * 100).toFixed(0)}%
                    </span>
                  </div>
                </div>
              ))}
            </div>
          </section>

          {/* Marcas curadas */}
          <section className="space-y-6">
            <div className="flex items-end justify-between">
              <div>
                <div className="text-[10px] uppercase tracking-[0.25em] text-muted-foreground mb-1">
                  Por marca
                </div>
                <h2 className="font-display text-3xl">Marcas curadas</h2>
              </div>
            </div>
            <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
              {brandStats.map((b) => {
                const tops = topByBrand.get(b.id) ?? [];
                return (
                  <Link
                    key={b.id}
                    href={`/dashboard/scores?brand=${b.slug}`}
                    className="card-glass p-8 group hover:border-gold/40 transition-all space-y-6"
                  >
                    <div className="flex items-start justify-between">
                      <div>
                        <div className="text-[10px] uppercase tracking-[0.3em] text-gold/70 mb-2">
                          L&apos;Oréal Luxe
                        </div>
                        <h3 className="font-display text-4xl tracking-tighter">
                          {b.name}
                        </h3>
                      </div>
                      <div className="text-right">
                        <div className="text-[10px] uppercase tracking-wider text-muted-foreground mb-1">
                          Match médio
                        </div>
                        <div className="font-display text-3xl gold-text-gradient">
                          {b.avg_score}
                        </div>
                      </div>
                    </div>

                    <div className="grid grid-cols-3 gap-4 py-3 border-y border-border/60">
                      <div>
                        <div className="font-display text-2xl">{b.approve}</div>
                        <div className="text-[10px] uppercase tracking-wider text-muted-foreground">
                          Encaixam
                        </div>
                      </div>
                      <div>
                        <div className="font-display text-2xl">{b.monitor}</div>
                        <div className="text-[10px] uppercase tracking-wider text-muted-foreground">
                          Observar
                        </div>
                      </div>
                      <div>
                        <div className="font-display text-2xl text-muted-foreground">
                          {b.total}
                        </div>
                        <div className="text-[10px] uppercase tracking-wider text-muted-foreground">
                          Avaliadas
                        </div>
                      </div>
                    </div>

                    {tops.length > 0 && (
                      <div>
                        <div className="text-[10px] uppercase tracking-wider text-muted-foreground mb-3">
                          Top picks
                        </div>
                        <div className="flex -space-x-3">
                          {tops.map((t, i) =>
                            t.creator ? (
                              <div
                                key={i}
                                className="relative"
                                title={`@${t.creator.tiktok_handle} · ${t.score}`}
                              >
                                <CreatorAvatar
                                  avatarUrl={t.creator.avatar_url}
                                  handle={t.creator.tiktok_handle}
                                  displayName={t.creator.display_name}
                                  size="md"
                                />
                              </div>
                            ) : null
                          )}
                        </div>
                      </div>
                    )}

                    <div className="flex items-center justify-end text-xs uppercase tracking-[0.2em] text-muted-foreground group-hover:text-gold transition-colors">
                      Ver ranking →
                    </div>
                  </Link>
                );
              })}
            </div>
          </section>

          {/* Top picks globais — Spotlight */}
          {scores.length > 0 && (
            <section className="space-y-6">
              <div className="flex items-end justify-between">
                <div>
                  <div className="text-[10px] uppercase tracking-[0.25em] text-muted-foreground mb-1">
                    Spotlight
                  </div>
                  <h2 className="font-display text-3xl">Em alta</h2>
                </div>
                <Link
                  href="/dashboard/creators"
                  className="text-xs uppercase tracking-[0.2em] text-muted-foreground hover:text-gold transition-colors"
                >
                  Todas afiliadas →
                </Link>
              </div>
              <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-6 gap-4">
                {scores
                  .filter((s) => s.recommendation === "approve" || s.recommendation === "monitor")
                  .slice(0, 6)
                  .map((s, i) => {
                    const c = flat(s.creator);
                    if (!c) return null;
                    return (
                      <Link
                        key={`${c.id}-${i}`}
                        href={`/dashboard/creators/${c.id}`}
                        className="group block space-y-3 text-center"
                      >
                        <div className="relative inline-block">
                          <CreatorAvatar
                            avatarUrl={c.avatar_url}
                            handle={c.tiktok_handle}
                            displayName={c.display_name}
                            size="xl"
                          />
                          <div className="absolute -bottom-1 -right-1">
                            <ScoreBadge
                              score={s.luxo_fit_score}
                              recommendation={s.recommendation}
                              size="sm"
                            />
                          </div>
                        </div>
                        <div className="font-display text-sm leading-tight">
                          {c.display_name ?? c.tiktok_handle}
                        </div>
                        <div className="text-[10px] font-mono text-muted-foreground">
                          @{c.tiktok_handle}
                        </div>
                      </Link>
                    );
                  })}
              </div>
            </section>
          )}
        </main>
      </div>
    </>
  );
}
