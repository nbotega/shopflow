import Link from "next/link";
import { createClient } from "@/lib/supabase/server";
import { SiteHeader } from "@/components/site-header";
import { ScoreBadge, HumanLabelBadge } from "@/components/score-badge";
import { CreatorAvatar } from "@/components/creator-avatar";

type ScoreRow = {
  id: string;
  luxo_fit_score: number;
  recommendation: string;
  justificativa_resumida: string;
  brand:
    | { name: string; slug: string }
    | { name: string; slug: string }[]
    | null;
  creator:
    | {
        id: string;
        tiktok_handle: string;
        display_name: string | null;
        gmv_total_brl: number | null;
        loreal_human_label_normalized: string | null;
        avatar_url: string | null;
      }
    | {
        id: string;
        tiktok_handle: string;
        display_name: string | null;
        gmv_total_brl: number | null;
        loreal_human_label_normalized: string | null;
        avatar_url: string | null;
      }[]
    | null;
};

function flatten<T>(v: T | T[] | null): T | null {
  if (!v) return null;
  return Array.isArray(v) ? v[0] ?? null : v;
}

const REC_LABELS: Record<string, string> = {
  approve: "On brand",
  monitor: "Watch",
  borderline: "Review",
  reject: "Off brand",
};

export default async function ScoresPage({
  searchParams,
}: {
  searchParams: Promise<{ brand?: string; rec?: string }>;
}) {
  const params = await searchParams;
  const supabase = await createClient();

  const { data: brands } = await supabase
    .from("brands")
    .select("id, name, slug")
    .eq("active", true)
    .order("name");

  const selectedBrandSlug = params.brand ?? brands?.[0]?.slug;
  const selectedRec = params.rec ?? null;
  const selectedBrand = (brands ?? []).find((b) => b.slug === selectedBrandSlug);

  let query = supabase
    .from("scores")
    .select(
      `id, luxo_fit_score, recommendation, justificativa_resumida,
       brand:brands!inner(name, slug),
       creator:creators!inner(id, tiktok_handle, display_name, gmv_total_brl, loreal_human_label_normalized, avatar_url, is_visible)`
    )
    .eq("is_latest", true)
    .eq("creator.is_visible", true)
    .order("luxo_fit_score", { ascending: false });

  if (selectedBrandSlug) {
    query = query.eq("brand.slug", selectedBrandSlug);
  }
  if (selectedRec) {
    query = query.eq("recommendation", selectedRec);
  }

  const { data: scores } = await query;
  const rows = (scores ?? []) as ScoreRow[];

  const counts = { approve: 0, monitor: 0, borderline: 0, reject: 0 };
  const { data: allScores } = await supabase
    .from("scores")
    .select("recommendation, brand:brands!inner(slug), creator:creators!inner(is_visible)")
    .eq("is_latest", true)
    .eq("creator.is_visible", true)
    .eq("brand.slug", selectedBrandSlug ?? "");
  for (const r of allScores ?? []) {
    if (r.recommendation in counts) {
      counts[r.recommendation as keyof typeof counts]++;
    }
  }

  return (
    <>
      <SiteHeader active="ranking" />
      <main className="max-w-6xl mx-auto px-6 py-12 space-y-10">
        {/* Hero */}
        <section className="space-y-5">
          <div className="text-[10px] uppercase tracking-[0.3em] text-muted-foreground">
            Editorial curation
          </div>
          <h1 className="font-display text-5xl tracking-tighter">
            {selectedBrand?.name ?? "Ranking"}
          </h1>
          <p className="text-sm text-muted-foreground max-w-xl">
            Affiliates evaluated against the editorial standards of{" "}
            {selectedBrand?.name}, ranked by brand compatibility.
          </p>
        </section>

        <div className="editorial-rule" />

        {/* Brand tabs */}
        <nav className="flex gap-8 border-b border-border">
          {(brands ?? []).map((b) => {
            const active = b.slug === selectedBrandSlug;
            return (
              <Link
                key={b.id}
                href={`/dashboard/scores?brand=${b.slug}`}
                className={`pb-3 -mb-px text-sm border-b-2 transition-colors ${
                  active
                    ? "border-foreground text-foreground font-medium"
                    : "border-transparent text-muted-foreground hover:text-foreground"
                }`}
              >
                {b.name}
              </Link>
            );
          })}
        </nav>

        {/* Filters */}
        <div className="flex flex-wrap gap-2 text-xs">
          {[
            { key: null, label: `All · ${allScores?.length ?? 0}` },
            { key: "approve", label: `${REC_LABELS.approve} · ${counts.approve}` },
            { key: "monitor", label: `${REC_LABELS.monitor} · ${counts.monitor}` },
            {
              key: "borderline",
              label: `${REC_LABELS.borderline} · ${counts.borderline}`,
            },
            { key: "reject", label: `${REC_LABELS.reject} · ${counts.reject}` },
          ].map((f) => {
            const active = (selectedRec ?? null) === f.key;
            const href = `/dashboard/scores?brand=${selectedBrandSlug}${f.key ? `&rec=${f.key}` : ""}`;
            return (
              <Link
                key={f.key ?? "all"}
                href={href}
                className={`px-3 py-1.5 border uppercase tracking-wider transition-colors ${
                  active
                    ? "border-foreground bg-foreground text-background"
                    : "border-border text-muted-foreground hover:border-foreground hover:text-foreground"
                }`}
              >
                {f.label}
              </Link>
            );
          })}
        </div>

        {/* Editorial list */}
        <div className="space-y-1">
          {rows.map((r, i) => {
            const c = flatten(r.creator);
            if (!c) return null;
            return (
              <Link
                key={r.id}
                href={`/dashboard/creators/${c.id}`}
                className="group grid grid-cols-[40px_60px_1fr_auto] md:grid-cols-[40px_60px_1fr_180px_auto] gap-6 items-center px-3 py-4 hover:bg-accent/40 transition-colors border-b border-border/40"
              >
                <span className="font-display text-xl text-muted-foreground tabular-nums">
                  {String(i + 1).padStart(2, "0")}
                </span>
                <CreatorAvatar
                  avatarUrl={c.avatar_url}
                  handle={c.tiktok_handle}
                  displayName={c.display_name}
                  size="md"
                />
                <div className="min-w-0">
                  <div className="flex items-center gap-2">
                    <span className="font-display text-xl tracking-tight truncate group-hover:underline underline-offset-4">
                      {c.display_name ?? c.tiktok_handle}
                    </span>
                    <HumanLabelBadge
                      label={c.loreal_human_label_normalized}
                    />
                  </div>
                  <div className="text-xs text-muted-foreground font-mono mt-0.5">
                    @{c.tiktok_handle}
                    {c.gmv_total_brl
                      ? ` · R$ ${Number(c.gmv_total_brl).toLocaleString("pt-BR")} in sales`
                      : ""}
                  </div>
                  <p className="text-xs text-muted-foreground mt-2 line-clamp-2 max-w-2xl hidden md:block">
                    {r.justificativa_resumida}
                  </p>
                </div>
                <div className="hidden md:flex justify-end">
                  <ScoreBadge
                    score={r.luxo_fit_score}
                    recommendation={r.recommendation}
                  />
                </div>
                <div className="md:hidden">
                  <ScoreBadge
                    score={r.luxo_fit_score}
                    recommendation={r.recommendation}
                    size="sm"
                  />
                </div>
              </Link>
            );
          })}
          {rows.length === 0 && (
            <div className="py-20 text-center text-muted-foreground text-sm">
              No affiliates in this category yet.
            </div>
          )}
        </div>
      </main>
    </>
  );
}
