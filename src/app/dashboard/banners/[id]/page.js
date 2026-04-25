"use client";

import { use, useEffect, useState } from "react";
import Link from "next/link";
import { ArrowLeft, Download, Edit3, Share2, Star, Trash2 } from "lucide-react";
import TopBar from "@/components/dashboard/TopBar";
import Card from "@/components/ui/Card";
import Badge from "@/components/ui/Badge";
import Button from "@/components/ui/Button";
import { getBanner } from "@/lib/mockData";
import { cn } from "@/lib/cn";

function aspectClass(a) {
  if (a === "1:1") return "aspect-square";
  if (a === "4:5") return "aspect-[4/5]";
  if (a === "9:16") return "aspect-[9/16]";
  return "aspect-[16/9]";
}

export default function BannerDetail({ params }) {
  const { id } = use(params);
  const [banner, setBanner] = useState(null);

  useEffect(() => {
    setBanner(getBanner(id));
  }, [id]);

  if (!banner) {
    return (
      <>
        <TopBar />
        <div className="px-5 py-10 text-sm text-muted">Banner not found.</div>
      </>
    );
  }

  const meta = [
    { label: "Model", value: banner.modelLabel },
    { label: "Style", value: banner.style },
    { label: "Aspect", value: banner.aspect },
    { label: "Created", value: new Date(banner.createdAt).toLocaleDateString() },
  ];

  return (
    <>
      <TopBar title="Banner" />
      <div className="mx-auto w-full max-w-7xl space-y-6 px-5 py-8 md:px-8 md:py-10">
        <Link
          href="/dashboard/banners"
          className="inline-flex items-center gap-1.5 text-xs text-muted hover:text-foreground transition-colors"
        >
          <ArrowLeft className="h-3.5 w-3.5" /> All banners
        </Link>

        <div className="grid gap-6 lg:grid-cols-[1fr_360px]">
          <Card elevated className="p-3">
            <div
              className={cn(aspectClass(banner.aspect), "rounded-xl")}
              style={{ background: banner.gradient }}
            />
          </Card>

          <div className="space-y-4">
            <Card elevated className="p-5">
              <div className="flex items-start justify-between gap-3">
                <h1 className="text-lg font-semibold tracking-tight">{banner.title}</h1>
                <Badge tone={banner.score >= 80 ? "success" : "warning"} dot>
                  Score {banner.score}
                </Badge>
              </div>
              <dl className="mt-4 grid grid-cols-2 gap-x-4 gap-y-3 text-sm">
                {meta.map((m) => (
                  <div key={m.label}>
                    <dt className="text-[11px] uppercase tracking-[0.1em] text-muted">{m.label}</dt>
                    <dd className="mt-0.5 text-foreground">{m.value}</dd>
                  </div>
                ))}
              </dl>
            </Card>

            <Card elevated className="p-5">
              <h3 className="text-sm font-semibold tracking-tight">Actions</h3>
              <div className="mt-3 grid grid-cols-2 gap-2">
                <Button
                  href={`/dashboard/banners/${banner.id}/edit`}
                  variant="primary"
                  leftIcon={<Edit3 className="h-3.5 w-3.5" />}
                >
                  Edit
                </Button>
                <Button variant="secondary" leftIcon={<Download className="h-3.5 w-3.5" />}>
                  Download
                </Button>
                <Button variant="secondary" leftIcon={<Share2 className="h-3.5 w-3.5" />}>
                  Share
                </Button>
                <Button variant="secondary" leftIcon={<Star className="h-3.5 w-3.5" />}>
                  {banner.favourite ? "Unfavourite" : "Favourite"}
                </Button>
              </div>
              <button
                type="button"
                className="mt-4 inline-flex w-full items-center justify-center gap-2 rounded-full border border-red-500/30 bg-red-500/5 px-3 py-2 text-xs text-red-400 hover:bg-red-500/10 transition-colors"
              >
                <Trash2 className="h-3.5 w-3.5" />
                Delete banner
              </button>
            </Card>

            <Card elevated className="p-5">
              <h3 className="text-sm font-semibold tracking-tight">Score breakdown</h3>
              <ul className="mt-3 space-y-3 text-xs">
                {[
                  { label: "Composition", value: 88 },
                  { label: "Brand alignment", value: 84 },
                  { label: "Clarity", value: 92 },
                  { label: "On-brief accuracy", value: 81 },
                ].map((s) => (
                  <li key={s.label}>
                    <div className="mb-1 flex items-center justify-between">
                      <span className="text-muted">{s.label}</span>
                      <span className="font-mono text-foreground">{s.value}</span>
                    </div>
                    <div className="h-1.5 overflow-hidden rounded-full bg-surface-2">
                      <div
                        className="h-full rounded-full bg-primary"
                        style={{ width: `${s.value}%` }}
                      />
                    </div>
                  </li>
                ))}
              </ul>
            </Card>
          </div>
        </div>
      </div>
    </>
  );
}
