import { createClient } from "@/lib/supabase/server";
import { redirect } from "next/navigation";
import Link from "next/link";
import { SiteHeader } from "@/components/site-header";
import { CSVUpload } from "@/components/csv-upload";
import { BatchEnrichButton } from "@/components/batch-enrich-button";
import { BatchTranscribeButton } from "@/components/batch-transcribe-button";
import { BatchVisualButton } from "@/components/batch-visual-button";
import { BatchJudgeButton } from "@/components/batch-judge-button";
import { BatchRefreshButton } from "@/components/batch-refresh-button";

// Esta página é interna — só Nelson acessa. Não tá no nav principal.
export default async function AdminPage() {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  // Só Nelson tem acesso à área operacional
  if (user?.email !== "nelbotega@gmail.com") {
    redirect("/dashboard");
  }

  const { data: creators } = await supabase
    .from("creators")
    .select(
      "id, enrichment_status, transcripts_status, avatar_url"
    );

  const rows = creators ?? [];
  const pendingEnrich = rows
    .filter((r) => r.enrichment_status === "pending")
    .map((r) => r.id);
  const pendingTranscribe = rows
    .filter(
      (r) =>
        r.enrichment_status === "enriched" && r.transcripts_status !== "done"
    )
    .map((r) => r.id);
  const enrichedIds = rows
    .filter((r) => r.enrichment_status === "enriched")
    .map((r) => r.id);
  const missingAvatar = rows
    .filter((r) => !r.avatar_url)
    .map((r) => r.id);

  const { data: pendingAssignments } =
    enrichedIds.length > 0
      ? await supabase
          .from("creator_brand_assignments")
          .select("id")
          .in("creator_id", enrichedIds)
          .eq("status", "pending")
      : { data: [] as { id: string }[] };

  return (
    <>
      <SiteHeader active="admin" />
      <main className="max-w-4xl mx-auto px-6 py-12 space-y-10">
        <div className="space-y-2">
          <div className="text-[10px] uppercase tracking-[0.3em] text-muted-foreground">
            Operação interna
          </div>
          <h1 className="font-display text-4xl tracking-tighter">
            Administração
          </h1>
          <p className="text-sm text-muted-foreground">
            Pipelines de coleta e avaliação. Acesso restrito.
          </p>
        </div>

        <div className="editorial-rule" />

        <section className="space-y-3">
          <h2 className="font-display text-2xl">Ingestão</h2>
          <CSVUpload />
        </section>

        <section className="space-y-4">
          <h2 className="font-display text-2xl">Pipeline</h2>
          <div className="grid gap-4 sm:grid-cols-2">
            <div className="border border-border p-5 space-y-2">
              <div className="text-xs uppercase tracking-wider text-muted-foreground">
                Coleta de perfis
              </div>
              <p className="text-xs text-muted-foreground">
                Pega bio, vídeos recentes e métricas de cada afiliada.
              </p>
              <BatchEnrichButton pendingIds={pendingEnrich} />
            </div>
            <div className="border border-border p-5 space-y-2">
              <div className="text-xs uppercase tracking-wider text-muted-foreground">
                Avatares & métricas
              </div>
              <p className="text-xs text-muted-foreground">
                Atualiza foto, followers e bio direto do perfil público TikTok.
              </p>
              <BatchRefreshButton creatorIds={missingAvatar} />
            </div>
            <div className="border border-border p-5 space-y-2">
              <div className="text-xs uppercase tracking-wider text-muted-foreground">
                Transcrição
              </div>
              <p className="text-xs text-muted-foreground">
                Extrai texto dos vídeos coletados.
              </p>
              <BatchTranscribeButton creatorIds={pendingTranscribe} />
            </div>
            <div className="border border-border p-5 space-y-2">
              <div className="text-xs uppercase tracking-wider text-muted-foreground">
                Análise visual
              </div>
              <p className="text-xs text-muted-foreground">
                Identifica paleta, iluminação, vibe e qualidade de produção.
              </p>
              <BatchVisualButton creatorIds={enrichedIds} />
            </div>
            <div className="border border-border p-5 space-y-2">
              <div className="text-xs uppercase tracking-wider text-muted-foreground">
                Curadoria
              </div>
              <p className="text-xs text-muted-foreground">
                Gera Match Score por afiliada × marca.
              </p>
              <BatchJudgeButton
                assignmentIds={(pendingAssignments ?? []).map((a) => a.id)}
              />
            </div>
          </div>
        </section>

        <div className="text-xs text-muted-foreground">
          <Link href="/dashboard" className="hover:text-foreground">
            ← Voltar pra visão geral
          </Link>
        </div>
      </main>
    </>
  );
}
