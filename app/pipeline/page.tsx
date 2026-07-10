import { BookTabs } from "@/components/book-tabs";
import { PipelineBoard, type BoardCard } from "@/components/pipeline-board";
import { listAccounts } from "@/lib/queries";
import { getPipelineCounts } from "@/lib/crm";
import { STATUSES, type Status } from "@/lib/crm-constants";

export const dynamic = "force-dynamic";

const COLUMN_CAP = 50;

export default function PipelinePage() {
  const counts = getPipelineCounts();

  // Cards per stage. "New" is the whole untouched book (34k+), so it stays a count-only column.
  const cards = {} as Record<Status, BoardCard[]>;
  for (const s of STATUSES) {
    cards[s] =
      s === "new"
        ? []
        : listAccounts({ status: s, pageSize: COLUMN_CAP, sort: "name" }).rows.map((r) => ({
            id: r.id,
            name: r.name,
            oem: r.oem,
            city: r.city,
            state_province: r.state_province,
            country: r.country,
            owner: r.owner,
          }));
  }

  return (
    <div className="space-y-5">
      <div>
        <div className="flex items-center gap-3">
          <h1 className="text-2xl font-semibold tracking-tight">Book</h1>
          <BookTabs current="board" />
        </div>
        <p className="mt-1 text-sm text-muted-foreground">
          Your dealers by stage. Drag a card to move it between stages, or open one to work it.
        </p>
      </div>

      <PipelineBoard initialCards={cards} initialCounts={counts} cap={COLUMN_CAP} />
    </div>
  );
}
