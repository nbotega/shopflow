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
    <div className="min-h-screen flex items-center justify-center bg-background px-4">
      <div className="w-full max-w-sm space-y-8">
        <div className="text-center">
          <h1 className="text-4xl font-bold tracking-tight">SHOPFLOW</h1>
          <p className="mt-2 text-sm text-muted-foreground">
            Curadoria de afiliadas TikTok Shop
          </p>
        </div>

        <form className="space-y-4" action={login}>
          <div className="space-y-2">
            <Label htmlFor="email">Email</Label>
            <Input
              id="email"
              name="email"
              type="email"
              placeholder="seu@email.com"
              required
              autoComplete="email"
            />
          </div>
          <div className="space-y-2">
            <Label htmlFor="password">Senha</Label>
            <Input
              id="password"
              name="password"
              type="password"
              required
              autoComplete="current-password"
            />
          </div>
          <Button type="submit" className="w-full">
            Entrar
          </Button>
        </form>

        <LoginMessage searchParams={searchParams} />
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
      <p className="text-sm text-destructive text-center">{params.error}</p>
    );
  }
  if (params.message) {
    return (
      <p className="text-sm text-muted-foreground text-center">
        {params.message}
      </p>
    );
  }
  return null;
}
