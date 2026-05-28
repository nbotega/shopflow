"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { Button } from "@/components/ui/button";
import { Loader2 } from "lucide-react";

const CONCURRENCY = 3; // creators em paralelo (cada um faz até 4 transcripts paralelos = 12 chamadas SociaVault simultâneas)

type Progress = {
  total: number;
  done: number;
  succeeded: number;
  failed: number;
  transcripts: number;
  cost: number;
  errors: string[];
};

async function transcribeOne(creatorId: string): Promise<{
  ok: boolean;
  handle?: string;
  succeeded?: number;
  cost?: number;
  error?: string;
}> {
  try {
    const res = await fetch(`/api/transcribe/${creatorId}`, { method: "POST" });
    const data = await res.json();
    return {
      ok: !!data.success,
      handle: data.handle,
      succeeded: data.succeeded ?? 0,
      cost: data.cost_usd ?? 0,
      error: data.error ?? data.errors?.[0],
    };
  } catch (err) {
    return {
      ok: false,
      error: err instanceof Error ? err.message : "fetch failed",
    };
  }
}

export function BatchTranscribeButton({
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
    const total = creatorIds.length;
    const state: Progress = {
      total,
      done: 0,
      succeeded: 0,
      failed: 0,
      transcripts: 0,
      cost: 0,
      errors: [],
    };
    setProgress({ ...state });

    for (let i = 0; i < creatorIds.length; i += CONCURRENCY) {
      const chunk = creatorIds.slice(i, i + CONCURRENCY);
      const results = await Promise.all(chunk.map((id) => transcribeOne(id)));

      for (const r of results) {
        state.done += 1;
        if (r.ok) {
          state.succeeded += 1;
          state.transcripts += r.succeeded ?? 0;
          state.cost += r.cost ?? 0;
        } else {
          state.failed += 1;
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
        Nada pra transcrever
      </Button>
    );
  }

  return (
    <div className="flex flex-col items-end gap-2">
      <Button size="sm" onClick={handleClick} disabled={running}>
        {running ? (
          <>
            <Loader2 className="mr-2 h-3 w-3 animate-spin" />
            Transcrevendo {progress?.done ?? 0}/{progress?.total ?? creatorIds.length}
          </>
        ) : (
          `Transcrever ${creatorIds.length} afiliadas`
        )}
      </Button>
      {progress && (
        <div className="text-xs text-muted-foreground text-right space-y-0.5">
          <p>
            {progress.succeeded} ok · {progress.failed} falhas ·{" "}
            {progress.transcripts} transcripts · ${progress.cost.toFixed(2)}
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
