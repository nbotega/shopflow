"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { Button } from "@/components/ui/button";
import { Loader2 } from "lucide-react";

const CONCURRENCY = 5;

type Progress = {
  total: number;
  done: number;
  succeeded: number;
  failed: number;
  current: string | null;
  errors: string[];
};

async function enrichOne(creatorId: string): Promise<{
  ok: boolean;
  handle?: string;
  error?: string;
}> {
  try {
    const res = await fetch(`/api/enrich/${creatorId}`, { method: "POST" });
    const data = await res.json();
    return {
      ok: !!data.success,
      handle: data.handle,
      error: data.error ?? undefined,
    };
  } catch (err) {
    return {
      ok: false,
      error: err instanceof Error ? err.message : "fetch failed",
    };
  }
}

export function BatchEnrichButton({
  pendingIds,
}: {
  pendingIds: string[];
}) {
  const [running, setRunning] = useState(false);
  const [progress, setProgress] = useState<Progress | null>(null);
  const router = useRouter();

  async function handleClick() {
    if (running || pendingIds.length === 0) return;
    setRunning(true);
    const total = pendingIds.length;
    const state: Progress = {
      total,
      done: 0,
      succeeded: 0,
      failed: 0,
      current: null,
      errors: [],
    };
    setProgress({ ...state });

    // Processa em chunks de CONCURRENCY
    for (let i = 0; i < pendingIds.length; i += CONCURRENCY) {
      const chunk = pendingIds.slice(i, i + CONCURRENCY);
      state.current = `lote ${Math.floor(i / CONCURRENCY) + 1} de ${Math.ceil(total / CONCURRENCY)}`;
      setProgress({ ...state });

      const results = await Promise.all(chunk.map((id) => enrichOne(id)));

      for (const r of results) {
        state.done += 1;
        if (r.ok) state.succeeded += 1;
        else {
          state.failed += 1;
          if (r.error)
            state.errors.push(
              `@${r.handle ?? "?"}: ${r.error.slice(0, 80)}`
            );
        }
      }
      setProgress({ ...state });
    }

    state.current = null;
    setProgress({ ...state });
    setRunning(false);
    router.refresh();
  }

  if (pendingIds.length === 0) {
    return (
      <Button size="sm" variant="outline" disabled>
        Nenhuma pendente
      </Button>
    );
  }

  return (
    <div className="flex flex-col items-end gap-2">
      <Button size="sm" onClick={handleClick} disabled={running}>
        {running ? (
          <>
            <Loader2 className="mr-2 h-3 w-3 animate-spin" />
            Processando {progress?.done ?? 0}/{progress?.total ?? pendingIds.length}
          </>
        ) : (
          `Enriquecer ${pendingIds.length} pendentes`
        )}
      </Button>
      {progress && (
        <div className="text-xs text-muted-foreground text-right space-y-0.5">
          <p>
            {progress.succeeded} ok · {progress.failed} falhas
            {progress.current && ` · ${progress.current}`}
          </p>
          {progress.errors.length > 0 && !running && (
            <details className="text-destructive">
              <summary className="cursor-pointer">
                Ver {progress.errors.length} erros
              </summary>
              <ul className="mt-1 max-h-32 overflow-auto text-left">
                {progress.errors.slice(0, 20).map((e, i) => (
                  <li key={i} className="text-[10px]">
                    {e}
                  </li>
                ))}
              </ul>
            </details>
          )}
        </div>
      )}
    </div>
  );
}
