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
    { key: "overview", href: "/dashboard", label: "Overview" },
    { key: "ranking", href: "/dashboard/scores", label: "Curation" },
    { key: "afiliadas", href: "/dashboard/creators", label: "Affiliates" },
  ];

  return (
    <header className="border-b border-border/60 bg-background/80 backdrop-blur-xl sticky top-0 z-30">
      <div className="max-w-7xl mx-auto px-6 py-5 flex items-center justify-between">
        <div className="flex items-center gap-12">
          <Link href="/dashboard" className="flex items-baseline gap-2">
            <span className="font-display text-2xl font-semibold tracking-tighter">
              SHOPFLOW
            </span>
            <span className="text-[9px] uppercase tracking-[0.35em] text-gold/70 hidden sm:inline">
              Atelier
            </span>
          </Link>
          <nav className="hidden md:flex items-center gap-8 text-sm">
            {nav.map((n) => (
              <Link
                key={n.href}
                href={n.href}
                className={`relative pb-1 transition-colors ${
                  active === n.key
                    ? "text-foreground"
                    : "text-muted-foreground hover:text-foreground"
                }`}
              >
                {n.label}
                {active === n.key && (
                  <span className="absolute -bottom-px left-0 right-0 h-px bg-gradient-to-r from-transparent via-gold to-transparent" />
                )}
              </Link>
            ))}
          </nav>
        </div>
        <div className="flex items-center gap-5 text-xs">
          <span className="text-muted-foreground hidden sm:inline font-mono">
            {user?.email}
          </span>
          <form action={logout}>
            <button
              type="submit"
              className="text-muted-foreground hover:text-foreground transition-colors uppercase tracking-[0.2em]"
            >
              Sign out
            </button>
          </form>
        </div>
      </div>
    </header>
  );
}
