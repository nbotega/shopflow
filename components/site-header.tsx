import Link from "next/link";
import { logout } from "@/app/login/actions";
import { createClient } from "@/lib/supabase/server";

export async function SiteHeader({
  active,
}: {
  active?: "overview" | "ranking" | "afiliadas" | "admin";
}) {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  const nav: Array<{ key: typeof active; href: string; label: string }> = [
    { key: "overview", href: "/dashboard", label: "Visão geral" },
    { key: "ranking", href: "/dashboard/scores", label: "Curadoria" },
    { key: "afiliadas", href: "/dashboard/creators", label: "Afiliadas" },
  ];

  return (
    <header className="border-b border-border/60 bg-background/80 backdrop-blur sticky top-0 z-30">
      <div className="max-w-6xl mx-auto px-6 py-5 flex items-center justify-between">
        <div className="flex items-center gap-10">
          <Link href="/dashboard" className="flex items-baseline gap-1">
            <span className="font-display text-2xl font-semibold tracking-tighter">
              SHOPFLOW
            </span>
            <span className="text-[10px] uppercase tracking-[0.25em] text-muted-foreground hidden sm:inline">
              Curadoria
            </span>
          </Link>
          <nav className="hidden md:flex items-center gap-7 text-sm">
            {nav.map((n) => (
              <Link
                key={n.href}
                href={n.href}
                className={`pb-0.5 border-b transition-colors ${
                  active === n.key
                    ? "border-foreground text-foreground"
                    : "border-transparent text-muted-foreground hover:text-foreground"
                }`}
              >
                {n.label}
              </Link>
            ))}
          </nav>
        </div>
        <div className="flex items-center gap-4 text-xs">
          <span className="text-muted-foreground hidden sm:inline">
            {user?.email}
          </span>
          <form action={logout}>
            <button
              type="submit"
              className="text-muted-foreground hover:text-foreground transition-colors uppercase tracking-wider"
            >
              Sair
            </button>
          </form>
        </div>
      </div>
    </header>
  );
}
