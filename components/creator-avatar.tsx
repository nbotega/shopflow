import { proxyImageUrl } from "@/lib/img-proxy";

type Size = "sm" | "md" | "lg" | "xl";

const SIZES: Record<Size, string> = {
  sm: "w-8 h-8 text-[10px]",
  md: "w-12 h-12 text-sm",
  lg: "w-20 h-20 text-lg",
  xl: "w-28 h-28 text-2xl",
};

function initials(handle: string, displayName: string | null): string {
  const source = displayName || handle;
  return source
    .split(/[\s._-]+/)
    .filter(Boolean)
    .slice(0, 2)
    .map((s) => s[0]?.toUpperCase() ?? "")
    .join("");
}

export function CreatorAvatar({
  avatarUrl,
  handle,
  displayName,
  size = "md",
}: {
  avatarUrl: string | null;
  handle: string;
  displayName: string | null;
  size?: Size;
}) {
  const sizeCls = SIZES[size];
  const proxied = proxyImageUrl(avatarUrl);
  if (proxied) {
    return (
      // eslint-disable-next-line @next/next/no-img-element
      <img
        src={proxied}
        alt={handle}
        className={`${sizeCls} rounded-full object-cover border border-border/60`}
        loading="lazy"
      />
    );
  }
  return (
    <div
      className={`${sizeCls} rounded-full flex items-center justify-center bg-accent text-accent-foreground font-display font-semibold border border-border/60`}
      aria-label={handle}
    >
      {initials(handle, displayName)}
    </div>
  );
}
