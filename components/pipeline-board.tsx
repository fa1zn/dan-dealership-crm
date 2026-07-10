"use client";

import { useState, useRef, useTransition } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { Badge } from "@/components/ui";
import { STATUSES, STATUS_META, type Status } from "@/lib/crm-constants";
import { updateStatusAction } from "@/app/actions";
import { fmt } from "@/lib/format";
import { cn } from "@/lib/ui";

export interface BoardCard {
  id: number;
  name: string;
  oem: string | null;
  city: string | null;
  state_province: string | null;
  country: string | null;
  owner: string | null;
}

/**
 * Drag-and-drop pipeline board. Grab a card and drop it in another stage; the dealer's CRM
 * status updates immediately (optimistic) and persists via updateStatusAction. A plain click
 * still opens the dealer, since a click without movement never starts a drag.
 *
 * The "New" column holds the whole untouched book, so it shows a count and link rather than
 * thousands of cards, but it still accepts a drop (dragging a card there resets it to New).
 */
export function PipelineBoard({
  initialCards,
  initialCounts,
  cap,
}: {
  initialCards: Record<Status, BoardCard[]>;
  initialCounts: Record<Status, number>;
  cap: number;
}) {
  const router = useRouter();
  const [cards, setCards] = useState(initialCards);
  const [counts, setCounts] = useState(initialCounts);
  const [dragId, setDragId] = useState<number | null>(null);
  const [overCol, setOverCol] = useState<Status | null>(null);
  const [, startTransition] = useTransition();
  const draggingRef = useRef(false);

  function move(id: number, to: Status) {
    let from: Status | null = null;
    for (const s of STATUSES) {
      if ((cards[s] ?? []).some((c) => c.id === id)) {
        from = s;
        break;
      }
    }
    if (from == null || from === to) return;
    const card = cards[from].find((c) => c.id === id)!;
    setCards((prev) => {
      const next = { ...prev };
      next[from!] = prev[from!].filter((c) => c.id !== id);
      // New is a count-only column; don't stack cards there.
      if (to !== "new") next[to] = [card, ...(prev[to] ?? [])].slice(0, cap);
      return next;
    });
    setCounts((prev) => ({ ...prev, [from!]: Math.max(0, prev[from!] - 1), [to]: prev[to] + 1 }));
    startTransition(() => updateStatusAction(id, to));
  }

  function onDrop(to: Status, e: React.DragEvent) {
    // Read the id from the drag payload (survives any state timing), fall back to tracked id.
    const raw = e.dataTransfer.getData("text/plain");
    const id = raw ? Number(raw) : dragId;
    setOverCol(null);
    setDragId(null);
    draggingRef.current = false;
    if (id != null && !Number.isNaN(id)) move(id, to);
  }

  return (
    <div className="flex gap-4 overflow-x-auto pb-4">
      {STATUSES.map((s) => {
        const total = counts[s];
        const rows = cards[s] ?? [];
        const isOver = overCol === s;
        return (
          <div
            key={s}
            onDragOver={(e) => {
              e.preventDefault();
              e.dataTransfer.dropEffect = "move";
              if (overCol !== s) setOverCol(s);
            }}
            onDrop={(e) => {
              e.preventDefault();
              onDrop(s, e);
            }}
            className={cn(
              "flex w-72 shrink-0 flex-col rounded-lg border bg-card transition-colors",
              isOver && dragId != null && "border-brand ring-2 ring-brand/40"
            )}
          >
            <div className="flex items-center justify-between border-b px-4 py-3">
              <Badge variant={STATUS_META[s].badge}>{STATUS_META[s].label}</Badge>
              <span className="text-sm font-medium tabular-nums text-muted-foreground">{fmt(total)}</span>
            </div>

            <div className="flex min-h-[80px] flex-col gap-2 p-3">
              {s === "new" ? (
                <Link
                  href="/accounts?status=new"
                  className="rounded-md border border-dashed p-4 text-center text-sm text-muted-foreground hover:border-brand hover:text-foreground"
                >
                  {fmt(total)} untouched rooftops
                  <div className="mt-1 text-xs">Browse the book →</div>
                </Link>
              ) : rows.length === 0 ? (
                <div className="px-1 py-3 text-sm text-muted-foreground">
                  {isOver && dragId != null ? "Drop to move here" : "No accounts in this stage yet."}
                </div>
              ) : (
                rows.map((r) => (
                  <div
                    key={r.id}
                    draggable
                    onDragStart={(e) => {
                      setDragId(r.id);
                      draggingRef.current = true;
                      e.dataTransfer.effectAllowed = "move";
                      e.dataTransfer.setData("text/plain", String(r.id));
                    }}
                    onDragEnd={() => {
                      draggingRef.current = false;
                      setOverCol(null);
                      setDragId(null);
                    }}
                    onClick={() => {
                      if (!draggingRef.current) router.push(`/accounts/${r.id}`);
                    }}
                    className={cn(
                      "cursor-grab rounded-md border bg-background p-3 transition-colors hover:border-brand active:cursor-grabbing",
                      dragId === r.id && "opacity-40"
                    )}
                  >
                    <div className="truncate text-sm font-medium">{r.name}</div>
                    <div className="mt-1 flex flex-wrap items-center gap-1.5 text-xs text-muted-foreground">
                      {r.oem && <Badge variant="muted">{r.oem}</Badge>}
                      <span>{[r.city, r.state_province].filter(Boolean).join(", ") || r.country}</span>
                    </div>
                    {r.owner && <div className="mt-1 text-xs text-muted-foreground">Owner: {r.owner}</div>}
                  </div>
                ))
              )}
              {s !== "new" && total > rows.length && (
                <Link href={`/accounts?status=${s}`} className="px-1 py-1 text-xs text-primary hover:underline">
                  +{fmt(total - rows.length)} more →
                </Link>
              )}
            </div>
          </div>
        );
      })}
    </div>
  );
}
