"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { Button } from "@/components/ui/button";
import { Loader2 } from "lucide-react";

const CONCURRENCY = 8;

type Progress = {
  total: number;
  done: number;
  succeeded: number;
  with_brands: number;
  with_phone: number;
  with_email: number;
};

async function processOne(creatorId: string) {
  try {
    const res = await fetch(`/api/extract-brands/${creatorId}`, {
      method: "POST",
    });
    const data = await res.json();
    return {
      ok: !!data.success,
      brands: data.brands_count ?? 0,
      hasPhone: Boolean(data.contact?.phone),
      hasEmail: Boolean(data.contact?.email),
    };
  } catch {
    return { ok: false, brands: 0, hasPhone: false, hasEmail: false };
  }
}

export function BatchExtractBrandsButton({
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
      with_brands: 0,
      with_phone: 0,
      with_email: 0,
    };
    setProgress({ ...state });

    for (let i = 0; i < creatorIds.length; i += CONCURRENCY) {
      const chunk = creatorIds.slice(i, i + CONCURRENCY);
      const results = await Promise.all(chunk.map((id) => processOne(id)));
      for (const r of results) {
        state.done++;
        if (r.ok) {
          state.succeeded++;
          if (r.brands > 0) state.with_brands++;
          if (r.hasPhone) state.with_phone++;
          if (r.hasEmail) state.with_email++;
        }
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
            Extraindo {progress?.done ?? 0}/{progress?.total ?? creatorIds.length}
          </>
        ) : (
          `Extrair marcas/contato (${creatorIds.length})`
        )}
      </Button>
      {progress && (
        <div className="text-xs text-muted-foreground text-right">
          {progress.with_brands} com marcas · {progress.with_phone} com WhatsApp ·{" "}
          {progress.with_email} com email
        </div>
      )}
    </div>
  );
}
