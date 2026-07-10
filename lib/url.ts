/**
 * Only allow http(s) URLs to be used as navigable hrefs. `website` and social links come
 * from OpenStreetMap / enrichment, not the rep — a `javascript:` or `data:` value would be
 * a stored-XSS vector when rendered into an href. Returns undefined for anything else, which
 * renders a non-navigable link rather than executing.
 */
export function safeUrl(u: string | null | undefined): string | undefined {
  if (!u) return undefined;
  const t = u.trim();
  return /^https?:\/\//i.test(t) ? t : undefined;
}
