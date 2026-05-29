"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { Loader2, FileText, Eye, Sparkles } from "lucide-react";

type ActionKey = "transcribe" | "visual" | "judge";

const ACTIONS: Array<{
  key: ActionKey;
  label: string;
  endpoint: (id: string) => string;
  Icon: typeof FileText;
}> = [
  {
    key: "transcribe",
    label: "Transcribe",
    endpoint: (id) => `/api/transcribe/${id}`,
    Icon: FileText,
  },
  {
    key: "visual",
    label: "Visual analysis",
    endpoint: (id) => `/api/analyze-visual/${id}`,
    Icon: Eye,
  },
  {
    key: "judge",
    label: "Run curation",
    endpoint: (id) => `/api/judge/by-creator/${id}`,
    Icon: Sparkles,
  },
];

export function AdminQuickActions({ creatorId }: { creatorId: string }) {
  const [running, setRunning] = useState<ActionKey | null>(null);
  const [result, setResult] = useState<{
    action: ActionKey;
    ok: boolean;
    msg: string;
  } | null>(null);
  const router = useRouter();

  async function run(action: typeof ACTIONS[number]) {
    if (running) return;
    setRunning(action.key);
    setResult(null);
    try {
      const res = await fetch(action.endpoint(creatorId), { method: "POST" });
      const data = await res.json();
      const ok = !!data.success;
      let msg = "";
      if (action.key === "transcribe") {
        msg = ok
          ? `${data.succeeded ?? 0} transcribed`
          : data.error ?? data.errors?.[0] ?? "failed";
      } else if (action.key === "visual") {
        msg = ok
          ? `${data.analyzed ?? 0} videos analyzed`
          : data.errors?.[0] ?? data.error ?? "failed";
      } else if (action.key === "judge") {
        msg = ok
          ? `${data.succeeded ?? 0}/${data.total ?? 0} scored`
          : data.error ?? "failed";
      }
      setResult({ action: action.key, ok, msg });
      if (ok) router.refresh();
    } catch (err) {
      setResult({
        action: action.key,
        ok: false,
        msg: err instanceof Error ? err.message : "fetch failed",
      });
    } finally {
      setRunning(null);
    }
  }

  return (
    <div className="card-glass p-5 space-y-3">
      <div className="flex items-center justify-between">
        <div className="text-[10px] uppercase tracking-[0.3em] text-gold/80">
          Admin · refresh data
        </div>
      </div>
      <div className="flex flex-wrap gap-2">
        {ACTIONS.map((a) => {
          const Icon = a.Icon;
          const isRunning = running === a.key;
          const myResult = result?.action === a.key ? result : null;
          return (
            <div key={a.key} className="flex flex-col items-start gap-1">
              <button
                type="button"
                onClick={() => run(a)}
                disabled={!!running}
                className="inline-flex items-center gap-2 px-3 py-1.5 text-xs border border-border hover:border-gold rounded-full transition-colors disabled:opacity-50"
              >
                {isRunning ? (
                  <Loader2 className="h-3 w-3 animate-spin" />
                ) : (
                  <Icon className="h-3 w-3" />
                )}
                {a.label}
              </button>
              {myResult && (
                <span
                  className={`text-[10px] ${
                    myResult.ok ? "text-gold" : "text-destructive"
                  } max-w-[180px]`}
                >
                  {myResult.msg.slice(0, 80)}
                </span>
              )}
            </div>
          );
        })}
      </div>
      <p className="text-[10px] text-muted-foreground">
        Each action runs only on this affiliate. Total cost &lt; US$ 0.10.
      </p>
    </div>
  );
}
