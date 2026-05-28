import { createClient } from "@/lib/supabase/server";
import { logout } from "@/app/login/actions";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";

export default async function DashboardPage() {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  // Lista brands disponíveis pro usuário
  const { data: brands } = await supabase
    .from("brands")
    .select("id, name, slug, score_threshold_approve, score_threshold_monitor, clients(name)")
    .eq("active", true)
    .order("name");

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
          <h2 className="text-3xl font-bold tracking-tight">Marcas</h2>
          <p className="text-muted-foreground mt-1">
            Selecione uma marca pra ver as afiliadas analisadas.
          </p>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
          {brands?.map((brand) => (
            <Card key={brand.id} className="hover:border-foreground transition-colors">
              <CardHeader>
                <CardTitle>{brand.name}</CardTitle>
                <CardDescription>
                  {/* @ts-expect-error supabase nested select */}
                  {brand.clients?.name}
                </CardDescription>
              </CardHeader>
              <CardContent>
                <div className="text-sm text-muted-foreground space-y-1">
                  <p>
                    Aprovação automática:{" "}
                    <span className="text-foreground font-medium">
                      ≥ {brand.score_threshold_approve}
                    </span>
                  </p>
                  <p>
                    Monitoramento:{" "}
                    <span className="text-foreground font-medium">
                      ≥ {brand.score_threshold_monitor}
                    </span>
                  </p>
                </div>
              </CardContent>
            </Card>
          ))}
          {(!brands || brands.length === 0) && (
            <p className="text-muted-foreground col-span-full text-center py-12">
              Nenhuma marca cadastrada.
            </p>
          )}
        </div>

        <div className="text-xs text-muted-foreground border-t pt-6 mt-12">
          Versão MVP em construção. Pipeline de descoberta, enriquecimento e análise IA chegam nas próximas tasks do roadmap.
        </div>
      </main>
    </div>
  );
}
