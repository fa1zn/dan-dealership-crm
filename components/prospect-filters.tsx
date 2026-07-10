"use client";

import { useEffect, useRef, useState } from "react";
import { usePathname, useRouter, useSearchParams } from "next/navigation";
import { Search, ChevronDown, X } from "lucide-react";
import {
  Input,
  Button,
  Badge,
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
  DropdownMenu,
  DropdownMenuTrigger,
  DropdownMenuContent,
  DropdownMenuCheckboxItem,
} from "./ui";
import { cn } from "@/lib/ui";
import type { FilterOptions } from "@/lib/queries";
import type { GeoTree } from "@/lib/geo";
import { GeoCascade } from "./geo-cascade";

const ALL = "__all";

/**
 * Filters for Prospect (Discovery). Deliberately excludes the CRM "Status" control that Book
 * has — this page only ever shows fresh, not-yet-worked dealers, so status isn't a choice here.
 */
export function ProspectFilters({ options, geo }: { options: FilterOptions; geo: GeoTree }) {
  const router = useRouter();
  const pathname = usePathname();
  const sp = useSearchParams();

  const setParams = (patch: Record<string, string | null>) => {
    // Read the LIVE URL, not the render-time snapshot of sp. router.replace updates the
    // address bar synchronously, so merging onto window.location.search lets rapid changes
    // (country then state then city, faster than the server round-trip) accumulate instead
    // of one clobbering another and resetting the cascade.
    const next = new URLSearchParams(typeof window !== "undefined" ? window.location.search : sp.toString());
    for (const [k, v] of Object.entries(patch)) {
      if (v == null || v === "") next.delete(k);
      else next.set(k, v);
    }
    next.delete("page");
    router.replace(`${pathname}?${next.toString()}`, { scroll: false });
  };

  const [q, setQ] = useState(sp.get("q") ?? "");
  const first = useRef(true);
  useEffect(() => {
    if (first.current) {
      first.current = false;
      return;
    }
    const t = setTimeout(() => setParams({ q: q || null }), 300);
    return () => clearTimeout(t);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [q]);

  const oems = (sp.get("oem") ?? "").split(",").filter(Boolean);
  const toggleOem = (oem: string) => {
    const next = oems.includes(oem) ? oems.filter((o) => o !== oem) : [...oems, oem];
    setParams({ oem: next.join(",") || null });
  };

  const toggleFlag = (key: string) => setParams({ [key]: sp.get(key) ? null : "1" });
  const activeCount = [...sp.keys()].filter((k) => !["page", "sort", "dir"].includes(k)).length;

  return (
    <div className="flex flex-wrap items-center gap-2">
      <div className="relative min-w-[220px] flex-1">
        <Search className="pointer-events-none absolute left-2.5 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
        <Input value={q} onChange={(e) => setQ(e.target.value)} placeholder="Search name, city, or domain…" className="pl-8" />
      </div>

      <DropdownMenu>
        <DropdownMenuTrigger asChild>
          <button
            className={cn(
              "inline-flex h-9 items-center gap-1.5 rounded-md border px-3 text-sm transition-colors hover:bg-accent",
              oems.length ? "border-brand text-foreground" : "text-muted-foreground"
            )}
          >
            OEM
            {oems.length > 0 && (
              <Badge variant="brand" className="ml-0.5 px-1.5 py-0">
                {oems.length}
              </Badge>
            )}
            <ChevronDown className="h-4 w-4" />
          </button>
        </DropdownMenuTrigger>
        <DropdownMenuContent align="start">
          {options.oems.map((o) => (
            <DropdownMenuCheckboxItem key={o.value} checked={oems.includes(o.value)} onCheckedChange={() => toggleOem(o.value)}>
              {o.value} <span className="ml-1 text-xs text-muted-foreground">({o.count.toLocaleString()})</span>
            </DropdownMenuCheckboxItem>
          ))}
        </DropdownMenuContent>
      </DropdownMenu>

      <GeoCascade
        tree={geo}
        value={{ country: sp.get("country") ?? "", state: sp.get("state") ?? "", city: sp.get("city") ?? "" }}
        onChange={(v) => setParams({ country: v.country || null, state: v.state || null, city: v.city || null })}
      />

      <Select value={sp.get("tier") ?? undefined} onValueChange={(v) => setParams({ tier: v === ALL ? null : v })}>
        <SelectTrigger className={cn(sp.get("tier") ? "border-brand text-foreground" : "text-muted-foreground")}>
          <SelectValue placeholder="Tier: All" />
        </SelectTrigger>
        <SelectContent>
          <SelectItem value={ALL}>Tier: All</SelectItem>
          {options.tiers.map((t) => (
            <SelectItem key={t.value} value={t.value}>
              Tier {t.value} ({t.count.toLocaleString()})
            </SelectItem>
          ))}
        </SelectContent>
      </Select>

      <button
        onClick={() => toggleFlag("hasPhone")}
        className={cn(
          "inline-flex h-9 items-center rounded-md border px-3 text-sm transition-colors",
          sp.get("hasPhone") ? "border-brand bg-brand/10 text-brand" : "text-muted-foreground hover:bg-accent hover:text-foreground"
        )}
      >
        Has phone
      </button>

      {activeCount > 0 && (
        <Button
          variant="ghost"
          size="sm"
          onClick={() => {
            setQ("");
            router.replace(pathname, { scroll: false });
          }}
        >
          <X className="h-3.5 w-3.5" /> Clear
        </Button>
      )}
    </div>
  );
}
