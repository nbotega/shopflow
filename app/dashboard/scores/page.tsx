import Link from "next/link";
import { createClient } from "@/lib/supabase/server";
import { Button } from "@/components/ui/button";
import { ScoreBadge, HumanLabelBadge } from "@/components/score-badge";

type ScoreRow = {
  id: string;
  luxo_fit_score: number;
  recommendation: string;
  justificativa_resumida: string;
  brand: { name: string; slug: string } | { name: string; slug: string }[] | null;
  creator: {
    id: string;
    tiktok_handle: string;
    display_name: string | null;
    gmv_total_brl: number | null;
    loreal_human_label_normalized: string | null;
  } | { id: string; tiktok_handle: string; display_name: string | null; gmv_total_brl: number | null; loreal_human_label_normalized: string | null }[] | null;
};

function flatten<T>(v: T | T[] | null): T | null {
  if (!v) return null;
  return Array.isArray(v) ? v[0] ?? null : v;
}

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

  let query = supabase
    .from("scores")
    .select(
      `id, luxo_fit_score, recommendation, justificativa_resumida,
       brand:brands!inner(name, slug),
       creator:creators!inner(id, tiktok_handle, display_name, gmv_total_brl, loreal_human_label_normalized)`
    )
    .eq("is_latest", true)
    .order("luxo_fit_score", { ascending: false });

  if (selectedBrandSlug) {
    query = query.eq("brand.slug", selectedBrandSlug);
  }
  if (selectedRec) {
    query = query.eq("recommendation", selectedRec);
  }

  const { data: scores } = await query;
  const rows = (scores ?? []) as ScoreRow[];

  // Counts por recommendation
  const counts = { approve: 0, monitor: 0, borderline: 0, reject: 0 };
  for (const r of rows) {
    if (r.recommendation in counts) {
      counts[r.recommendation as keyof typeof counts]++;
    }
  }

  return (
    <div className="min-h-screen bg-background">
      <header className="border-b">
        <div className="max-w-7xl mx-auto px-6 py-4 flex items-center justify-between">
          <div>
            <Link
              href="/dashboard"
              className="text-xs text-muted-foreground hover:text-foreground"
            >
              ← Dashboard
            </Link>
            <h1 className="text-2xl font-bold tracking-tight">
              Ranking de afiliadas
            </h1>
          </div>
          <Button variant="outline" size="sm" asChild>
            <Link href="/dashboard/creators">Ver todas as afiliadas</Link>
          </Button>
        </div>
      </header>

      <main className="max-w-7xl mx-auto px-6 py-8 space-y-6">
        {/* Tabs de brand */}
        <div className="flex gap-2 border-b">
          {(brands ?? []).map((b) => {
            const active = b.slug === selectedBrandSlug;
            return (
              <Link
                key={b.id}
                href={`/dashboard/scores?brand=${b.slug}${selectedRec ? `&rec=${selectedRec}` : ""}`}
                className={`px-4 py-2 text-sm font-medium border-b-2 -mb-px ${
                  active
                    ? "border-foreground text-foreground"
                    : "border-transparent text-muted-foreground hover:text-foreground"
                }`}
              >
                {b.name}
              </Link>
            );
          })}
        </div>

        {/* Filtros por recommendation */}
        <div className="flex gap-2 text-xs">
          {[
            { key: null, label: `Todas (${rows.length})` },
            { key: "approve", label: `Aprovar (${counts.approve})` },
            { key: "monitor", label: `Monitorar (${counts.monitor})` },
            { key: "borderline", label: `Borderline (${counts.borderline})` },
            { key: "reject", label: `Rejeitar (${counts.reject})` },
          ].map((f) => {
            const active = (selectedRec ?? null) === f.key;
            const href = `/dashboard/scores?brand=${selectedBrandSlug}${f.key ? `&rec=${f.key}` : ""}`;
            return (
              <Link
                key={f.key ?? "all"}
                href={href}
                className={`px-3 py-1 rounded border ${
                  active
                    ? "bg-foreground text-background border-foreground"
                    : "border-input text-muted-foreground hover:text-foreground"
                }`}
              >
                {f.label}
              </Link>
            );
          })}
        </div>

        {/* Tabela */}
        <div className="border rounded-lg overflow-hidden">
          <table className="w-full text-sm">
            <thead className="bg-muted/30 border-b text-left">
              <tr>
                <th className="px-4 py-3 font-medium w-12">#</th>
                <th className="px-4 py-3 font-medium">Decisão IA</th>
                <th className="px-4 py-3 font-medium">@handle</th>
                <th className="px-4 py-3 font-medium text-right">GMV</th>
                <th className="px-4 py-3 font-medium">Humano</th>
                <th className="px-4 py-3 font-medium">Justificativa</th>
              </tr>
            </thead>
            <tbody>
              {rows.map((r, i) => {
                const c = flatten(r.creator);
                if (!c) return null;
                return (
                  <tr key={r.id} className="border-b hover:bg-muted/20">
                    <td className="px-4 py-3 text-muted-foreground tabular-nums">
                      {i + 1}
                    </td>
                    <td className="px-4 py-3">
                      <ScoreBadge
                        score={r.luxo_fit_score}
                        recommendation={r.recommendation}
                      />
                    </td>
                    <td className="px-4 py-3">
                      <Link
                        href={`/dashboard/creators/${c.id}`}
                        className="font-mono text-xs hover:underline"
                      >
                        @{c.tiktok_handle}
                      </Link>
                      <div className="text-[10px] text-muted-foreground truncate max-w-[200px]">
                        {c.display_name}
                      </div>
                    </td>
                    <td className="px-4 py-3 text-right tabular-nums text-muted-foreground">
                      {c.gmv_total_brl
                        ? `R$ ${Number(c.gmv_total_brl).toLocaleString("pt-BR")}`
                        : "—"}
                    </td>
                    <td className="px-4 py-3">
                      <HumanLabelBadge
                        label={c.loreal_human_label_normalized}
                      />
                    </td>
                    <td className="px-4 py-3 max-w-[450px] text-xs text-muted-foreground">
                      <div className="line-clamp-2">
                        {r.justificativa_resumida}
                      </div>
                    </td>
                  </tr>
                );
              })}
              {rows.length === 0 && (
                <tr>
                  <td
                    colSpan={6}
                    className="px-4 py-12 text-center text-muted-foreground"
                  >
                    Nenhum score ainda. Rode o pipeline pra começar.
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      </main>
    </div>
  );
}
