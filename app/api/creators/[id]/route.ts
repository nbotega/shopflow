import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { createAdminClient } from "@/lib/supabase/admin";

export const runtime = "nodejs";

// Lista de emails autorizados a deletar (admin)
const ADMIN_EMAILS = ["nelbotega@gmail.com"];

export async function DELETE(
  request: Request,
  ctx: { params: Promise<{ id: string }> }
) {
  const supabase = await createClient();
  const {
    data: { user },
    error: authError,
  } = await supabase.auth.getUser();

  if (authError || !user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  if (!ADMIN_EMAILS.includes(user.email ?? "")) {
    return NextResponse.json(
      { error: "Apenas admin pode deletar afiliadas" },
      { status: 403 }
    );
  }

  const { id } = await ctx.params;
  const admin = createAdminClient();

  const { data: creator } = await admin
    .from("creators")
    .select("tiktok_handle")
    .eq("id", id)
    .single();

  if (!creator) {
    return NextResponse.json({ error: "Não encontrada" }, { status: 404 });
  }

  // CASCADE delete já remove assignments/videos/transcripts/scores/visual_analyses
  const { error } = await admin.from("creators").delete().eq("id", id);

  if (error) {
    return NextResponse.json(
      { error: `Falha ao deletar: ${error.message}` },
      { status: 500 }
    );
  }

  return NextResponse.json({
    success: true,
    handle: creator.tiktok_handle,
  });
}
