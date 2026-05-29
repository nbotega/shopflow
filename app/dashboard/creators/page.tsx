import Link from "next/link";
import { createClient } from "@/lib/supabase/server";
import { SiteHeader } from "@/components/site-header";
import { CreatorAvatar } from "@/components/creator-avatar";
import { HumanLabelBadge } from "@/components/score-badge";
import { DeleteCreatorButton } from "@/components/delete-creator-button";
import { createClient as createClientAuth } from "@/lib/supabase/server";

const ADMIN_EMAILS = ["nelbotega@gmail.com"];

type CreatorRow = {
  id: string;
  tiktok_handle: string;
  display_name: string | null;
  gmv_total_brl: number | null;
  orders_total: number | null;
  loreal_human_label_normalized: string | null;
  follower_count: number | null;
  avatar_url: string | null;
};

export default async function CreatorsPage() {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  const isAdmin = ADMIN_EMAILS.includes(user?.email ?? "");

  const { data: creators } = await supabase
    .from("creators")
    .select(
      "id, tiktok_handle, display_name, gmv_total_brl, orders_total, loreal_human_label_normalized, follower_count, avatar_url"
    )
    .order("gmv_total_brl", { ascending: false, nullsFirst: false });

  const rows = (creators ?? []) as CreatorRow[];

  return (
    <>
      <SiteHeader active="afiliadas" />
      <main className="max-w-6xl mx-auto px-6 py-12 space-y-10">
        <section className="space-y-3">
          <div className="text-[10px] uppercase tracking-[0.3em] text-muted-foreground">
            Pool ativo · TikTok Shop Brasil
          </div>
          <h1 className="font-display text-5xl tracking-tighter">
            Afiliadas
          </h1>
          <p className="text-sm text-muted-foreground max-w-xl">
            {rows.length} afiliadas mapeadas, ordenadas por volume de vendas no
            TikTok Shop.
          </p>
        </section>

        <div className="editorial-rule" />

        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-x-8 gap-y-10">
          {rows.map((c) => (
            <div
              key={c.id}
              className="group relative flex items-start gap-4 hover:bg-accent/30 -mx-3 px-3 py-3 transition-colors"
            >
              {isAdmin && (
                <div className="absolute top-2 right-2 z-10">
                  <DeleteCreatorButton
                    creatorId={c.id}
                    handle={c.tiktok_handle}
                  />
                </div>
              )}
              <Link
                href={`/dashboard/creators/${c.id}`}
                className="flex items-start gap-4 flex-1 min-w-0"
              >
              <CreatorAvatar
                avatarUrl={c.avatar_url}
                handle={c.tiktok_handle}
                displayName={c.display_name}
                size="lg"
              />
              <div className="flex-1 min-w-0">
                <div className="flex items-center gap-2">
                  <span className="font-display text-lg truncate group-hover:underline underline-offset-4">
                    {c.display_name ?? c.tiktok_handle}
                  </span>
                  <HumanLabelBadge
                    label={c.loreal_human_label_normalized}
                  />
                </div>
                <div className="text-xs text-muted-foreground font-mono mt-0.5">
                  @{c.tiktok_handle}
                </div>
                <div className="mt-3 space-y-0.5 text-xs">
                  {c.gmv_total_brl !== null && (
                    <div className="flex justify-between text-muted-foreground">
                      <span>Vendas</span>
                      <span className="text-foreground tabular-nums">
                        R$ {Number(c.gmv_total_brl).toLocaleString("pt-BR")}
                      </span>
                    </div>
                  )}
                  {c.orders_total !== null && (
                    <div className="flex justify-between text-muted-foreground">
                      <span>Pedidos</span>
                      <span className="text-foreground tabular-nums">
                        {c.orders_total}
                      </span>
                    </div>
                  )}
                  {c.follower_count !== null && (
                    <div className="flex justify-between text-muted-foreground">
                      <span>Seguidores</span>
                      <span className="text-foreground tabular-nums">
                        {c.follower_count.toLocaleString("pt-BR")}
                      </span>
                    </div>
                  )}
                </div>
              </div>
              </Link>
            </div>
          ))}
          {rows.length === 0 && (
            <div className="col-span-full text-center py-20 text-muted-foreground text-sm">
              Pool vazio.
            </div>
          )}
        </div>
      </main>
    </>
  );
}
