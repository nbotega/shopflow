"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { Button } from "@/components/ui/button";
import { Loader2 } from "lucide-react";

type DiscoverResult = {
  success: boolean;
  brand?: string;
  creators_found?: number;
  new_creators_added?: number;
  new_assignments?: number;
  credits_used?: number;
  errors?: string[];
  error?: string;
};

export function DiscoverButton({
  brandId,
  brandName,
}: {
  brandId: string;
  brandName: string;
}) {
  const [loading, setLoading] = useState(false);
  const [result, setResult] = useState<DiscoverResult | null>(null);
  const router = useRouter();

  async function handleDiscover() {
    setLoading(true);
    setResult(null);
    try {
      const res = await fetch("/api/discover", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ brandId }),
      });
      const data: DiscoverResult = await res.json();
      setResult(data);
      if (data.success) {
        router.refresh();
      }
    } catch (err) {
      setResult({
        success: false,
        error: err instanceof Error ? err.message : "Erro desconhecido",
      });
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="space-y-2">
      <Button
        onClick={handleDiscover}
        disabled={loading}
        size="sm"
        className="w-full"
      >
        {loading ? (
          <>
            <Loader2 className="mr-2 h-4 w-4 animate-spin" />
            Buscando {brandName}...
          </>
        ) : (
          `Descobrir creators ${brandName}`
        )}
      </Button>

      {result && (
        <div className="text-xs space-y-1 pt-2 border-t">
          {result.success ? (
            <>
              <p className="text-foreground font-medium">
                {result.creators_found} creators encontrados
              </p>
              <p className="text-muted-foreground">
                {result.new_creators_added} novos · {result.credits_used}{" "}
                créditos SociaVault
              </p>
              {result.errors && result.errors.length > 0 && (
                <p className="text-destructive">
                  Atenção: {result.errors.length} query falhou
                </p>
              )}
            </>
          ) : (
            <p className="text-destructive">
              {result.error ?? "Falha na busca"}
            </p>
          )}
        </div>
      )}
    </div>
  );
}
