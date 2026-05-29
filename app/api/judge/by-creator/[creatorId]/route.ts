import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { createAdminClient } from "@/lib/supabase/admin";

export const runtime = "nodejs";
export const maxDuration = 60;

/**
 * POST /api/judge/by-creator/[creatorId]
 *
 * Reseta + roda judge em todos assignments de UMA creator (todas as marcas).
 * Útil pra refresh individual.
 */
export async function POST(
  request: Request,
  ctx: { params: Promise<{ creatorId: string }> }
) {
  const supabase = await createClient();
  const {
    data: { user },
    error: authError,
  } = await supabase.auth.getUser();

  if (authError || !user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const { creatorId } = await ctx.params;
  const admin = createAdminClient();

  // Pega assignments da creator
  const { data: assignments } = await admin
    .from("creator_brand_assignments")
    .select("id, brand:brands(name)")
    .eq("creator_id", creatorId);

  if (!assignments || assignments.length === 0) {
    return NextResponse.json({
      success: false,
      error: "No assignments for this creator",
    });
  }

  // Reseta status pra pending + invalida scores antigos
  await admin
    .from("creator_brand_assignments")
    .update({ status: "pending" })
    .eq("creator_id", creatorId);

  await admin
    .from("scores")
    .update({ is_latest: false })
    .eq("creator_id", creatorId)
    .eq("is_latest", true);

  // Dispara judge em cada assignment via fetch (reusa o endpoint singular)
  const origin = new URL(request.url).origin;
  const cookieHeader = request.headers.get("cookie") ?? "";

  const results = await Promise.allSettled(
    assignments.map((a) =>
      fetch(`${origin}/api/judge/${a.id}`, {
        method: "POST",
        headers: { cookie: cookieHeader },
      }).then((r) => r.json())
    )
  );

  const succeeded = results.filter(
    (r) => r.status === "fulfilled" && r.value?.success
  ).length;
  const failed = assignments.length - succeeded;

  return NextResponse.json({
    success: succeeded > 0,
    total: assignments.length,
    succeeded,
    failed,
    results: results.map((r) =>
      r.status === "fulfilled" ? r.value : { error: String(r.reason) }
    ),
  });
}
