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
  with_avatar: number;
  errors: string[];
};

async function refreshOne(creatorId: string) {
  try {
    const res = await fetch(`/api/refresh-profile/${creatorId}`, {
      method: "POST",
    });
    const data = await res.json();
    return {
      ok: !!data.success,
      hasAvatar: Boolean(data.avatar),
      handle: data.handle,
      error: data.error,
    };
  } catch (err) {
    return {
      ok: false,
      hasAvatar: false,
      error: err instanceof Error ? err.message : "fetch failed",
    };
  }
}

export function BatchRefreshButton({
  creatorIds,
}: {
  creatorIds: string[];
}) {
  const [running, setRunning] = useState(false);
  const [progress, setProgress] = useState<Progress | null>(null);
  const router = useRouter();

  async function handleClick() {
    if (running || creatorIds.length === 0) return;
    setRunning(true);
    const state: Progress = {
      total: creatorIds.length,
      done: 0,
      succeeded: 0,
      failed: 0,
      with_avatar: 0,
      errors: [],
    };
    setProgress({ ...state });

    for (let i = 0; i < creatorIds.length; i += CONCURRENCY) {
      const chunk = creatorIds.slice(i, i + CONCURRENCY);
      const results = await Promise.all(chunk.map((id) => refreshOne(id)));
      for (const r of results) {
        state.done++;
        if (r.ok) {
          state.succeeded++;
          if (r.hasAvatar) state.with_avatar++;
        } else {
          state.failed++;
          if (r.error)
            state.errors.push(`@${r.handle ?? "?"}: ${r.error.slice(0, 80)}`);
        }
      }
      setProgress({ ...state });
    }
    setRunning(false);
    router.refresh();
  }

  if (creatorIds.length === 0) {
    return (
      <Button size="sm" variant="outline" disabled>
        Nada pra atualizar
      </Button>
    );
  }

  return (
    <div className="flex flex-col items-end gap-2">
      <Button size="sm" onClick={handleClick} disabled={running}>
        {running ? (
          <>
            <Loader2 className="mr-2 h-3 w-3 animate-spin" />
            Atualizando {progress?.done ?? 0}/{progress?.total ?? creatorIds.length}
          </>
        ) : (
          `Atualizar ${creatorIds.length} perfis`
        )}
      </Button>
      {progress && (
        <div className="text-xs text-muted-foreground text-right space-y-0.5">
          <p>
            {progress.succeeded} ok · {progress.with_avatar} com foto ·{" "}
            {progress.failed} falhas
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
