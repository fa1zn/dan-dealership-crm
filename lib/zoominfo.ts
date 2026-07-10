import { getSqlite } from "./db";
import { repEnv } from "./connections";
import { logActivity } from "./crm";

/*
 * ZoomInfo GTM Data API (server-only). Auth is OAuth2 client-credentials: we mint a short-lived
 * bearer token from client_id + client_secret and cache it in-process until it nears expiry.
 *
 * Two calls matter:
 *   - /contacts/search  — FREE (no credits). Returns decision-maker names/titles + availability.
 *   - /contacts/enrich  — 1 credit per matched record. Returns the actual email/phone.
 *
 * NOTE: ZoomInfo sits behind Cloudflare, which blocks non-browser User-Agents with "error 1010".
 * We must send a real browser UA on every request or auth appears to fail.
 */

const TOKEN_URL = "https://okta-login.zoominfo.com/oauth2/default/v1/token";
const API = "https://api.zoominfo.com/gtm/data/v1";
const UA =
  "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/126.0.0.0 Safari/537.36";
const SCOPE = "api:data:contact api:data:company";

let _token: { value: string; exp: number } | null = null;

/** fetch with a hard timeout, so a hung ZoomInfo can never block the add-to-worklist flow. */
async function fetchT(url: string, opts: RequestInit, ms = 8000): Promise<Response> {
  const ctl = new AbortController();
  const timer = setTimeout(() => ctl.abort(), ms);
  try {
    return await fetch(url, { ...opts, signal: ctl.signal });
  } finally {
    clearTimeout(timer);
  }
}

function creds() {
  const env = repEnv();
  return { id: env.ZOOMINFO_CLIENT_ID, secret: env.ZOOMINFO_CLIENT_SECRET };
}

export function zoominfoConfigured(): boolean {
  const { id, secret } = creds();
  return !!(id && secret);
}

async function getToken(): Promise<string> {
  if (_token && _token.exp > Date.now() + 60_000) return _token.value;
  const { id, secret } = creds();
  if (!id || !secret) throw new Error("ZoomInfo client_id/secret not configured");
  const basic = Buffer.from(`${id}:${secret}`).toString("base64");
  const res = await fetchT(TOKEN_URL, {
    method: "POST",
    headers: {
      "User-Agent": UA,
      Authorization: `Basic ${basic}`,
      "Content-Type": "application/x-www-form-urlencoded",
      Accept: "application/json",
    },
    body: `grant_type=client_credentials&scope=${encodeURIComponent(SCOPE)}`,
  });
  if (!res.ok) throw new Error(`ZoomInfo auth failed (${res.status})`);
  const j = (await res.json()) as { access_token: string; expires_in?: number };
  _token = { value: j.access_token, exp: Date.now() + (j.expires_in ?? 3600) * 1000 };
  return _token.value;
}

async function apiPost(path: string, body: unknown): Promise<{ data?: unknown[] }> {
  const token = await getToken();
  const res = await fetchT(`${API}${path}`, {
    method: "POST",
    headers: { "User-Agent": UA, Authorization: `Bearer ${token}`, "Content-Type": "application/json", Accept: "*/*" },
    body: JSON.stringify(body),
  });
  const text = await res.text();
  if (!res.ok) throw new Error(`ZoomInfo ${path} ${res.status}: ${text.slice(0, 200)}`);
  return JSON.parse(text);
}

interface SearchRow {
  id: string | number;
  attributes?: {
    firstName?: string;
    lastName?: string;
    jobTitle?: string;
    hasEmail?: boolean;
    hasDirectPhone?: boolean;
    hasMobilePhone?: boolean;
  };
}

export interface ZiCandidate {
  id: string;
  jobTitle?: string;
  reachable: boolean;
}

/** FREE — no credits. Decision-maker candidates at a company, with reachability hints. */
export async function searchContacts(companyName: string): Promise<ZiCandidate[]> {
  const j = await apiPost("/contacts/search", { data: { attributes: { companyName } } });
  return ((j.data ?? []) as SearchRow[]).map((r) => ({
    id: String(r.id),
    jobTitle: r.attributes?.jobTitle,
    reachable: !!(r.attributes?.hasEmail || r.attributes?.hasMobilePhone || r.attributes?.hasDirectPhone),
  }));
}

