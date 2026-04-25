import { cn } from "@/lib/cn";

function initialsOf(name = "") {
  return name
    .split(" ")
    .map((p) => p[0])
    .filter(Boolean)
    .slice(0, 2)
    .join("")
    .toUpperCase();
}

export default function Avatar({
  name = "",
  src,
  size = 32,
  className,
  status,
}) {
  const initials = initialsOf(name) || "·";
  return (
    <span
      className={cn(
        "relative inline-flex shrink-0 items-center justify-center overflow-hidden rounded-full border border-border bg-surface-2 text-[11px] font-semibold text-foreground",
        className,
      )}
      style={{ width: size, height: size }}
    >
      {src ? (
        // eslint-disable-next-line @next/next/no-img-element
        <img src={src} alt={name} className="h-full w-full object-cover" />
      ) : (
        <span aria-hidden>{initials}</span>
      )}
      {status && (
        <span
          className={cn(
            "absolute -bottom-0.5 -right-0.5 inline-block h-2.5 w-2.5 rounded-full ring-2 ring-background",
            status === "online" && "bg-emerald-400",
            status === "away" && "bg-amber-400",
            status === "offline" && "bg-zinc-500",
          )}
        />
      )}
    </span>
  );
}
