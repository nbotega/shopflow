import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { parseAffiliateCSV } from "@/lib/csv-import";

export const runtime = "nodejs";
export const maxDuration = 60;

/**
 * POST /api/import-csv
 * Body: multipart/form-data com campo "file" (arquivo CSV)
 *
 * Importa afiliadas reais do CSV do time L'Oréal/Snack:
 * 1. Parse CSV
 * 2. Filtra afiliadas com GMV > 0
 * 3. Upsert creators
 * 4. Cria assignments pra TODAS as brands ativas (uma análise por marca)
 * 5. Cria run + discovery_job pra rastreabilidade
 */
export async function POST(request: Request) {
  const supabase = await createClient();
  const {
    data: { user },
    error: authError,
  } = await supabase.auth.getUser();

  if (authError || !user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const formData = await request.formData();
  const file = formData.get("file");

  if (!file || !(file instanceof File)) {
    return NextResponse.json(
      { error: "Arquivo CSV obrigatório (campo 'file')" },
      { status: 400 }
    );
  }

  const csvText = await file.text();
  const { valid, skipped, total } = parseAffiliateCSV(csvText);

  if (valid.length === 0) {
    return NextResponse.json(
      {
        error: "Nenhuma afiliada válida no CSV (filtro: GMV > 0 e handle TikTok)",
        total,
        skipped,
      },
      { status: 400 }
    );
  }

  const admin = createAdminClient();

  // Carrega todas as brands ativas (vai criar assignment de cada creator pra cada brand)
  const { data: brandsData, error: brandsError } = await admin
    .from("brands")
    .select("id, name, client_id")
    .eq("active", true);

  if (brandsError || !brandsData?.length) {
    return NextResponse.json(
      { error: `Nenhuma brand ativa: ${brandsError?.message ?? "vazio"}` },
      { status: 500 }
    );
  }

  // Usa client_id da primeira brand pra criar o run (todas devem ser do mesmo client no MVP)
  const clientId = brandsData[0].client_id;

  // Cria run + discovery_job
  const { data: run, error: runError } = await admin
    .from("runs")
    .insert({
      client_id: clientId,
      triggered_by: user.id,
      run_type: "discovery",
      status: "running",
    })
    .select()
    .single();

  if (runError || !run) {
    return NextResponse.json(
      { error: `Falha ao criar run: ${runError?.message}` },
      { status: 500 }
    );
  }

  // Upsert creators em batch
  const creatorRows = valid.map((a) => ({
    tiktok_handle: a.tiktok_handle,
    display_name: a.display_name,
    gmv_total_brl: a.gmv_total_brl,
    orders_total: a.orders_total,
    avg_ticket_brl: a.avg_ticket_brl,
    loreal_human_label: a.loreal_human_label,
    loreal_human_label_normalized: a.loreal_human_label_normalized,
    import_source: file.name || "csv_upload",
    enrichment_status: "pending",
  }));

  const { data: upsertedCreators, error: creatorsError } = await admin
    .from("creators")
    .upsert(creatorRows, { onConflict: "tiktok_handle" })
    .select("id, tiktok_handle");

  if (creatorsError) {
    await admin
      .from("runs")
      .update({
        status: "failed",
        error_message: creatorsError.message,
        completed_at: new Date().toISOString(),
      })
      .eq("id", run.id);

    return NextResponse.json(
      { error: `Falha ao inserir creators: ${creatorsError.message}` },
      { status: 500 }
    );
  }

  // Cria assignments: cada creator × cada brand
  const assignmentRows = (upsertedCreators ?? []).flatMap((c) =>
    brandsData.map((b) => ({
      creator_id: c.id,
      brand_id: b.id,
      client_id: b.client_id,
      discovery_source: "csv_upload",
      status: "pending" as const,
    }))
  );

  const { error: assignError } = await admin
    .from("creator_brand_assignments")
    .upsert(assignmentRows, {
      onConflict: "creator_id,brand_id,client_id",
      ignoreDuplicates: true,
    });

  // Finaliza run
  await admin
    .from("runs")
    .update({
      status: assignError ? "completed_with_errors" : "completed",
      total_creators: valid.length,
      processed_creators: upsertedCreators?.length ?? 0,
      error_message: assignError?.message ?? null,
      completed_at: new Date().toISOString(),
    })
    .eq("id", run.id);

  return NextResponse.json({
    success: true,
    run_id: run.id,
    csv_total_rows: total,
    csv_skipped: skipped,
    creators_imported: upsertedCreators?.length ?? 0,
    brands_assigned: brandsData.length,
    total_assignments: assignmentRows.length,
    label_distribution: {
      sim: valid.filter((a) => a.loreal_human_label_normalized === "sim").length,
      nao: valid.filter((a) => a.loreal_human_label_normalized === "nao").length,
      maybe: valid.filter((a) => a.loreal_human_label_normalized === "maybe")
        .length,
      sem_label: valid.filter((a) => !a.loreal_human_label_normalized).length,
    },
  });
}
