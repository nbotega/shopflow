import { login } from "./actions";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";

export default function LoginPage({
  searchParams,
}: {
  searchParams: Promise<{ error?: string; message?: string }>;
}) {
  return (
    <div className="min-h-screen grid lg:grid-cols-2">
      {/* Hero editorial */}
      <div className="hidden lg:flex flex-col justify-between p-12 bg-foreground text-background">
        <div>
          <div className="font-display text-3xl tracking-tighter">
            SHOPFLOW
          </div>
          <div className="text-[10px] uppercase tracking-[0.3em] mt-1 opacity-60">
            Affiliate Curation Atelier
          </div>
        </div>
        <div className="space-y-4">
          <h1 className="font-display text-5xl leading-[1.05] tracking-tight">
            The curation your luxury brand deserves.
          </h1>
          <p className="text-sm opacity-70 max-w-md leading-relaxed">
            Editorial platform to discover, evaluate and activate TikTok Shop
            affiliates aligned with every premium brand&apos;s persona.
          </p>
        </div>
        <div className="text-[10px] uppercase tracking-[0.3em] opacity-40">
          Confidential · Snack Content
        </div>
      </div>

      {/* Login form */}
      <div className="flex items-center justify-center p-8 lg:p-16 bg-background">
        <div className="w-full max-w-sm space-y-10">
          <div className="lg:hidden text-center">
            <div className="font-display text-3xl tracking-tighter">
              SHOPFLOW
            </div>
            <div className="text-[10px] uppercase tracking-[0.3em] mt-1 text-muted-foreground">
              Atelier
            </div>
          </div>

          <div>
            <h2 className="font-display text-3xl">Sign in</h2>
            <p className="text-sm text-muted-foreground mt-2">
              Access with the credentials provided by your team.
            </p>
          </div>

          <form className="space-y-5" action={login}>
            <div className="space-y-2">
              <Label htmlFor="email" className="text-xs uppercase tracking-wider">
                Email
              </Label>
              <Input
                id="email"
                name="email"
                type="email"
                required
                autoComplete="email"
                className="h-11 rounded-none border-x-0 border-t-0 border-b focus-visible:ring-0 focus-visible:border-foreground px-0"
              />
            </div>
            <div className="space-y-2">
              <Label
                htmlFor="password"
                className="text-xs uppercase tracking-wider"
              >
                Password
              </Label>
              <Input
                id="password"
                name="password"
                type="password"
                required
                autoComplete="current-password"
                className="h-11 rounded-none border-x-0 border-t-0 border-b focus-visible:ring-0 focus-visible:border-foreground px-0"
              />
            </div>
            <Button
              type="submit"
              className="w-full h-11 rounded-none uppercase tracking-[0.15em] text-xs"
            >
              Enter the atelier
            </Button>
          </form>

          <LoginMessage searchParams={searchParams} />
        </div>
      </div>
    </div>
  );
}

async function LoginMessage({
  searchParams,
}: {
  searchParams: Promise<{ error?: string; message?: string }>;
}) {
  const params = await searchParams;
  if (params.error) {
    return (
      <p className="text-xs text-destructive text-center">{params.error}</p>
    );
  }
  if (params.message) {
    return (
      <p className="text-xs text-muted-foreground text-center">
        {params.message}
      </p>
    );
  }
  return null;
}
