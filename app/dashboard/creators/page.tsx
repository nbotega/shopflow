import Link from "next/link";
import { createClient } from "@/lib/supabase/server";
import { Button } from "@/components/ui/button";
import { EnrichButton } from "@/components/enrich-button";
import { BatchEnrichButton } from "@/components/batch-enrich-button";
import { BatchTranscribeButton } from "@/components/batch-transcribe-button";
import { BatchJudgeButton } from "@/components/batch-judge-button";
import { BatchVisualButton } from "@/components/batch-visual-button";

type CreatorRow = {
  id: string;
  tiktok_handle: string;
  display_name: string | null;
  gmv_total_brl: number | null;
  orders_total: number | null;
  loreal_human_label_normalized: string | null;
  loreal_human_label: string | null;
  enrichment_status: string;
  transcripts_status: string;
  transcripts_done_count: number | null;
  follower_count: number | null;
  last_enriched_at: string | null;
};

function labelBadge(label: string | null) {
  if (label === "sim")
    return (
      <span className="inline-block px-2 py-0.5 text-xs rounded bg-foreground text-background font-medium">
        SIM
      </span>
    );
  if (label === "nao")
    return (
      <span className="inline-block px-2 py-0.5 text-xs rounded bg-muted text-muted-foreground">
        não
      </span>
    );
  if (label === "maybe")
    return (
      <span className="inline-block px-2 py-0.5 text-xs rounded border border-foreground/30">
        maybe
      </span>
    );
  return <span className="text-muted-foreground text-xs">—</span>;
}

function statusBadge(status: string) {
  const styles: Record<string, string> = {
    pending: "text-muted-foreground",
    enriching: "text-foreground animate-pulse",
    enriched: "text-foreground",
    failed: "text-destructive",
  };
  return (
    <span className={`text-xs ${styles[status] ?? "text-muted-foreground"}`}>
      {status}
    </span>
  );
}

export default async function CreatorsPage() {
  const supabase = await createClient();

  const { data: creators } = await supabase
    .from("creators")
    .select(
      "id, tiktok_handle, display_name, gmv_total_brl, orders_total, loreal_human_label_normalized, loreal_human_label, enrichment_status, transcripts_status, transcripts_done_count, follower_count, last_enriched_at"
    )
    .order("gmv_total_brl", { ascending: false, nullsFirst: false });

  const rows = (creators ?? []) as CreatorRow[];

  // Assignments pendentes pra Claude judge (só de creators enriched + transcribed)
  const eligibleCreatorIds = rows
    .filter(
      (r) =>
        r.enrichment_status === "enriched" && r.transcripts_status === "done"
    )
    .map((r) => r.id);

  const { data: pendingAssignments } =
    eligibleCreatorIds.length > 0
      ? await supabase
          .from("creator_brand_assignments")
          .select("id")
          .in("creator_id", eligibleCreatorIds)
          .eq("status", "pending")
      : { data: [] };

  const judgeableIds = (pendingAssignments ?? []).map((a) => a.id);

  const totals = {
    all: rows.length,
    pending: rows.filter((r) => r.enrichment_status === "pending").length,
    enriching: rows.filter((r) => r.enrichment_status === "enriching").length,
    enriched: rows.filter((r) => r.enrichment_status === "enriched").length,
    failed: rows.filter((r) => r.enrichment_status === "failed").length,
  };

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
              Afiliadas ({totals.all})
            </h1>
          </div>
          <div className="flex items-center gap-6">
            <div className="text-xs text-muted-foreground flex gap-4">
              <span>{totals.pending} pendentes</span>
              <span>{totals.enriching} processando</span>
              <span>{totals.enriched} enriquecidas</span>
              {totals.failed > 0 && (
                <span className="text-destructive">{totals.failed} falhas</span>
              )}
            </div>
            <BatchEnrichButton
              pendingIds={rows
                .filter((r) => r.enrichment_status === "pending")
                .map((r) => r.id)}
            />
            <BatchTranscribeButton
              creatorIds={rows
                .filter(
                  (r) =>
                    r.enrichment_status === "enriched" &&
                    r.transcripts_status !== "done"
                )
                .map((r) => r.id)}
            />
            <BatchVisualButton
              creatorIds={rows
                .filter((r) => r.enrichment_status === "enriched")
                .map((r) => r.id)}
            />
            <BatchJudgeButton assignmentIds={judgeableIds} />
          </div>
        </div>
      </header>

      <main className="max-w-7xl mx-auto px-6 py-8">
        <div className="border rounded-lg overflow-hidden">
          <table className="w-full text-sm">
            <thead className="bg-muted/30 border-b">
              <tr className="text-left">
                <th className="px-4 py-3 font-medium">@handle</th>
                <th className="px-4 py-3 font-medium">Nome</th>
                <th className="px-4 py-3 font-medium text-right">GMV</th>
                <th className="px-4 py-3 font-medium text-right">Pedidos</th>
                <th className="px-4 py-3 font-medium text-right">Followers</th>
                <th className="px-4 py-3 font-medium">Luxo?</th>
                <th className="px-4 py-3 font-medium">Status</th>
                <th className="px-4 py-3 font-medium text-right">Ação</th>
              </tr>
            </thead>
            <tbody>
              {rows.map((c) => (
                <tr key={c.id} className="border-b hover:bg-muted/20">
                  <td className="px-4 py-3 font-mono text-xs">
                    <a
                      href={`https://www.tiktok.com/@${c.tiktok_handle}`}
                      target="_blank"
                      rel="noreferrer"
                      className="hover:underline"
                    >
                      @{c.tiktok_handle}
                    </a>
                  </td>
                  <td className="px-4 py-3 max-w-[180px] truncate">
                    {c.display_name ?? "—"}
                  </td>
                  <td className="px-4 py-3 text-right tabular-nums">
                    {c.gmv_total_brl
                      ? `R$ ${Number(c.gmv_total_brl).toLocaleString("pt-BR")}`
                      : "—"}
                  </td>
                  <td className="px-4 py-3 text-right tabular-nums text-muted-foreground">
                    {c.orders_total ?? "—"}
                  </td>
                  <td className="px-4 py-3 text-right tabular-nums text-muted-foreground">
                    {c.follower_count
                      ? c.follower_count.toLocaleString("pt-BR")
                      : "—"}
                  </td>
                  <td
                    className="px-4 py-3"
                    title={c.loreal_human_label ?? undefined}
                  >
                    {labelBadge(c.loreal_human_label_normalized)}
                  </td>
                  <td className="px-4 py-3">
                    {statusBadge(c.enrichment_status)}
                  </td>
                  <td className="px-4 py-3 text-right">
                    <EnrichButton
                      creatorId={c.id}
                      handle={c.tiktok_handle}
                      status={c.enrichment_status}
                    />
                  </td>
                </tr>
              ))}
              {rows.length === 0 && (
                <tr>
                  <td
                    colSpan={8}
                    className="px-4 py-12 text-center text-muted-foreground"
                  >
                    Nenhuma afiliada importada ainda.{" "}
                    <Link href="/dashboard" className="underline">
                      Voltar pro dashboard
                    </Link>{" "}
                    e fazer upload do CSV.
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>

        <div className="mt-6 flex justify-end">
          <Button variant="outline" size="sm" asChild>
            <Link href="/dashboard">Voltar pro dashboard</Link>
          </Button>
        </div>
      </main>
    </div>
  );
}
