"use server";

import { after } from "next/server";
import { revalidatePath } from "next/cache";
import { getCrm, setStatus } from "@/lib/crm";
import { enrichDealerContacts } from "@/lib/zoominfo";

/**
 * Pick up a fresh dealer from Prospect (Discovery) and drop it into the rep's worklist.
 * Sets CRM status to 'working' — which is what powers Today's pipeline count and Book's
 * board — and logs the status change to the timeline. No-op if the dealer is already
 * in play, so a double-click can't clobber real progress.
 *
 * On pickup we run a ZoomInfo enrichment pass for that dealer (decision-maker names +
 * emails/phones). Credits are spent only here — on dealers the rep actually pursues.
 * It's best-effort and never throws, so a ZoomInfo hiccup can't block the add.
 */
export async function addToWorklistAction(id: number) {
  if (getCrm(id).status !== "new") return;
  setStatus(id, "working", "You");
  // Revalidate now so the row drops instantly and the add feels immediate; run the ZoomInfo
  // enrichment after the response so a slow (or hung) lookup can never make the rep wait.
  // The enrich writes contacts + a timeline breadcrumb, visible on the next visit.
  revalidatePath("/sequences");
  revalidatePath("/today");
  revalidatePath("/accounts");
  revalidatePath("/pipeline");
  revalidatePath(`/accounts/${id}`);
  revalidatePath("/");
  after(() => enrichDealerContacts(id));
}
