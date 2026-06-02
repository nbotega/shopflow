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
  skipped: number;
};

async function cacheOne(creatorId: string) {
  try {
    const res = await fetch(`/api/cache-avatar/${creatorId}`, {
      method: "POST",
    });
    const data = await res.json();
    return {
      ok: !!data.success,
      skipped: data.skipped === "already_cached",
    };
  } catch {
    return { ok: false, skipped: false };
  }
}

export function BatchCacheAvatarsButton({
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
      skipped: 0,
    };
    setProgress({ ...state });

    for (let i = 0; i < creatorIds.length; i += CONCURRENCY) {
      const chunk = creatorIds.slice(i, i + CONCURRENCY);
      const results = await Promise.all(chunk.map((id) => cacheOne(id)));
      for (const r of results) {
        state.done++;
        if (r.ok) {
          if (r.skipped) state.skipped++;
          else state.succeeded++;
        } else state.failed++;
      }
      setProgress({ ...state });
    }
    setRunning(false);
    router.refresh();
  }

  return (
    <div className="flex flex-col items-end gap-2">
      <Button size="sm" onClick={handleClick} disabled={running || creatorIds.length === 0}>
        {running ? (
          <>
            <Loader2 className="mr-2 h-3 w-3 animate-spin" />
            Cacheando {progress?.done ?? 0}/{progress?.total ?? creatorIds.length}
          </>
        ) : (
          `Cachear ${creatorIds.length} avatares`
        )}
      </Button>
      {progress && (
        <div className="text-xs text-muted-foreground text-right">
          {progress.succeeded} salvos · {progress.skipped} já tinham · {progress.failed} falhas
        </div>
      )}
    </div>
  );
}
