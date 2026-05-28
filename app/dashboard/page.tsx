import { createClient } from "@/lib/supabase/server";
import { logout } from "@/app/login/actions";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { CSVUpload } from "@/components/csv-upload";

type BrandRow = {
  id: string;
  name: string;
  slug: string;
  score_threshold_approve: number;
  score_threshold_monitor: number;
  clients: { name: string } | { name: string }[] | null;
};

function clientName(clients: BrandRow["clients"]): string {
  if (!clients) return "";
  if (Array.isArray(clients)) return clients[0]?.name ?? "";
  return clients.name ?? "";
}

export default async function DashboardPage() {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  // Lista brands ativas
  const { data: brandsData } = await supabase
    .from("brands")
    .select("id, name, slug, score_threshold_approve, score_threshold_monitor, clients(name)")
    .eq("active", true)
    .order("name");

  const brands = (brandsData ?? []) as BrandRow[];

  // Conta creators por brand (assignments)
  const { data: assignmentStats } = await supabase
    .from("creator_brand_assignments")
    .select("brand_id, status");

  const statsByBrand = new Map<string, { total: number; pending: number }>();
  for (const a of assignmentStats ?? []) {
    const cur = statsByBrand.get(a.brand_id) ?? { total: 0, pending: 0 };
    cur.total += 1;
    if (a.status === "pending") cur.pending += 1;
    statsByBrand.set(a.brand_id, cur);
  }

  return (
    <div className="min-h-screen bg-background">
      <header className="border-b">
        <div className="max-w-7xl mx-auto px-6 py-4 flex items-center justify-between">
          <div>
            <h1 className="text-2xl font-bold tracking-tight">SHOPFLOW</h1>
            <p className="text-xs text-muted-foreground">{user?.email}</p>
          </div>
          <form action={logout}>
            <Button variant="outline" size="sm" type="submit">
              Sair
            </Button>
          </form>
        </div>
      </header>

      <main className="max-w-7xl mx-auto px-6 py-12 space-y-8">
        <div>
          <h2 className="text-3xl font-bold tracking-tight">Pool de afiliadas</h2>
          <p className="text-muted-foreground mt-1">
            Importe a lista de afiliadas reais TikTok Shop. A IA vai pontuar cada uma contra cada marca.
          </p>
        </div>

        <CSVUpload />

        <div>
          <h2 className="text-2xl font-bold tracking-tight pt-8">Marcas</h2>
          <p className="text-muted-foreground mt-1 text-sm">
            Cada afiliada do pool é analisada uma vez por marca.
          </p>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
          {brands.map((brand) => {
            const stats = statsByBrand.get(brand.id) ?? { total: 0, pending: 0 };
            return (
              <Card key={brand.id}>
                <CardHeader>
                  <CardTitle>{brand.name}</CardTitle>
                  <CardDescription>{clientName(brand.clients)}</CardDescription>
                </CardHeader>
                <CardContent>
                  <div className="text-sm text-muted-foreground space-y-1">
                    <p>
                      Afiliadas pra analisar:{" "}
                      <span className="text-foreground font-medium">{stats.total}</span>
                      {stats.pending > 0 && (
                        <span className="text-muted-foreground"> · {stats.pending} pendentes</span>
                      )}
                    </p>
                    <p className="text-xs">
                      Aprovação ≥ {brand.score_threshold_approve} · Monitoramento ≥{" "}
                      {brand.score_threshold_monitor}
                    </p>
                  </div>
                </CardContent>
              </Card>
            );
          })}
          {brands.length === 0 && (
            <p className="text-muted-foreground col-span-full text-center py-12">
              Nenhuma marca cadastrada.
            </p>
          )}
        </div>

        <div className="text-xs text-muted-foreground border-t pt-6 mt-12">
          Próxima fase: pipeline de enriquecimento (Apify) + análise IA (Claude + Gemini).
        </div>
      </main>
    </div>
  );
}
