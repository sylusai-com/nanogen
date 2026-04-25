import { cn } from "@/lib/cn";

export default function Container({ as: As = "div", className, children, size = "default" }) {
  const max =
    size === "sm" ? "max-w-3xl" : size === "lg" ? "max-w-7xl" : "max-w-6xl";
  return (
    <As className={cn("mx-auto w-full px-5 md:px-8", max, className)}>
      {children}
    </As>
  );
}
