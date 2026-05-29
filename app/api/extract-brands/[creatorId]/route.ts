import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { extractBrandMentions, extractContact } from "@/lib/brand-extractor";

export const runtime = "nodejs";
export const maxDuration = 30;

/**
 * POST /api/extract-brands/[creatorId]
 * Processa captions + hashtags + transcripts pra extrair marcas mencionadas + contato da bio.
 * Custo: zero (regex local).
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

  const { data: creator } = await admin
    .from("creators")
    .select("id, tiktok_handle, bio")
    .eq("id", creatorId)
    .single();

  if (!creator) {
    return NextResponse.json({ error: "Creator não encontrado" }, { status: 404 });
  }

  // Junta todo o corpus dela
  const { data: videos } = await admin
    .from("videos")
    .select("id, caption, hashtags")
    .eq("creator_id", creator.id);

  const videoIds = (videos ?? []).map((v) => v.id);
  const { data: transcripts } =
    videoIds.length > 0
      ? await admin
          .from("transcripts")
          .select("video_id, full_text")
          .in("video_id", videoIds)
      : { data: [] };

  const corpus = [
    creator.bio ?? "",
    ...(videos ?? []).flatMap((v) => [
      v.caption ?? "",
      ((v.hashtags as string[]) ?? []).join(" "),
    ]),
    ...(transcripts ?? []).map((t) => t.full_text ?? ""),
  ].join(" ");

  const brands = extractBrandMentions(corpus);
  const contact = extractContact(creator.bio);

  await admin
    .from("creators")
    .update({
      brands_sold: brands,
      contact_phone: contact.phone,
      contact_email: contact.email,
      contact_extracted_at: new Date().toISOString(),
    })
    .eq("id", creator.id);

  return NextResponse.json({
    success: true,
    handle: creator.tiktok_handle,
    brands_count: brands.length,
    top_brands: brands.slice(0, 5).map((b) => b.brand),
    contact,
  });
}
