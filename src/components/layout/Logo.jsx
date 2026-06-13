import Image from "next/image";
import Link from "next/link";
import { cn } from "@/lib/cn";

export default function Logo({ href = "/", showWordmark = true, size = 32, className }) {
  return (
    <Link
      href={href}
      className={cn(
        "group inline-flex items-center gap-2.5 text-foreground",
        className,
      )}
    >
      <span
        className="relative inline-flex shrink-0 items-center justify-center overflow-hidden rounded-lg"
        style={{ width: size, height: size }}
      >
        <Image
          src="/logo.png"
          alt="Nanozen logo"
          width={size}
          height={size}
          priority
          className="h-full w-full object-contain"
        />
      </span>
      {showWordmark && (
        <span className="text-[15px] font-semibold tracking-tight">Nanozen</span>
      )}
    </Link>
  );
}
