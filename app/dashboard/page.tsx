import Link from "next/link";
import { createClient } from "@/lib/supabase/server";
import { SiteHeader } from "@/components/site-header";

type BrandSummary = {
  id: string;
  name: string;
  slug: string;
  approve: number;
  monitor: number;
  total_curated: number;
};

export default async function DashboardPage() {
  const supabase = await createClient();

  const { data: brands } = await supabase
    .from("brands")
    .select("id, name, slug")
    .eq("active", true)
    .order("name");

  const { data: scores } = await supabase
    .from("scores")
    .select("brand_id, recommendation")
    .eq("is_latest", true);

  const summaryByBrand = new Map<string, BrandSummary>();
  for (const b of brands ?? []) {
    summaryByBrand.set(b.id, {
      id: b.id,
      name: b.name,
      slug: b.slug,
      approve: 0,
      monitor: 0,
      total_curated: 0,
    });
  }
  for (const s of scores ?? []) {
    const sum = summaryByBrand.get(s.brand_id);
    if (!sum) continue;
    sum.total_curated += 1;
    if (s.recommendation === "approve") sum.approve += 1;
    else if (s.recommendation === "monitor") sum.monitor += 1;
  }

  const { count: poolCount } = await supabase
    .from("creators")
    .select("id", { count: "exact", head: true });

  return (
    <>
      <SiteHeader active="overview" />
      <main className="max-w-6xl mx-auto px-6 py-16 space-y-20">
        {/* Hero */}
        <section className="space-y-6">
          <div className="text-[10px] uppercase tracking-[0.3em] text-muted-foreground">
            Visão geral
          </div>
          <h1 className="font-display text-5xl md:text-6xl leading-[1] tracking-tighter max-w-3xl">
            Curadoria de afiliadas para marcas premium.
          </h1>
          <p className="text-base text-muted-foreground max-w-2xl leading-relaxed">
            Cada afiliada do pool é avaliada contra a régua editorial de cada
            marca — estética, tom de voz, qualidade de produção e
            compatibilidade de portfólio.
          </p>
        </section>

        <div className="editorial-rule" />

        {/* Métricas */}
        <section className="grid grid-cols-1 md:grid-cols-3 gap-12 md:gap-20">
          <div>
            <div className="text-[10px] uppercase tracking-[0.25em] text-muted-foreground mb-3">
              Pool ativo
            </div>
            <div className="font-display text-6xl tracking-tighter">
              {poolCount ?? 0}
            </div>
            <div className="text-sm text-muted-foreground mt-2">
              afiliadas no TikTok Shop Brasil
            </div>
          </div>
          <div>
            <div className="text-[10px] uppercase tracking-[0.25em] text-muted-foreground mb-3">
              Marcas curadas
            </div>
            <div className="font-display text-6xl tracking-tighter">
              {brands?.length ?? 0}
            </div>
            <div className="text-sm text-muted-foreground mt-2">
              {(brands ?? []).map((b) => b.name).join(" · ")}
            </div>
          </div>
          <div>
            <div className="text-[10px] uppercase tracking-[0.25em] text-muted-foreground mb-3">
              Avaliações concluídas
            </div>
            <div className="font-display text-6xl tracking-tighter">
              {scores?.length ?? 0}
            </div>
            <div className="text-sm text-muted-foreground mt-2">
              análises editoriais publicadas
            </div>
          </div>
        </section>

        <div className="editorial-rule" />

        {/* Marcas */}
        <section className="space-y-8">
          <div className="flex items-end justify-between">
            <h2 className="font-display text-3xl tracking-tight">Marcas</h2>
            <Link
              href="/dashboard/scores"
              className="text-xs uppercase tracking-[0.2em] text-muted-foreground hover:text-foreground transition-colors"
            >
              Ver curadoria completa →
            </Link>
          </div>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
            {Array.from(summaryByBrand.values()).map((b) => (
              <Link
                key={b.id}
                href={`/dashboard/scores?brand=${b.slug}`}
                className="group border border-border bg-card p-8 hover:border-foreground transition-colors"
              >
                <div className="flex items-start justify-between mb-8">
                  <div>
                    <div className="text-[10px] uppercase tracking-[0.25em] text-muted-foreground mb-2">
                      L&apos;Oréal Luxe
                    </div>
                    <h3 className="font-display text-3xl tracking-tight">
                      {b.name}
                    </h3>
                  </div>
                  <span className="text-xl text-muted-foreground group-hover:text-foreground transition-all group-hover:translate-x-1">
                    →
                  </span>
                </div>
                <div className="grid grid-cols-3 gap-6 text-sm">
                  <div>
                    <div className="font-display text-3xl">{b.approve}</div>
                    <div className="text-[10px] uppercase tracking-wider text-muted-foreground mt-1">
                      Encaixam
                    </div>
                  </div>
                  <div>
                    <div className="font-display text-3xl">{b.monitor}</div>
                    <div className="text-[10px] uppercase tracking-wider text-muted-foreground mt-1">
                      Observar
                    </div>
                  </div>
                  <div>
                    <div className="font-display text-3xl text-muted-foreground">
                      {b.total_curated}
                    </div>
                    <div className="text-[10px] uppercase tracking-wider text-muted-foreground mt-1">
                      Total
                    </div>
                  </div>
                </div>
              </Link>
            ))}
          </div>
        </section>
      </main>
    </>
  );
}
