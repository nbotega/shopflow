type Recommendation = "approve" | "monitor" | "borderline" | "reject" | string;

const STYLES: Record<
  string,
  { bg: string; text: string; ring: string; label: string }
> = {
  approve: {
    bg: "bg-foreground",
    text: "text-background",
    ring: "ring-foreground/20",
    label: "ON BRAND",
  },
  monitor: {
    bg: "bg-accent",
    text: "text-foreground",
    ring: "ring-accent",
    label: "WATCH",
  },
  borderline: {
    bg: "bg-muted",
    text: "text-muted-foreground",
    ring: "ring-border",
    label: "REVIEW",
  },
  reject: {
    bg: "bg-muted/50",
    text: "text-muted-foreground/60",
    ring: "ring-border/40",
    label: "OFF BRAND",
  },
};

export function ScoreBadge({
  score,
  recommendation,
  size = "md",
}: {
  score: number;
  recommendation: Recommendation;
  size?: "sm" | "md" | "lg";
}) {
  const style = STYLES[recommendation] ?? STYLES.reject;
  if (size === "lg") {
    return (
      <div className="inline-flex flex-col items-center gap-1">
        <div
          className={`w-20 h-20 rounded-full flex items-center justify-center font-display text-3xl font-semibold ring-1 ${style.bg} ${style.text} ${style.ring}`}
        >
          {score}
        </div>
        <span className="text-[10px] uppercase tracking-[0.18em] text-muted-foreground">
          {style.label}
        </span>
      </div>
    );
  }
  if (size === "sm") {
    return (
      <span
        className={`inline-flex items-center gap-1.5 px-2 py-0.5 text-[10px] rounded-full font-medium tracking-wide ${style.bg} ${style.text}`}
      >
        <span>{style.label}</span>
        <span className="tabular-nums">{score}</span>
      </span>
    );
  }
  return (
    <div className="inline-flex items-center gap-2.5">
      <span
        className={`inline-flex items-center justify-center w-11 h-11 rounded-full font-display text-lg font-semibold ${style.bg} ${style.text}`}
      >
        {score}
      </span>
      <span className="text-[10px] uppercase tracking-[0.18em] text-muted-foreground">
        {style.label}
      </span>
    </div>
  );
}

export function HumanLabelBadge({ label }: { label: string | null }) {
  if (label === "sim")
    return (
      <span className="inline-flex items-center gap-1 px-2 py-0.5 text-[9px] rounded-full bg-foreground text-background uppercase tracking-wider font-medium">
        Curated
      </span>
    );
  if (label === "maybe")
    return (
      <span className="inline-flex items-center gap-1 px-2 py-0.5 text-[9px] rounded-full border border-foreground/30 uppercase tracking-wider">
        Pending review
      </span>
    );
  if (label === "nao") return null;
  return null;
}
