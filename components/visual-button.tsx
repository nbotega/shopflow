"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { Button } from "@/components/ui/button";
import { Loader2, Eye } from "lucide-react";

type Result = {
  success: boolean;
  handle?: string;
  analyzed?: number;
  cost_usd?: number;
  errors?: string[];
};

export function VisualButton({
  creatorId,
  enriched,
}: {
  creatorId: string;
  enriched: boolean;
}) {
  const [loading, setLoading] = useState(false);
  const [result, setResult] = useState<Result | null>(null);
  const router = useRouter();

  if (!enriched) {
    return (
      <Button size="sm" variant="ghost" disabled className="h-7 px-2">
        <Eye className="h-3 w-3 opacity-30" />
      </Button>
    );
  }

  async function run() {
    setLoading(true);
    setResult(null);
    try {
      const res = await fetch(`/api/analyze-visual/${creatorId}`, {
        method: "POST",
      });
      const data: Result = await res.json();
      setResult(data);
      router.refresh();
    } catch (err) {
      setResult({
        success: false,
        errors: [err instanceof Error ? err.message : "fetch failed"],
      });
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="flex flex-col items-end gap-0.5">
      <Button
        size="sm"
        variant="outline"
        onClick={run}
        disabled={loading}
        className="h-7 px-2"
        title="Análise visual Gemini (top 3 vídeos)"
      >
        {loading ? (
          <Loader2 className="h-3 w-3 animate-spin" />
        ) : (
          <Eye className="h-3 w-3" />
        )}
      </Button>
      {result && !loading && (
        <span
          className={`text-[10px] ${
            result.success ? "text-foreground" : "text-destructive"
          }`}
          title={result.errors?.join(" | ")}
        >
          {result.success
            ? `${result.analyzed} vid · $${result.cost_usd?.toFixed(3)}`
            : "falhou"}
        </span>
      )}
    </div>
  );
}
