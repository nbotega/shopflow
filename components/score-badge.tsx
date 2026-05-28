type Recommendation = "approve" | "monitor" | "borderline" | "reject" | string;

const STYLES: Record<string, { bg: string; text: string; label: string }> = {
  approve: { bg: "bg-foreground", text: "text-background", label: "APROVAR" },
  monitor: {
    bg: "bg-foreground/20 border border-foreground",
    text: "text-foreground",
    label: "MONITORAR",
  },
  borderline: {
    bg: "bg-muted border border-muted-foreground/40",
    text: "text-muted-foreground",
    label: "BORDERLINE",
  },
  reject: {
    bg: "bg-muted",
    text: "text-muted-foreground line-through",
    label: "REJEITAR",
  },
};

export function ScoreBadge({
  score,
  recommendation,
}: {
  score: number;
  recommendation: Recommendation;
}) {
  const style = STYLES[recommendation] ?? STYLES.reject;
  return (
    <div className="inline-flex items-center gap-2">
      <span
        className={`inline-block px-2 py-0.5 text-[10px] font-bold tracking-wide rounded ${style.bg} ${style.text}`}
      >
        {style.label}
      </span>
      <span className="tabular-nums font-mono text-sm">{score}</span>
    </div>
  );
}

export function HumanLabelBadge({ label }: { label: string | null }) {
  if (label === "sim")
    return (
      <span className="inline-block px-1.5 py-0.5 text-[10px] rounded bg-foreground text-background font-medium">
        SIM
      </span>
    );
  if (label === "maybe")
    return (
      <span className="inline-block px-1.5 py-0.5 text-[10px] rounded border border-foreground/30">
        maybe
      </span>
    );
  if (label === "nao")
    return (
      <span className="inline-block px-1.5 py-0.5 text-[10px] rounded bg-muted text-muted-foreground">
        não
      </span>
    );
  return <span className="text-muted-foreground text-[10px]">—</span>;
}
