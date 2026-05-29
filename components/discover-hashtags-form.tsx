"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { Button } from "@/components/ui/button";
import { Loader2 } from "lucide-react";

const SUGGESTED_HASHTAGS = [
  "tiktokshopbrasil",
  "shopcreator",
  "tiktokshopbr",
  "maquiagemtiktok",
  "beautybrasil",
  "tiktokshopbeauty",
  "shoppingtiktok",
  "achadinhostiktokshop",
];

type Result = {
  success: boolean;
  hashtags?: string[];
  videos_scraped?: number;
  unique_authors?: number;
  already_in_pool?: number;
  new_creators?: number;
  error?: string;
};

export function DiscoverHashtagsForm() {
  const [selected, setSelected] = useState<Set<string>>(
    new Set(SUGGESTED_HASHTAGS.slice(0, 4))
  );
  const [custom, setCustom] = useState("");
  const [perPage, setPerPage] = useState(80);
  const [running, setRunning] = useState(false);
  const [result, setResult] = useState<Result | null>(null);
  const router = useRouter();

  function toggle(h: string) {
    const next = new Set(selected);
    if (next.has(h)) next.delete(h);
    else next.add(h);
    setSelected(next);
  }

  async function handleRun() {
    setRunning(true);
    setResult(null);
    const customList = custom
      .split(/[,\s]+/)
      .map((s) => s.replace(/^#/, "").trim())
      .filter(Boolean);
    const hashtags = [...Array.from(selected), ...customList];
    if (hashtags.length === 0) {
      setRunning(false);
      setResult({ success: false, error: "Selecione pelo menos 1 hashtag" });
      return;
    }

    try {
      const res = await fetch("/api/discover/by-hashtag", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ hashtags, resultsPerPage: perPage }),
      });
      const data: Result = await res.json();
      setResult(data);
      if (data.success) router.refresh();
    } catch (err) {
      setResult({
        success: false,
        error: err instanceof Error ? err.message : "fetch failed",
      });
    } finally {
      setRunning(false);
    }
  }

  return (
    <div className="space-y-4">
      <div className="space-y-2">
        <div className="text-xs uppercase tracking-wider text-muted-foreground">
          Hashtags sugeridas
        </div>
        <div className="flex flex-wrap gap-2">
          {SUGGESTED_HASHTAGS.map((h) => {
            const active = selected.has(h);
            return (
              <button
                key={h}
                type="button"
                onClick={() => toggle(h)}
                className={`px-3 py-1 text-xs rounded-full border transition-colors ${
                  active
                    ? "bg-gold text-background border-gold"
                    : "border-border text-muted-foreground hover:border-gold hover:text-foreground"
                }`}
              >
                #{h}
              </button>
            );
          })}
        </div>
      </div>

      <div>
        <label className="text-xs uppercase tracking-wider text-muted-foreground block mb-2">
          Hashtags adicionais (separadas por vírgula ou espaço)
        </label>
        <input
          type="text"
          value={custom}
          onChange={(e) => setCustom(e.target.value)}
          placeholder="ex: makeluxo, perfumetiktok, skincarebr"
          className="w-full px-3 py-2 bg-secondary border border-input text-sm font-mono focus:outline-none focus:border-gold"
        />
      </div>

      <div className="flex items-center gap-3">
        <label className="text-xs uppercase tracking-wider text-muted-foreground">
          Vídeos por hashtag
        </label>
        <select
          value={perPage}
          onChange={(e) => setPerPage(Number(e.target.value))}
          className="px-2 py-1 bg-secondary border border-input text-xs"
        >
          <option value={40}>40 (~US$ 0,05)</option>
          <option value={80}>80 (~US$ 0,10)</option>
          <option value={150}>150 (~US$ 0,20)</option>
          <option value={200}>200 (~US$ 0,30)</option>
        </select>
      </div>

      <Button onClick={handleRun} disabled={running} className="rounded-full">
        {running ? (
          <>
            <Loader2 className="mr-2 h-3 w-3 animate-spin" />
            Descobrindo afiliadas...
          </>
        ) : (
          `Descobrir afiliadas (${selected.size} hashtag${selected.size === 1 ? "" : "s"})`
        )}
      </Button>

      {result && (
        <div
          className={`text-sm p-3 border ${
            result.success
              ? "border-gold/40 bg-gold/5"
              : "border-destructive/40 bg-destructive/5"
          }`}
        >
          {result.success ? (
            <div className="space-y-1">
              <p className="font-medium">
                {result.new_creators} novas afiliadas adicionadas
              </p>
              <p className="text-xs text-muted-foreground">
                {result.videos_scraped} vídeos varridos · {result.unique_authors}{" "}
                creators únicos · {result.already_in_pool} já no pool
              </p>
              <p className="text-xs text-muted-foreground italic">
                Vá em Coleta de perfis pra enriquecer as novas com bio,
                followers e vídeos.
              </p>
            </div>
          ) : (
            <p className="text-destructive text-xs">{result.error}</p>
          )}
        </div>
      )}
    </div>
  );
}
