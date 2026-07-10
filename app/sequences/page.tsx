import Link from "next/link";
import { Rocket, Phone, MapPin } from "lucide-react";
import { Card, CardContent, Badge } from "@/components/ui";
import { ProspectFilters } from "@/components/prospect-filters";
import { AddToWorklist } from "@/components/add-to-worklist";
import { Pager } from "@/components/account-table-bits";
import { listAccounts, getFacets, type AccountFilters as Filters } from "@/lib/queries";
import { fmt } from "@/lib/format";

export const dynamic = "force-dynamic";

type SP = Record<string, string | string[] | undefined>;
const one = (v: string | string[] | undefined) => (Array.isArray(v) ? v[0] : v);

/** Discovery only ever shows fresh dealers — status is forced to 'new', never taken from the URL. */
function parseFilters(sp: SP): Filters {
  return {
    q: one(sp.q),
    oem: one(sp.oem) ? one(sp.oem)!.split(",").filter(Boolean) : undefined,
    country: one(sp.country),
    state: one(sp.state),
    city: one(sp.city),
    tier: one(sp.tier),
    status: "new",
    hasPhone: !!one(sp.hasPhone),
    sort: one(sp.sort),
    dir: one(sp.dir) === "desc" ? "desc" : "asc",
    page: Number(one(sp.page)) || 1,
    pageSize: 20,
  };
}

export default async function ProspectPage({ searchParams }: { searchParams: Promise<SP> }) {
  const sp = await searchParams;
  const filters = parseFilters(sp);
  const { geo, options } = getFacets(filters);
  const { rows, total, page, pageCount, pageSize } = listAccounts(filters);

  return (
    <div className="mx-auto max-w-4xl space-y-6">
      <div>
        <h1 className="flex items-center gap-2 text-2xl font-semibold tracking-tight">
          <Rocket className="h-6 w-6 text-brand" /> Prospect
        </h1>
        <p className="mt-1 text-sm text-muted-foreground">
          Find dealers to work. Filter by brand and area, then add the ones you want to your worklist.
          They move to Today and your Book.
        </p>
      </div>

      <ProspectFilters options={options} geo={geo} />

      <p className="text-sm text-muted-foreground">
        {fmt(total)} {total === 1 ? "dealer" : "dealers"} not yet in your book
      </p>

      {rows.length === 0 ? (
        <Card>
          <CardContent className="p-10 text-center text-sm text-muted-foreground">
            No fresh dealers match these filters. Widen the area or clear a filter to see more.
          </CardContent>
        </Card>
      ) : (
        <Card>
          <CardContent className="divide-y p-0">
            {rows.map((r) => (
              <div key={r.id} className="flex items-center gap-4 px-4 py-3.5">
                <div className="min-w-0 flex-1">
                  <Link href={`/accounts/${r.id}`} className="truncate text-sm font-medium hover:text-primary">
                    {r.name}
                  </Link>
                  <div className="mt-0.5 flex flex-wrap items-center gap-x-2 gap-y-1 text-xs text-muted-foreground">
                    {r.oem && <Badge variant="muted">{r.oem}</Badge>}
                    {r.tier === "A" ? <Badge variant="brand">Tier A</Badge> : r.tier ? <Badge variant="muted">Tier {r.tier}</Badge> : null}
                    <span className="inline-flex items-center gap-1">
                      <MapPin className="h-3 w-3" />
                      {[r.city, r.state_province].filter(Boolean).join(", ") || "—"}
                    </span>
                    {r.phone && (
                      <span className="inline-flex items-center gap-1">
                        <Phone className="h-3 w-3" /> {r.phone}
                      </span>
                    )}
                  </div>
                </div>
                <div className="shrink-0">
                  <AddToWorklist id={r.id} />
                </div>
              </div>
            ))}
          </CardContent>
        </Card>
      )}

      <Pager page={page} pageCount={pageCount} total={total} pageSize={pageSize} />
    </div>
  );
}
