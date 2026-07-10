import { getSqlite } from "./db";
import { ensureTodayTables } from "./today";

/*
 * Server-only read helpers for the Today screen. Everything here is derived from the
 * rep's own CRM state (account_crm) and their logged activity — no outreach engine.
 * A "hot lead" is a dealer that has actually responded (engaged/won); the feed is the
 * real activity timeline. Both are things the rep did, so Today never shows fiction.
 */

export interface HotLead {
  dealershipId: number;
  name: string;
  oem: string | null;
  city: string | null;
  status: string;
  phone: string | null;
  lastOutcome: string | null;
  lastTouchAt: string | null;
  daysSinceTouch: number | null;
  whyNow: string;
}

interface HotRow {
  dealershipId: number;
  name: string;
  oem: string | null;
  city: string | null;
  status: string;
  phone: string | null;
  lastOutcome: string | null;
  lastTouchAt: string | null;
}

function firstSentence(s: string): string {
  // Drop the trailing terminator — whyNow adds its own ". "/", " so the note reads
  // "Interested in Q2. 3d since last touch", not "...Q2.. 3d...".
  const t = (s.trim().split(/(?<=[.!?])\s/)[0] ?? s).replace(/[.!?]+$/, "");
  return t.length > 90 ? t.slice(0, 87) + "…" : t;
}

/**
 * One concrete sentence for why this account is worth a call *right now* — the actual last
 * thing that happened plus how stale it's gotten, because a hot lead you haven't touched in
 * days is the one about to cool.
 */
function whyNow(r: HotRow, daysSinceTouch: number | null): string {
  const outcome = r.lastOutcome ? firstSentence(cleanBody(r.lastOutcome) ?? r.lastOutcome) : null;
  if (daysSinceTouch === null) return outcome ? `${outcome}. No follow-up logged yet` : "Responded — no follow-up logged yet. Reach out";
  if (daysSinceTouch <= 0) return outcome ? `${outcome}. Touched today, strike while it's warm` : "Touched today, strike while it's warm";
  const ago = `${daysSinceTouch}d since last touch`;
  return outcome ? `${outcome}. ${ago}, follow up before it cools` : `Responded, ${ago}, follow up before it cools`;
}

/**
 * The rep's "worth your time" queue: dealers that have responded (engaged/won), minus anything
 * snoozed, ordered most-overdue first so the top card is a defensible "do this next".
 */
export function listHotLeads(limit = 25): HotLead[] {
  ensureTodayTables();
  const nowIso = new Date().toISOString();
  const rows = getSqlite()
    .prepare(
      `SELECT d.id AS dealershipId, d.name, d.oem, d.city, d.phone, c.status,
         (SELECT a.body FROM activity a
          WHERE a.dealership_id = d.id AND a.kind IN ('call','sms','gift','note')
          ORDER BY a.id DESC LIMIT 1) AS lastOutcome,
         (SELECT MAX(a.created_at) FROM activity a WHERE a.dealership_id = d.id) AS lastTouchAt
       FROM dealerships d JOIN account_crm c ON c.dealership_id = d.id
       LEFT JOIN today_snooze sn ON sn.dealership_id = d.id
       WHERE c.status IN ('engaged','won')
         AND (sn.snoozed_until IS NULL OR sn.snoozed_until <= ?)
       ORDER BY COALESCE(lastTouchAt, '0000') ASC
       LIMIT ?`
    )
    .all(nowIso, limit) as HotRow[];

  const now = Date.now();
  return rows.map((r) => {
    const daysSinceTouch = r.lastTouchAt
      ? Math.max(0, Math.floor((now - new Date(r.lastTouchAt).getTime()) / 86_400_000))
      : null;
    return { ...r, lastOutcome: cleanBody(r.lastOutcome), daysSinceTouch, whyNow: whyNow(r, daysSinceTouch) };
  });
}

export interface FeedItem {
  dealershipId: number;
  name: string;
  kind: string;
  body: string | null;
  created_at: string;
}

/** Translate any system phrasing in a log line into plain, human language. */
function cleanBody(body: string | null): string | null {
  if (!body) return body;
  return body
    .replace(/ · (vapi|bland|twilio|simulated)(\/dry)?/gi, "")
    .replace(/Status: \w+ → (\w+)/g, (_m, to: string) => `Now ${to}`);
}

export function recentActivity(limit = 12): FeedItem[] {
  const rows = getSqlite()
    .prepare(
      `SELECT a.dealership_id AS dealershipId, d.name, a.kind, a.body, a.created_at
       FROM activity a JOIN dealerships d ON d.id = a.dealership_id
       WHERE a.kind IN ('call','sms','gift','note','status_change')
       ORDER BY a.id DESC LIMIT ?`
    )
    .all(limit) as FeedItem[];
  return rows.map((r) => ({ ...r, body: cleanBody(r.body) }));
}
