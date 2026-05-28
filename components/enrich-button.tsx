"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { Button } from "@/components/ui/button";
import { Loader2 } from "lucide-react";

type EnrichResult = {
  success: boolean;
  handle?: string;
  videos_count?: number;
  error?: string | null;
};

export function EnrichButton({
  creatorId,
  handle,
  status,
}: {
  creatorId: string;
  handle: string;
  status: string;
}) {
  const [loading, setLoading] = useState(false);
  const [result, setResult] = useState<EnrichResult | null>(null);
  const router = useRouter();

  async function handleEnrich() {
    setLoading(true);
    setResult(null);
    try {
      const res = await fetch(`/api/enrich/${creatorId}`, { method: "POST" });
      const data: EnrichResult = await res.json();
      setResult(data);
      router.refresh();
    } catch (err) {
      setResult({
        success: false,
        error: err instanceof Error ? err.message : "Erro desconhecido",
      });
    } finally {
      setLoading(false);
    }
  }

  if (status === "enriched" && !result) {
    return (
      <Button
        size="sm"
        variant="ghost"
        onClick={handleEnrich}
        disabled={loading}
      >
        {loading ? <Loader2 className="h-3 w-3 animate-spin" /> : "Re-enriquecer"}
      </Button>
    );
  }

  return (
    <div className="flex flex-col items-end gap-1">
      <Button size="sm" onClick={handleEnrich} disabled={loading}>
        {loading ? (
          <>
            <Loader2 className="mr-1 h-3 w-3 animate-spin" />
            @{handle}
          </>
        ) : (
          "Enriquecer"
        )}
      </Button>
      {result && !loading && (
        <span
          className={`text-[10px] ${
            result.success ? "text-foreground" : "text-destructive"
          }`}
        >
          {result.success
            ? `${result.videos_count} vídeos`
            : (result.error ?? "falhou").slice(0, 30)}
        </span>
      )}
    </div>
  );
}
