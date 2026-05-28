import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { createAdminClient } from "@/lib/supabase/admin";
import {
  searchTikTokUsers,
  normalizeRecordToArray,
  extractAvatarUrl,
  type SociavaultUserResult,
} from "@/lib/services/sociavault";

export const runtime = "nodejs";
export const maxDuration = 60;

/**
 * POST /api/discover
 * Body: { brandId: string, queries?: string[] }
 *
 * Roda descoberta de creators no TikTok pra uma marca:
 * 1. Busca por queries (default: nome da marca)
 * 2. Deduplica creators
 * 3. Insere em creators + creator_brand_assignments
 * 4. Registra em discovery_jobs
 */
export async function POST(request: Request) {
  // Autentica via session (usuário logado no SHOPFLOW)
  const supabase = await createClient();
  const {
    data: { user },
    error: authError,
  } = await supabase.auth.getUser();

  if (authError || !user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const body = (await request.json().catch(() => ({}))) as {
    brandId?: string;
    queries?: string[];
  };

  if (!body.brandId) {
    return NextResponse.json(
      { error: "brandId é obrigatório" },
      { status: 400 }
    );
  }

  const admin = createAdminClient();

  // Carrega marca
  const { data: brand, error: brandError } = await admin
    .from("brands")
    .select("id, name, client_id")
    .eq("id", body.brandId)
    .single();

  if (brandError || !brand) {
    return NextResponse.json({ error: "Marca não encontrada" }, { status: 404 });
  }

  // Cria o run e o discovery_job
  const { data: run, error: runError } = await admin
    .from("runs")
    .insert({
      client_id: brand.client_id,
      brand_id: brand.id,
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

  const queries = body.queries?.length ? body.queries : [brand.name];

  const { data: job } = await admin
    .from("discovery_jobs")
    .insert({
      run_id: run.id,
      client_id: brand.client_id,
      brand_id: brand.id,
      source: "sociavault",
      query_params: { queries },
      status: "running",
    })
    .select()
    .single();

  // Busca em paralelo
  const results = await Promise.allSettled(
    queries.map((q) => searchTikTokUsers(q))
  );

  const allUsers = new Map<string, SociavaultUserResult>();
  let totalCreditsUsed = 0;
  const errors: string[] = [];

  for (let i = 0; i < results.length; i++) {
    const r = results[i];
    if (r.status === "fulfilled") {
      totalCreditsUsed += r.value.credits_used ?? 0;
      const list = normalizeRecordToArray(r.value.data?.user_list);
      for (const item of list) {
        const handle = item.user_info?.unique_id;
        if (handle && !allUsers.has(handle)) {
          allUsers.set(handle, item);
        }
      }
    } else {
      errors.push(`"${queries[i]}": ${String(r.reason).slice(0, 200)}`);
    }
  }

  // Insere creators + assignments
  let newCreators = 0;
  let newAssignments = 0;

  for (const [, item] of allUsers) {
    const info = item.user_info;
    const { data: creator } = await admin
      .from("creators")
      .upsert(
        {
          tiktok_handle: info.unique_id,
          tiktok_user_id: info.uid,
          display_name: info.nickname,
          bio: info.signature,
          follower_count: info.follower_count,
          following_count: info.following_count,
          total_likes: info.total_favorited,
          avatar_url: extractAvatarUrl(info.avatar_larger ?? info.avatar_medium),
          verified: Boolean(info.custom_verify),
          raw_sociavault_data: info as unknown as Record<string, unknown>,
        },
        { onConflict: "tiktok_handle" }
      )
      .select("id, created_at, last_enriched_at")
      .single();

    if (!creator) continue;

    // Considera "novo" se foi criado nessa request (created_at == updated_at e last_enriched_at null)
    if (!creator.last_enriched_at) newCreators++;

    const { error: assignErr } = await admin
      .from("creator_brand_assignments")
      .upsert(
        {
          creator_id: creator.id,
          brand_id: brand.id,
          client_id: brand.client_id,
          discovery_source: "sociavault",
          status: "pending",
        },
        { onConflict: "creator_id,brand_id,client_id", ignoreDuplicates: true }
      );

    if (!assignErr) newAssignments++;
  }

  // Finaliza job + run
  await admin
    .from("discovery_jobs")
    .update({
      creators_found: allUsers.size,
      new_creators_added: newCreators,
      status: errors.length ? "completed_with_errors" : "completed",
      cost_usd: totalCreditsUsed * 0.002, // estimativa: 1 credit ≈ $0.002 no plano padrão
      error_message: errors.length ? errors.join("\n") : null,
      completed_at: new Date().toISOString(),
    })
    .eq("id", job?.id ?? "");

  await admin
    .from("runs")
    .update({
      status: errors.length === queries.length ? "failed" : "completed",
      total_creators: allUsers.size,
      processed_creators: allUsers.size,
      total_cost_usd: totalCreditsUsed * 0.002,
      error_message: errors.length ? errors.join("\n") : null,
      completed_at: new Date().toISOString(),
    })
    .eq("id", run.id);

  return NextResponse.json({
    success: true,
    run_id: run.id,
    brand: brand.name,
    queries,
    creators_found: allUsers.size,
    new_creators_added: newCreators,
    new_assignments: newAssignments,
    credits_used: totalCreditsUsed,
    errors,
  });
}