export interface ZiContact {
  name: string;
  title?: string;
  email?: string;
  phone?: string;
  source: "ZoomInfo";
}

interface EnrichRow {
  attributes?: { firstName?: string; lastName?: string; jobTitle?: string; email?: string; phone?: string; mobilePhone?: string };
}

/** Costs 1 credit per matched record. Enrich up to 25 contacts by personId. */
export async function enrichContacts(personIds: string[]): Promise<ZiContact[]> {
  if (!personIds.length) return [];
  const j = await apiPost("/contacts/enrich", {
    data: {
      attributes: {
        matchPersonInput: personIds.slice(0, 25).map((personId) => ({ personId: Number(personId) })),
        outputFields: ["firstName", "lastName", "jobTitle", "email", "phone", "mobilePhone", "companyName"],
      },
    },
  });
  return ((j.data ?? []) as EnrichRow[])
    .map((r) => {
      const a = r.attributes ?? {};
      const name = [a.firstName, a.lastName].filter(Boolean).join(" ").trim();
      return { name, title: a.jobTitle, email: a.email || undefined, phone: a.phone || a.mobilePhone || undefined, source: "ZoomInfo" as const };
    })
    .filter((c) => c.name);
}

// Rank candidates so credits land on the most senior, sellable-to titles first.
const TITLE_RANK: RegExp[] = [
  /\bowner\b|\bprincipal\b|dealer principal/i,
  /general manager|\bgm\b/i,
  /\bgsm\b|general sales manager/i,
  /sales manager|sales director/i,
  /\bmarketing\b/i,
  /manager|director|\bvp\b|chief/i,
];
function rankTitle(t?: string): number {
  if (!t) return 99;
  for (let i = 0; i < TITLE_RANK.length; i++) if (TITLE_RANK[i].test(t)) return i;
  return 90;
}

/**
 * Full ZoomInfo pass for one dealer: search decision-makers (free), enrich the top few
 * reachable ones (credits), merge onto the dealer's contacts and log it. Best-effort:
 * returns a status and never throws, so it can't break the add-to-worklist flow.
 */
export async function enrichDealerContacts(dealershipId: number): Promise<{ added: number; note: string }> {
  try {
    if (!zoominfoConfigured()) return { added: 0, note: "ZoomInfo not configured" };
    const max = Number(repEnv().ZOOMINFO_MAX_CONTACTS ?? 5) || 5;
    const db = getSqlite();
    const row = db.prepare("SELECT name, contacts FROM dealerships WHERE id = ?").get(dealershipId) as
      | { name: string; contacts: string | null }
      | undefined;
    if (!row) return { added: 0, note: "dealer not found" };

    const picked = (await searchContacts(row.name))
      .filter((c) => c.reachable)
      .sort((a, b) => rankTitle(a.jobTitle) - rankTitle(b.jobTitle))
      .slice(0, max);
    if (!picked.length) {
      logActivity(dealershipId, "note", "ZoomInfo: no reachable decision-maker contacts found for this dealer", "ZoomInfo");
      return { added: 0, note: "no reachable ZoomInfo contacts" };
    }

    const enriched = await enrichContacts(picked.map((c) => c.id));

    let existing: { name?: string }[] = [];
    try {
      existing = JSON.parse(row.contacts ?? "[]");
    } catch {
      existing = [];
    }
    const seen = new Set(existing.map((c) => (c.name ?? "").toLowerCase()).filter(Boolean));
    const additions = enriched.filter((c) => !seen.has(c.name.toLowerCase()));
    if (!additions.length) return { added: 0, note: "no new contacts" };

    db.prepare("UPDATE dealerships SET contacts = ?, updated_at = CURRENT_TIMESTAMP WHERE id = ?").run(
      JSON.stringify([...existing, ...additions]),
      dealershipId
    );
    logActivity(
      dealershipId,
      "note",
      `ZoomInfo: added ${additions.length} contact${additions.length === 1 ? "" : "s"} — ${additions.map((a) => a.name).join(", ")}`,
      "ZoomInfo"
    );
    return { added: additions.length, note: "ok" };
  } catch (e) {
    console.error("ZoomInfo enrich failed:", e);
    try {
      logActivity(dealershipId, "note", "ZoomInfo enrichment was unavailable for this dealer", "ZoomInfo");
    } catch {
      /* logging is best-effort too */
    }
    return { added: 0, note: (e as Error).message };
  }
}
