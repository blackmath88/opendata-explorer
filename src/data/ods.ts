/**
 * Opendatasoft Explore API v2.1 helpers.
 *
 * Everything in this module is source-specific and must not be imported
 * outside `src/data/`.
 *
 * Observed behaviour of `https://data.bs.ch/api/explore/v2.1` (2026-09):
 *  - `access-control-allow-origin: *` on every endpoint, so the browser can
 *    call it directly with no proxy.
 *  - `limit` is capped at 100 on both `/catalog/datasets` and `/records`.
 *  - paging `/catalog/datasets` WITHOUT `order_by` is not stable: consecutive
 *    pages returned a duplicate and dropped another dataset. `order_by` fixes it.
 *  - `/catalog/datasets` already embeds the full field schema, so dataset
 *    structure is available without a per-dataset request.
 *  - `/records` supports ODSQL `select=min(f) as a, max(f) as b, count(*)` and
 *    `group_by`, which gives real observed values far more cheaply than paging.
 */

export const ODS_BASE = 'https://data.bs.ch/api/explore/v2.1';

/** Both the catalog and the records endpoint reject `limit` above this. */
export const ODS_MAX_LIMIT = 100;

export type Json = Record<string, unknown>;

export const asObject = (value: unknown): Json =>
  value && typeof value === 'object' && !Array.isArray(value) ? (value as Json) : {};

export const asString = (value: unknown): string => (typeof value === 'string' ? value : '');

export const asNumber = (value: unknown): number | undefined =>
  typeof value === 'number' && Number.isFinite(value) ? value : undefined;

export const asStringArray = (value: unknown): string[] =>
  Array.isArray(value) ? value.filter((v): v is string => typeof v === 'string') : [];

/**
 * Basel descriptions are authored as HTML fragments (`<div>`, `<a>`, `<font>`).
 * Rendering them as text leaks markup into the UI, so strip to plain text here
 * rather than in every consumer.
 */
export function stripHtml(value: string): string {
  return value
    .replace(/<\s*(br|\/p|\/div|\/li|\/tr)\s*\/?>/gi, '\n')
    .replace(/<[^>]*>/g, ' ')
    // A description cut mid-tag leaves an unterminated fragment behind; drop it
    // rather than rendering "<a href=https://…" as prose.
    .replace(/<[^>]*$/, ' ')
    .replace(/&nbsp;/gi, ' ')
    .replace(/&amp;/gi, '&')
    .replace(/&lt;/gi, '<')
    .replace(/&gt;/gi, '>')
    .replace(/&quot;/gi, '"')
    .replace(/&#39;/gi, "'")
    .replace(/[ \t]+/g, ' ')
    .replace(/\n{3,}/g, '\n\n')
    .split('\n')
    .map(line => line.trim())
    .join('\n')
    .trim();
}

/**
 * Basel publishes `title`, `description`, `theme` and `keyword` in up to four
 * languages. Display uses the default value; matching should see all of them,
 * because the catalogue is mostly German while users write English.
 */
export function collectLocalized(metas: Json, base: string): string[] {
  const out: string[] = [];
  for (const suffix of ['', '_de', '_en', '_fr']) {
    const value = metas[`${base}${suffix}`];
    if (typeof value === 'string') out.push(value);
    else out.push(...asStringArray(value));
  }
  return [...new Set(out.filter(Boolean))];
}

/** ODS reports frequency as an EU authority URI; keep the readable tail. */
export function normalizeFrequency(value: unknown): string | undefined {
  const raw = asString(value);
  if (!raw) return undefined;
  const tail = raw.split('/').pop() ?? raw;
  return tail.toLowerCase().replace(/_/g, ' ') || undefined;
}

/**
 * `metas.default.bbox` is a GeoJSON Feature, not a bbox array. Reduce it to
 * `[minLon, minLat, maxLon, maxLat]`; return undefined if it is not usable.
 */
export function bboxFromFeature(value: unknown): [number, number, number, number] | undefined {
  const coords: number[][] = [];
  const walk = (node: unknown): void => {
    if (!Array.isArray(node)) return;
    if (node.length >= 2 && typeof node[0] === 'number' && typeof node[1] === 'number') {
      coords.push(node as number[]);
      return;
    }
    for (const child of node) walk(child);
  };
  walk(asObject(asObject(value).geometry).coordinates ?? asObject(value).coordinates ?? value);
  if (!coords.length) return undefined;
  const lons = coords.map(c => c[0]);
  const lats = coords.map(c => c[1]);
  const box: [number, number, number, number] = [
    Math.min(...lons), Math.min(...lats), Math.max(...lons), Math.max(...lats),
  ];
  return box.every(Number.isFinite) ? box : undefined;
}

export interface OdsFetchOptions {
  signal?: AbortSignal;
  timeoutMs?: number;
  /** Extra attempts after a transport-level failure. */
  retries?: number;
}

/**
 * Transport-level failures observed against this API under sustained
 * sequential use: a large export occasionally ends in `fetch failed` while the
 * same request succeeds moments later. A validation engine must not record
 * that as an inconclusive result, so transport failures are retried. HTTP
 * error responses are not — a 400 will stay a 400.
 */
const RETRY_BASE_MS = 400;

/** Fetch JSON with a timeout and bounded retry, surfacing ODS's error message. */
export async function odsFetch<T>(
  path: string,
  params: Record<string, string | number> = {},
  options: OdsFetchOptions = {},
): Promise<T> {
  const url = new URL(`${ODS_BASE}${path}`);
  for (const [key, value] of Object.entries(params)) url.searchParams.set(key, String(value));

  const attempts = (options.retries ?? 2) + 1;
  let lastError: unknown;

  for (let attempt = 0; attempt < attempts; attempt += 1) {
    if (attempt > 0) await delay(RETRY_BASE_MS * 2 ** (attempt - 1));

    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), options.timeoutMs ?? 20000);
    if (options.signal) options.signal.addEventListener('abort', () => controller.abort(), { once: true });

    try {
      const response = await fetch(url, {
        headers: { Accept: 'application/json' },
        signal: controller.signal,
      });
      if (!response.ok) {
        let detail = '';
        try {
          const body = (await response.json()) as { message?: string };
          detail = body.message ? ` — ${body.message}` : '';
        } catch {
          /* body was not JSON; the status alone is the signal */
        }
        // A rejected request is an answer, not a glitch: do not retry it.
        throw new Error(`${url.pathname} returned HTTP ${response.status}${detail}`);
      }
      return (await response.json()) as T;
    } catch (error) {
      lastError = error;
      if (!isTransient(error)) throw error;
    } finally {
      clearTimeout(timeout);
    }
  }

  throw new Error(
    `${url.pathname} failed after ${attempts} attempts: ${lastError instanceof Error ? lastError.message : 'unknown error'}`,
  );
}

const delay = (ms: number): Promise<void> => new Promise(resolve => setTimeout(resolve, ms));

/** Transport failures and timeouts are worth retrying; HTTP errors are not. */
function isTransient(error: unknown): boolean {
  if (!(error instanceof Error)) return false;
  if (error.name === 'AbortError' || error.name === 'TimeoutError') return true;
  return /fetch failed|network|ECONNRESET|ETIMEDOUT|EAI_AGAIN|socket|terminated/i.test(error.message);
}
