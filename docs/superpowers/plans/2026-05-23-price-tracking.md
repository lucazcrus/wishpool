# Price Tracking Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Track price changes of saved items via a hybrid pipeline (browser extension on-visit + Supabase cron) and surface price drops as badges + sparkline in the app, all on the Supabase + Vercel free tier.

**Architecture:** Three independent layers communicating through Postgres as source of truth: (1) collection (extension content script + Edge Function called by pg_cron); (2) storage (extended `links`, `link_price_history`, `price_alerts` with RPC + AFTER INSERT trigger that creates alerts and updates the price cache); (3) presentation (React hook + badge on `CardLink` + sparkline on `ItemModal`). Shadow-sync of localStorage items into `public.links` enables the pipeline without changing the UI source of truth.

**Tech Stack:** Vite + React 19 + TypeScript, Supabase (Postgres + Edge Functions + pg_cron + pg_net), Chrome MV3 extension (esbuild bundle), Tailwind v4.

---

## Spec reference

This plan implements `docs/superpowers/specs/2026-05-23-price-tracking-design.md`.

## File Structure

**Created:**
- `supabase/migrations/2026-05-23-price-tracking.sql` — schema additions, RPC, trigger, pg_cron job, pg_net hook
- `supabase/functions/refresh-stale-prices/index.ts` — Edge Function (Deno) that processes stale links
- `supabase/functions/refresh-stale-prices/extractor.ts` — shared HTML → price extractor used by the Edge Function
- `src/lib/price-extractor.ts` — DOM → price extractor used by the extension and (optionally) by the app for parity tests
- `src/lib/link-sync.ts` — shadow-syncs localStorage items into `public.links` (upsert/delete) without changing UI source of truth
- `src/lib/price-history.ts` — Supabase client helpers: `fetchLatestAlert`, `fetchPriceHistory`, `markAlertRead`
- `src/lib/use-price-alert.ts` — React hook returning `{ dropAmount, dropPct } | null` for a given item id
- `src/components/PriceSparkline.tsx` — pure SVG sparkline (no chart lib)
- `extension/price-tracker.js` — content script that captures price on visit (built by esbuild)
- `extension/price-tracker.src.js` — the source for the bundled content script (imports extractor)

**Modified:**
- `src/lib/store.ts` — call `link-sync` on add/set/delete
- `src/components/CardLink.tsx` — render price drop badge using `usePriceAlert`
- `src/components/ItemModal.tsx` — render `PriceSparkline` with history; mark alert read on close
- `extension/manifest.json` — add `<all_urls>` content script + `alarms` permission
- `extension/popup.jsx` — sync URL index to `chrome.storage.local` after login and on popup open
- `extension/sync-app.js` — sync URL index when web-session is detected
- `scripts/build-extension.mjs` — build `extension/price-tracker.js` from `extension/price-tracker.src.js`

**Files that change together:** the Edge Function and its `extractor.ts` are colocated under `supabase/functions/refresh-stale-prices/`. The extension's content script source and the bundled output live under `extension/`. App-side price logic lives under `src/lib/` to follow existing structure.

---

## Pre-flight

- [ ] **Step 0.1: Confirm Supabase project is linked and you have psql access (or use the Supabase Studio SQL editor).**

Run: `npx supabase status` (if Supabase CLI is installed locally) — expect "API URL" and "DB URL".
If `supabase` CLI is not installed, use the Studio's SQL editor for migrations and the dashboard for Edge Functions.

- [ ] **Step 0.2: Verify the dev server runs.**

Run: `npm run dev`
Expected: Vite serves at `http://localhost:5173`. Login and confirm items list loads. Stop the server when done.

- [ ] **Step 0.3: Verify the extension build works.**

Run: `npm run build:extension`
Expected: `Extension popup built: popup.js + popup.css` and no errors. `extension/popup.js` and `extension/popup.css` updated.

---

## Task 1: Migration — extend schema, RPC, trigger

**Files:**
- Create: `supabase/migrations/2026-05-23-price-tracking.sql`

This SQL is **idempotent** — re-running is safe. We are not enabling pg_cron yet (Task 5).

- [ ] **Step 1.1: Create migration file with schema additions.**

Create `supabase/migrations/2026-05-23-price-tracking.sql`:

```sql
-- 2026-05-23 Price tracking pipeline
-- Adds currency + check telemetry to links, currency to history,
-- a recording RPC, and an AFTER INSERT trigger that creates alerts
-- and refreshes the price cache.

alter table public.links
  add column if not exists currency text not null default 'BRL',
  add column if not exists last_check_at timestamptz,
  add column if not exists last_check_status text;

alter table public.link_price_history
  add column if not exists currency text not null default 'BRL';

create index if not exists idx_links_last_check_at
  on public.links(last_check_at nulls first);

create index if not exists idx_link_price_history_link_currency_captured
  on public.link_price_history(link_id, currency, captured_at desc);

-- RPC: client-facing entry point. Idempotent under no-change inserts.
create or replace function public.record_price_snapshot(
  p_link_id uuid,
  p_price numeric,
  p_currency text,
  p_source text default 'manual'
) returns void
language plpgsql
security invoker
as $$
declare
  v_last_price numeric;
  v_user_id uuid;
  v_link_currency text;
begin
  select price, user_id, currency
    into v_last_price, v_user_id, v_link_currency
  from public.links
  where id = p_link_id and user_id = auth.uid();

  if v_user_id is null then
    raise exception 'link not found or not owned';
  end if;

  if v_link_currency is distinct from p_currency then
    return; -- ignore snapshots in a different currency
  end if;

  if v_last_price is distinct from p_price then
    insert into public.link_price_history (link_id, user_id, price, currency, source)
    values (p_link_id, v_user_id, p_price, p_currency, p_source);
  end if;
end;
$$;

grant execute on function public.record_price_snapshot(uuid, numeric, text, text) to authenticated;

-- Trigger: creates a price_alert on price drop and refreshes links.price cache.
create or replace function public.handle_price_snapshot()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
declare
  v_previous numeric;
begin
  select price into v_previous
  from public.link_price_history
  where link_id = new.link_id
    and currency = new.currency
    and id <> new.id
  order by captured_at desc
  limit 1;

  if v_previous is not null and new.price < v_previous then
    insert into public.price_alerts
      (link_id, user_id, previous_price, current_price, drop_amount)
    values
      (new.link_id, new.user_id, v_previous, new.price, v_previous - new.price);
  end if;

  update public.links
     set price = new.price
   where id = new.link_id;

  return new;
end;
$$;

drop trigger if exists on_link_price_snapshot on public.link_price_history;
create trigger on_link_price_snapshot
after insert on public.link_price_history
for each row execute function public.handle_price_snapshot();
```

- [ ] **Step 1.2: Apply the migration.**

Option A (Supabase Studio):
1. Open Supabase Studio → SQL Editor.
2. Paste the contents of `supabase/migrations/2026-05-23-price-tracking.sql`.
3. Run. Expect "Success. No rows returned".

Option B (Supabase CLI, if linked locally):
Run: `supabase db push` (or `supabase db execute --file supabase/migrations/2026-05-23-price-tracking.sql`)
Expected: no errors.

- [ ] **Step 1.3: Smoke test the RPC and trigger.**

In Supabase Studio SQL Editor (run while authenticated as a real user — use the studio "Run as authenticated" toggle and pass a real user id, OR temporarily run with service role and impersonate):

```sql
-- Make sure you have at least one link in `public.links` for a user you can impersonate.
-- Replace <LINK_ID> and <USER_ID> below.
-- 1. Insert a baseline snapshot.
insert into public.link_price_history (link_id, user_id, price, currency, source)
values ('<LINK_ID>', '<USER_ID>', 100, 'BRL', 'manual');

-- 2. Insert a lower-priced snapshot — must trigger a price_alert and update links.price.
insert into public.link_price_history (link_id, user_id, price, currency, source)
values ('<LINK_ID>', '<USER_ID>', 80, 'BRL', 'manual');

-- 3. Verify.
select previous_price, current_price, drop_amount
from public.price_alerts
where link_id = '<LINK_ID>'
order by created_at desc limit 1;
-- Expect: 100, 80, 20

select price from public.links where id = '<LINK_ID>';
-- Expect: 80
```

Clean up:
```sql
delete from public.price_alerts where link_id = '<LINK_ID>';
delete from public.link_price_history where link_id = '<LINK_ID>';
update public.links set price = 100 where id = '<LINK_ID>'; -- restore
```

- [ ] **Step 1.4: Commit.**

```bash
git add supabase/migrations/2026-05-23-price-tracking.sql
git commit -m "feat(db): price tracking schema, RPC and alert trigger"
```

---

## Task 2: Shadow-sync localStorage items into `public.links`

**Goal:** Whenever items change in localStorage, mirror them in `public.links` (idempotent upsert). Deletions mirror as deletes. UI source of truth stays in localStorage; failures are swallowed silently and logged to console so we don't block the UX.

**Files:**
- Create: `src/lib/link-sync.ts`
- Modify: `src/lib/store.ts`

- [ ] **Step 2.1: Create the sync helper.**

Create `src/lib/link-sync.ts`:

```typescript
import { supabase } from './supabase'
import type { Item } from './types'

type LinkRow = {
  id: string
  user_id: string
  name: string
  category: string
  price: number
  currency: string
  url: string
  image: string
}

function itemToRow(item: Item, userId: string): LinkRow {
  return {
    id: item.id,
    user_id: userId,
    name: item.name,
    category: item.category,
    price: item.price,
    currency: item.currency ?? 'BRL',
    url: item.url,
    image: item.image,
  }
}

export async function syncUpsertItem(userId: string, item: Item): Promise<void> {
  if (!supabase) return
  const { error } = await supabase
    .from('links')
    .upsert(itemToRow(item, userId), { onConflict: 'id' })
  if (error) console.warn('[link-sync] upsert failed', error.message)
}

export async function syncReplaceAll(userId: string, items: Item[]): Promise<void> {
  if (!supabase) return
  // Strategy: upsert everything we have, then delete rows on the server
  // that are no longer in the local set. Two round-trips, but safe.
  const rows = items.map((item) => itemToRow(item, userId))

  if (rows.length > 0) {
    const { error } = await supabase
      .from('links')
      .upsert(rows, { onConflict: 'id' })
    if (error) {
      console.warn('[link-sync] bulk upsert failed', error.message)
      return
    }
  }

  const keepIds = items.map((item) => item.id)
  // Build a NOT IN list. Supabase's `.not('id', 'in', '(a,b,c)')` requires a string.
  // When keepIds is empty, delete everything for the user.
  let query = supabase.from('links').delete().eq('user_id', userId)
  if (keepIds.length > 0) {
    query = query.not('id', 'in', `(${keepIds.map((id) => `"${id}"`).join(',')})`)
  }
  const { error: delErr } = await query
  if (delErr) console.warn('[link-sync] cleanup delete failed', delErr.message)
}

export async function syncDeleteItem(itemId: string): Promise<void> {
  if (!supabase) return
  const { error } = await supabase.from('links').delete().eq('id', itemId)
  if (error) console.warn('[link-sync] delete failed', error.message)
}
```

- [ ] **Step 2.2: Wire sync into the store.**

Modify `src/lib/store.ts`. After all existing code, mirror writes to Supabase. Replace the file with:

```typescript
import { useState, useCallback } from 'react'
import type { AppState, Item, Profile } from './types'
import { DEFAULT_CATEGORIES, DEFAULT_ITEMS, DEFAULT_PROFILE } from './data'
import { syncReplaceAll, syncUpsertItem } from './link-sync'

export const STORAGE_KEY = 'wishpool:v1'
export const EXT_QUEUE_KEY = 'wishpool:extQueue'

function storageKeyForUser(userId: string) {
  return `${STORAGE_KEY}:${userId}`
}

function loadState(storageKey: string, initialProfile: Profile): AppState {
  try {
    const raw = localStorage.getItem(storageKey)
    if (!raw) throw new Error('no data')
    const parsed = JSON.parse(raw)
    if (!parsed?.profile || !Array.isArray(parsed?.items)) throw new Error('invalid')
    const categories =
      Array.isArray(parsed.categories) && parsed.categories.length > 0
        ? parsed.categories
        : Array.from(new Set(parsed.items.map((i: Item) => i.category).filter(Boolean)))
    return {
      ...parsed,
      categories,
      profile: {
        ...DEFAULT_PROFILE,
        ...parsed.profile,
        email: parsed.profile.email || initialProfile.email,
      },
    }
  } catch {
    return {
      profile: initialProfile,
      items: DEFAULT_ITEMS,
      categories: DEFAULT_CATEGORIES,
    }
  }
}

function saveState(storageKey: string, state: AppState) {
  localStorage.setItem(storageKey, JSON.stringify(state))
}

function categoriesFromItems(items: Item[]) {
  return Array.from(new Set(items.map((item) => item.category.trim()).filter(Boolean)))
}

export function useStore(userId: string, initialProfile: Profile) {
  const storageKey = storageKeyForUser(userId)
  const [state, setState] = useState<AppState>(() => loadState(storageKey, initialProfile))

  const setItems = useCallback((items: Item[]) => {
    setState((prev) => {
      const next = { ...prev, items, categories: categoriesFromItems(items) }
      saveState(storageKey, next)
      return next
    })
    void syncReplaceAll(userId, items)
  }, [storageKey, userId])

  const addItem = useCallback((item: Item) => {
    setState((prev) => {
      const items = [item, ...prev.items]
      const categories = prev.categories.includes(item.category)
        ? prev.categories
        : [...prev.categories, item.category]
      const next = { ...prev, items, categories }
      saveState(storageKey, next)
      return next
    })
    void syncUpsertItem(userId, item)
  }, [storageKey, userId])

  const setCategories = useCallback((categories: string[]) => {
    setState((prev) => {
      const next = { ...prev, categories }
      saveState(storageKey, next)
      return next
    })
  }, [storageKey])

  const setProfile = useCallback((profile: Profile) => {
    setState((prev) => {
      const next = { ...prev, profile }
      saveState(storageKey, next)
      return next
    })
  }, [storageKey])

  return { state, setItems, addItem, setCategories, setProfile }
}
```

- [ ] **Step 2.3: Manual verification.**

1. `npm run dev`
2. Login on `http://localhost:5173`.
3. Add a new link via the composer.
4. Open Supabase Studio → Table Editor → `links`. The new row should appear with the exact `id` and `currency`.
5. Edit the link's name in the modal and save. Confirm the row in Supabase reflects the new name.
6. Delete a link. Confirm the row is gone from Supabase.
7. (Tolerance check) Open Network tab in DevTools → block requests to your Supabase domain → repeat the actions. UI should keep working; only console warnings appear.

- [ ] **Step 2.4: Commit.**

```bash
git add src/lib/link-sync.ts src/lib/store.ts
git commit -m "feat: shadow-sync localStorage items into public.links"
```

---

## Task 3: Shared HTML extractor (DOM + string variants)

**Goal:** A single source-of-truth extractor for `(amount, currency)` from a product page. The extension uses the DOM variant; the Edge Function uses the string variant (Deno fetch returns raw HTML).

**Files:**
- Create: `src/lib/price-extractor.ts`

- [ ] **Step 3.1: Create the extractor.**

Create `src/lib/price-extractor.ts`:

```typescript
// Pure extractor — no DOM dependencies on the string path,
// no fetch on the DOM path. Same precedence in both.

export interface ExtractedPrice {
  amount: number
  currency: string
}

type JsonLdNode = Record<string, unknown> | unknown[] | string | number | null

function pickOffer(node: JsonLdNode): ExtractedPrice | null {
  if (!node || typeof node !== 'object') return null
  if (Array.isArray(node)) {
    for (const child of node) {
      const found = pickOffer(child as JsonLdNode)
      if (found) return found
    }
    return null
  }
  const obj = node as Record<string, unknown>
  const type = obj['@type']
  const isProduct =
    type === 'Product' || (Array.isArray(type) && (type as unknown[]).includes('Product'))

  if (isProduct) {
    const offers = obj['offers']
    const fromOffers = pickOffer(offers as JsonLdNode)
    if (fromOffers) return fromOffers
  }

  // direct offer-like object
  const priceRaw = obj['price'] ?? obj['lowPrice']
  const currencyRaw = obj['priceCurrency'] ?? obj['currency']
  if (priceRaw != null && typeof currencyRaw === 'string') {
    const amount = Number(String(priceRaw).replace(/[^\d.,-]/g, '').replace(',', '.'))
    if (Number.isFinite(amount) && amount > 0) {
      return { amount, currency: currencyRaw.toUpperCase() }
    }
  }

  // Recurse into nested @graph / offers nodes
  for (const value of Object.values(obj)) {
    const found = pickOffer(value as JsonLdNode)
    if (found) return found
  }
  return null
}

function tryJsonLdScripts(scripts: string[]): ExtractedPrice | null {
  for (const raw of scripts) {
    try {
      const parsed = JSON.parse(raw) as JsonLdNode
      const found = pickOffer(parsed)
      if (found) return found
    } catch {
      // skip malformed JSON-LD
    }
  }
  return null
}

function parseAmount(raw: string | null | undefined): number | null {
  if (!raw) return null
  const trimmed = raw.trim().replace(/[^\d.,-]/g, '').replace(',', '.')
  if (!trimmed) return null
  const n = Number(trimmed)
  return Number.isFinite(n) && n > 0 ? n : null
}

// ----------------- DOM path (extension) -----------------

export function extractPriceFromDocument(doc: Document): ExtractedPrice | null {
  // 1. JSON-LD
  const ldScripts = Array.from(
    doc.querySelectorAll<HTMLScriptElement>('script[type="application/ld+json"]'),
  ).map((s) => s.textContent ?? '')
  const fromLd = tryJsonLdScripts(ldScripts)
  if (fromLd) return fromLd

  // 2. Open Graph
  const ogAmount = parseAmount(
    doc.querySelector<HTMLMetaElement>('meta[property="og:price:amount"]')?.content,
  )
  const ogCurrency = doc
    .querySelector<HTMLMetaElement>('meta[property="og:price:currency"]')
    ?.content?.toUpperCase()
  if (ogAmount && ogCurrency) return { amount: ogAmount, currency: ogCurrency }

  // 3. product:price:* (Facebook product feed format)
  const productAmount = parseAmount(
    doc.querySelector<HTMLMetaElement>('meta[property="product:price:amount"]')?.content,
  )
  const productCurrency = doc
    .querySelector<HTMLMetaElement>('meta[property="product:price:currency"]')
    ?.content?.toUpperCase()
  if (productAmount && productCurrency) return { amount: productAmount, currency: productCurrency }

  // 4. Microdata
  const microRoot = doc.querySelector('[itemtype$="schema.org/Product"]')
  if (microRoot) {
    const microAmount = parseAmount(
      (microRoot.querySelector('[itemprop="price"]') as HTMLMetaElement | null)?.content ??
        microRoot.querySelector('[itemprop="price"]')?.textContent,
    )
    const microCurrency =
      (microRoot.querySelector('[itemprop="priceCurrency"]') as HTMLMetaElement | null)?.content?.toUpperCase() ||
      microRoot.querySelector('[itemprop="priceCurrency"]')?.textContent?.toUpperCase()
    if (microAmount && microCurrency) return { amount: microAmount, currency: microCurrency }
  }

  return null
}

// ----------------- String path (Edge Function) -----------------

const META_RE = (prop: string) =>
  new RegExp(
    `<meta[^>]+property=["']${prop}["'][^>]*content=["']([^"']+)["']`,
    'i',
  )
const META_RE_REVERSE = (prop: string) =>
  new RegExp(
    `<meta[^>]+content=["']([^"']+)["'][^>]*property=["']${prop}["']`,
    'i',
  )

function readMeta(html: string, prop: string): string | null {
  const m = html.match(META_RE(prop)) ?? html.match(META_RE_REVERSE(prop))
  return m ? m[1] : null
}

const LD_BLOCK_RE =
  /<script[^>]*type=["']application\/ld\+json["'][^>]*>([\s\S]*?)<\/script>/gi

export function extractPriceFromHtml(html: string): ExtractedPrice | null {
  // 1. JSON-LD
  const blocks: string[] = []
  let match: RegExpExecArray | null
  while ((match = LD_BLOCK_RE.exec(html)) !== null) {
    blocks.push(match[1])
  }
  const fromLd = tryJsonLdScripts(blocks)
  if (fromLd) return fromLd

  // 2. Open Graph
  const ogAmount = parseAmount(readMeta(html, 'og:price:amount'))
  const ogCurrency = readMeta(html, 'og:price:currency')?.toUpperCase() ?? null
  if (ogAmount && ogCurrency) return { amount: ogAmount, currency: ogCurrency }

  // 3. product:price:*
  const productAmount = parseAmount(readMeta(html, 'product:price:amount'))
  const productCurrency = readMeta(html, 'product:price:currency')?.toUpperCase() ?? null
  if (productAmount && productCurrency) return { amount: productAmount, currency: productCurrency }

  return null
}
```

- [ ] **Step 3.2: Manual smoke test the extractor logic.**

Run from a Node REPL or quick scratch file:

```bash
node --input-type=module -e "
import('./src/lib/price-extractor.ts').then(({ extractPriceFromHtml }) => {
  const html = \`<script type='application/ld+json'>{\\\"@type\\\":\\\"Product\\\",\\\"offers\\\":{\\\"price\\\":\\\"99.90\\\",\\\"priceCurrency\\\":\\\"BRL\\\"}}</script>\`
  console.log(extractPriceFromHtml(html))
})"
```

Expected: `{ amount: 99.9, currency: 'BRL' }`.

(If `.ts` import fails because there's no tsx loader, transpile first with `npx tsc --noEmit src/lib/price-extractor.ts` to at least confirm the file type-checks. The runtime smoke test will happen in Task 4 inside the Edge Function and in Task 6 inside the extension.)

- [ ] **Step 3.3: Commit.**

```bash
git add src/lib/price-extractor.ts
git commit -m "feat: shared price extractor (JSON-LD, OG, microdata)"
```

---

## Task 4: Edge Function `refresh-stale-prices`

**Files:**
- Create: `supabase/functions/refresh-stale-prices/index.ts`
- Create: `supabase/functions/refresh-stale-prices/extractor.ts` (copy of `src/lib/price-extractor.ts` adapted to Deno — Edge Functions cannot import from `src/`)

- [ ] **Step 4.1: Copy the extractor into the function folder.**

Create `supabase/functions/refresh-stale-prices/extractor.ts`. Copy the **String path** (`extractPriceFromHtml`) plus its helpers (`pickOffer`, `tryJsonLdScripts`, `parseAmount`, `readMeta`, `META_RE`, `META_RE_REVERSE`, `LD_BLOCK_RE`, type `ExtractedPrice`, type `JsonLdNode`) from `src/lib/price-extractor.ts`. **Drop the DOM path** — Deno has no `Document`. Export only `extractPriceFromHtml` and `ExtractedPrice`.

- [ ] **Step 4.2: Create the function.**

Create `supabase/functions/refresh-stale-prices/index.ts`:

```typescript
// deno-lint-ignore-file no-explicit-any
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2.98.0'
import { extractPriceFromHtml } from './extractor.ts'

const SUPABASE_URL = Deno.env.get('SUPABASE_URL')!
const SERVICE_ROLE = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!

const BATCH_SIZE = 50
const STALE_AFTER_DAYS = 7
const FETCH_TIMEOUT_MS = 5000
const USER_AGENT =
  'Mozilla/5.0 (compatible; BagPriceTracker/1.0; +https://bagapp.io)'

interface LinkRow {
  id: string
  user_id: string
  url: string
  currency: string
  price: number
}

async function fetchWithTimeout(url: string, ms: number): Promise<Response> {
  const ctrl = new AbortController()
  const t = setTimeout(() => ctrl.abort(), ms)
  try {
    return await fetch(url, {
      signal: ctrl.signal,
      headers: { 'User-Agent': USER_AGENT, 'Accept-Language': 'pt-BR,pt;q=0.9,en;q=0.8' },
      redirect: 'follow',
    })
  } finally {
    clearTimeout(t)
  }
}

async function processOne(
  admin: ReturnType<typeof createClient>,
  row: LinkRow,
): Promise<{ status: 'ok' | 'parse_fail' | 'fetch_fail' }> {
  let html: string | null = null
  try {
    const res = await fetchWithTimeout(row.url, FETCH_TIMEOUT_MS)
    if (!res.ok) return { status: 'fetch_fail' }
    html = await res.text()
  } catch {
    return { status: 'fetch_fail' }
  }

  const extracted = extractPriceFromHtml(html)
  if (!extracted) return { status: 'parse_fail' }
  if (extracted.currency !== row.currency) return { status: 'parse_fail' }
  if (extracted.amount === row.price) return { status: 'ok' } // nothing to do

  // Insert directly using service role; bypass RLS but reuse the trigger.
  const { error } = await admin
    .from('link_price_history')
    .insert({
      link_id: row.id,
      user_id: row.user_id,
      price: extracted.amount,
      currency: extracted.currency,
      source: 'cron',
    })
  if (error) return { status: 'parse_fail' } // treat as soft failure; will retry tomorrow
  return { status: 'ok' }
}

Deno.serve(async () => {
  const admin = createClient(SUPABASE_URL, SERVICE_ROLE, { auth: { persistSession: false } })
  const staleCutoff = new Date(
    Date.now() - STALE_AFTER_DAYS * 24 * 60 * 60 * 1000,
  ).toISOString()

  const { data, error } = await admin
    .from('links')
    .select('id, user_id, url, currency, price')
    .or(`last_check_at.is.null,last_check_at.lt.${staleCutoff}`)
    .order('last_check_at', { ascending: true, nullsFirst: true })
    .limit(BATCH_SIZE)

  if (error) {
    return new Response(JSON.stringify({ error: error.message }), {
      status: 500,
      headers: { 'content-type': 'application/json' },
    })
  }

  const rows = (data ?? []) as LinkRow[]
  const results: { id: string; status: string }[] = []

  for (const row of rows) {
    const { status } = await processOne(admin, row)
    await admin
      .from('links')
      .update({ last_check_at: new Date().toISOString(), last_check_status: status })
      .eq('id', row.id)
    results.push({ id: row.id, status })
  }

  return new Response(JSON.stringify({ processed: results.length, results }), {
    headers: { 'content-type': 'application/json' },
  })
})
```

- [ ] **Step 4.3: Deploy the function.**

Run: `supabase functions deploy refresh-stale-prices --no-verify-jwt`
(`--no-verify-jwt` because pg_cron will call it via service role from the DB, not via a user JWT.)

Expected: `Deployed Function refresh-stale-prices`.

If the CLI is not set up: in Supabase Studio → Edge Functions → New Function → paste both files. Disable JWT verification in the function's settings.

- [ ] **Step 4.4: Smoke test from the dashboard.**

In Supabase Studio → Edge Functions → `refresh-stale-prices` → Invoke (or `curl`):

```bash
curl -X POST "$SUPABASE_URL/functions/v1/refresh-stale-prices" \
  -H "Authorization: Bearer $SUPABASE_SERVICE_ROLE_KEY" \
  -H "Content-Type: application/json"
```

Expected: JSON with `processed: N`, where N ≤ 50. Pick any returned `id` and check in `public.links`: `last_check_at` is now set and `last_check_status` is one of `ok`/`parse_fail`/`fetch_fail`.

Verify that at least one item that was reachable produced a status of `ok`. If everything is `fetch_fail`, double-check the URL is publicly reachable — protected pages will always fail in the cron path (extension covers those).

- [ ] **Step 4.5: Commit.**

```bash
git add supabase/functions/refresh-stale-prices/
git commit -m "feat(edge): refresh-stale-prices function with shared extractor"
```

---

## Task 5: Schedule the cron via pg_cron + pg_net

**Files:**
- Modify: `supabase/migrations/2026-05-23-price-tracking.sql` (append at the bottom, or create a second migration file)

We use `pg_cron` to fire daily and `pg_net.http_post` to call the Edge Function. Both extensions are available in Supabase.

- [ ] **Step 5.1: Enable extensions and create the job.**

Append the following to `supabase/migrations/2026-05-23-price-tracking.sql` (or create `supabase/migrations/2026-05-23-price-tracking-cron.sql` with the same contents):

```sql
create extension if not exists pg_cron;
create extension if not exists pg_net;

-- Wrap the HTTP call in a function so the cron command stays readable.
create or replace function public.cron_refresh_stale_prices()
returns void
language plpgsql
security definer
set search_path = public
as $$
declare
  v_url text := current_setting('app.settings.functions_url', true);
  v_key text := current_setting('app.settings.service_role_key', true);
begin
  if v_url is null or v_key is null then
    raise notice 'cron_refresh_stale_prices: missing app.settings; skipping';
    return;
  end if;

  perform net.http_post(
    url := v_url || '/refresh-stale-prices',
    headers := jsonb_build_object(
      'Authorization', 'Bearer ' || v_key,
      'Content-Type',  'application/json'
    ),
    body := '{}'::jsonb
  );
end;
$$;

-- Schedule at 04:00 UTC daily. Use replace-or-insert pattern.
do $$
begin
  if exists (select 1 from cron.job where jobname = 'refresh-stale-prices') then
    perform cron.unschedule('refresh-stale-prices');
  end if;
  perform cron.schedule(
    'refresh-stale-prices',
    '0 4 * * *',
    $cron$ select public.cron_refresh_stale_prices(); $cron$
  );
end $$;
```

- [ ] **Step 5.2: Provision the runtime settings.**

In Supabase Studio → SQL Editor, run (replace with your real values):

```sql
alter database postgres set app.settings.functions_url
  to 'https://<PROJECT_REF>.functions.supabase.co';
alter database postgres set app.settings.service_role_key
  to '<SERVICE_ROLE_KEY>';
```

> Why `alter database` and not `set session`: pg_cron jobs run in a separate session and need these settings persisted at the database level.

You can read them back with:

```sql
show app.settings.functions_url;
show app.settings.service_role_key;
```

- [ ] **Step 5.3: Apply the migration (extensions + function + schedule).**

Run the SQL from Step 5.1 in Studio. Expect "Success. No rows returned".

- [ ] **Step 5.4: Trigger the cron manually to verify wiring.**

In Studio SQL Editor:

```sql
select public.cron_refresh_stale_prices();
-- then inspect:
select * from cron.job_run_details
  where jobname = 'refresh-stale-prices' or command ilike '%cron_refresh_stale_prices%'
  order by start_time desc limit 5;

select id, last_check_at, last_check_status from public.links
  order by last_check_at desc nulls last limit 10;
```

Expect: at least one row in `link_price_history` (if a stale link was found and successfully fetched) and `last_check_at` populated for processed links.

- [ ] **Step 5.5: Commit.**

```bash
git add supabase/migrations/
git commit -m "feat(db): schedule daily refresh-stale-prices via pg_cron"
```

---

## Task 6: Extension — content script that captures price on visit

**Files:**
- Create: `extension/price-tracker.src.js`
- Modify: `extension/manifest.json`
- Modify: `scripts/build-extension.mjs`

The bundled output is `extension/price-tracker.js` (already in the artifact ignore patterns if any; commit both source and bundle since the rest of the extension does the same).

- [ ] **Step 6.1: Write the source content script.**

Create `extension/price-tracker.src.js`:

```javascript
import { extractPriceFromDocument } from '../src/lib/price-extractor.ts'

const SESSION_KEY = 'wishpoolExtSession'
const LINKS_INDEX_KEY = 'wishpoolLinksIndex' // { [url]: { itemId, currency, lastPrice } }
const LAST_FIRED_KEY = 'wishpoolPriceTrackerFired' // { [url]: timestamp }
const MIN_FIRE_INTERVAL_MS = 60 * 60 * 1000 // 1h dedup per URL

const SUPABASE_URL = 'https://okpxxpjskegpohowqqry.supabase.co'
const SUPABASE_ANON_KEY = 'sb_publishable_i_N5por1Imv5eL20Y7VwRw_stIIpGCa'

function normalizeUrl(raw) {
  try {
    const u = new URL(raw)
    u.hash = ''
    // strip common tracking params to align with what's saved in `links.url`
    const drop = new Set([
      'utm_source','utm_medium','utm_campaign','utm_term','utm_content',
      'gclid','fbclid','mc_cid','mc_eid','_ga',
    ])
    const next = new URLSearchParams()
    for (const [k, v] of u.searchParams) {
      if (!drop.has(k.toLowerCase())) next.set(k, v)
    }
    u.search = next.toString() ? `?${next.toString()}` : ''
    return u.toString()
  } catch {
    return raw
  }
}

async function readIndex() {
  const stored = await chrome.storage.local.get([LINKS_INDEX_KEY, LAST_FIRED_KEY, SESSION_KEY])
  return {
    index: stored[LINKS_INDEX_KEY] || {},
    fired: stored[LAST_FIRED_KEY] || {},
    session: stored[SESSION_KEY] || null,
  }
}

async function recordSnapshot(session, linkId, price, currency) {
  const res = await fetch(`${SUPABASE_URL}/rest/v1/rpc/record_price_snapshot`, {
    method: 'POST',
    headers: {
      apikey: SUPABASE_ANON_KEY,
      Authorization: `Bearer ${session.accessToken}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({
      p_link_id: linkId,
      p_price: price,
      p_currency: currency,
      p_source: 'extension',
    }),
  })
  if (!res.ok) {
    const text = await res.text().catch(() => '')
    console.warn('[bag price-tracker] RPC failed', res.status, text)
  }
}

async function run() {
  const { index, fired, session } = await readIndex()
  if (!session?.accessToken) return

  const here = normalizeUrl(window.location.href)
  const entry = index[here]
  if (!entry) return

  const now = Date.now()
  const lastFired = fired[here] || 0
  if (now - lastFired < MIN_FIRE_INTERVAL_MS) return

  const extracted = extractPriceFromDocument(document)
  if (!extracted) return
  if (extracted.currency !== entry.currency) return
  if (extracted.amount === entry.lastPrice) {
    // still record fire so we don't re-extract for an hour
    await chrome.storage.local.set({
      [LAST_FIRED_KEY]: { ...fired, [here]: now },
    })
    return
  }

  await recordSnapshot(session, entry.itemId, extracted.amount, extracted.currency)

  await chrome.storage.local.set({
    [LINKS_INDEX_KEY]: {
      ...index,
      [here]: { ...entry, lastPrice: extracted.amount },
    },
    [LAST_FIRED_KEY]: { ...fired, [here]: now },
  })
}

// Wait until DOM is fully parsed (`document_idle` in manifest already does this,
// but JSON-LD may be injected after; give it a short grace window).
setTimeout(() => { void run().catch((err) => console.warn('[bag price-tracker]', err)) }, 1500)
```

- [ ] **Step 6.2: Update the manifest.**

Modify `extension/manifest.json`:

```json
{
  "manifest_version": 3,
  "name": "Bag",
  "description": "Salve os links das suas lojas favoritas da internet num único lugar.",
  "version": "0.2.0",
  "action": {
    "default_title": "Salvar no Bag",
    "default_popup": "popup.html"
  },
  "permissions": ["activeTab", "tabs", "storage", "identity", "alarms"],
  "host_permissions": [
    "https://bagapp.io/*",
    "https://okpxxpjskegpohowqqry.supabase.co/*",
    "<all_urls>"
  ],
  "content_scripts": [
    {
      "matches": ["https://bagapp.io/*"],
      "js": ["sync-app.js"],
      "run_at": "document_idle"
    },
    {
      "matches": ["<all_urls>"],
      "js": ["price-tracker.js"],
      "run_at": "document_idle"
    }
  ]
}
```

> Note: `<all_urls>` triggers a stronger permission prompt for users. This is required for on-visit capture. Document this in the next extension release notes.

- [ ] **Step 6.3: Teach the build script to bundle the content script.**

Modify `scripts/build-extension.mjs`. After `buildPopupScript`, add a new function `buildPriceTracker` and call it from `main`:

```javascript
const PRICE_TRACKER_SOURCE = 'extension/price-tracker.src.js'
const PRICE_TRACKER_OUTPUT = 'extension/price-tracker.js'

async function buildPriceTracker() {
  await esbuild({
    entryPoints: [PRICE_TRACKER_SOURCE],
    outfile: PRICE_TRACKER_OUTPUT,
    bundle: true,
    format: 'iife',
    target: ['chrome109'],
    minify: false,
    alias: {
      '@': path.resolve(process.cwd(), 'src'),
    },
  })
}

async function main() {
  await buildPopupScript()
  await buildPopupCss()
  await buildPriceTracker()
  console.log('Extension popup built: popup.js + popup.css + price-tracker.js')
}
```

(IIFE format avoids ESM module concerns inside content scripts.)

- [ ] **Step 6.4: Build and load the extension.**

Run: `npm run build:extension`
Expected: log mentions `price-tracker.js` and `extension/price-tracker.js` exists.

- [ ] **Step 6.5: Manual verification (sanity load only — index is populated in Task 7).**

1. Open `chrome://extensions` → reload the Bag extension (from the `extension/` folder in Developer Mode).
2. Navigate to any product page.
3. Open DevTools → Console for that page. You should see no errors from `price-tracker.js` (it silently bails out because the index is empty).

- [ ] **Step 6.6: Commit.**

```bash
git add extension/manifest.json extension/price-tracker.src.js extension/price-tracker.js scripts/build-extension.mjs
git commit -m "feat(ext): price-tracker content script + build wiring"
```

---

## Task 7: Extension — sync the URL index from Supabase

**Files:**
- Modify: `extension/popup.jsx`
- Modify: `extension/sync-app.js`

We populate `wishpoolLinksIndex` from `public.links` on (a) popup open, (b) `chrome.alarms` periodic, (c) when the web session reaches the content script.

- [ ] **Step 7.1: Add a shared sync routine to `popup.jsx`.**

Modify `extension/popup.jsx`. Just below the imports/constants (around line 40), add:

```javascript
const LINKS_INDEX_KEY = 'wishpoolLinksIndex'
const LINKS_INDEX_ALARM = 'wishpool-links-index-refresh'

async function syncLinksIndex(session) {
  if (!session?.accessToken) return
  const res = await fetch(
    `${SUPABASE_URL}/rest/v1/links?select=id,url,currency,price`,
    {
      headers: {
        apikey: SUPABASE_ANON_KEY,
        Authorization: `Bearer ${session.accessToken}`,
      },
    },
  )
  if (!res.ok) return
  const rows = await res.json()
  const index = {}
  for (const row of rows) {
    if (!row.url) continue
    index[row.url] = { itemId: row.id, currency: row.currency || 'BRL', lastPrice: row.price }
  }
  await chrome.storage.local.set({ [LINKS_INDEX_KEY]: index })
}
```

Then, inside the `bootstrap` async function (after `setSession(nextSession)`), call it:

```javascript
if (nextSession?.accessToken) {
  void syncLinksIndex(nextSession)
}
```

And inside the storage change handler for `SESSION_KEY`:

```javascript
if (changes[SESSION_KEY]) {
  const next = changes[SESSION_KEY].newValue || null
  setSession(next)
  if (next?.accessToken) void syncLinksIndex(next)
}
```

And register an hourly alarm — add this block at the bottom of the existing `useEffect` (right before the cleanup return):

```javascript
chrome.alarms.create(LINKS_INDEX_ALARM, { periodInMinutes: 60 })
const alarmListener = (alarm) => {
  if (alarm.name !== LINKS_INDEX_ALARM) return
  void chrome.storage.local.get([SESSION_KEY]).then((stored) => {
    const s = stored[SESSION_KEY]
    if (s) void syncLinksIndex(s)
  })
}
chrome.alarms.onAlarm.addListener(alarmListener)
```

And in the cleanup return, add `chrome.alarms.onAlarm.removeListener(alarmListener)`.

- [ ] **Step 7.2: Also sync the index from `sync-app.js` when the user is logged in on the web app.**

Modify `extension/sync-app.js`. Add a helper near the top:

```javascript
const LINKS_INDEX_KEY = 'wishpoolLinksIndex'
const SUPABASE_REST_URL = 'https://okpxxpjskegpohowqqry.supabase.co/rest/v1'
const SUPABASE_ANON_KEY_PUBLIC = 'sb_publishable_i_N5por1Imv5eL20Y7VwRw_stIIpGCa'

async function syncLinksIndexFromWeb(session) {
  if (!session?.accessToken) return
  try {
    const res = await fetch(`${SUPABASE_REST_URL}/links?select=id,url,currency,price`, {
      headers: {
        apikey: SUPABASE_ANON_KEY_PUBLIC,
        Authorization: `Bearer ${session.accessToken}`,
      },
    })
    if (!res.ok) return
    const rows = await res.json()
    const index = {}
    for (const row of rows) {
      if (!row.url) continue
      index[row.url] = { itemId: row.id, currency: row.currency || 'BRL', lastPrice: row.price }
    }
    await chrome.storage.local.set({ [LINKS_INDEX_KEY]: index })
  } catch {
    // swallow
  }
}
```

In `syncAppToExtensionState`, after `lastSessionToken = session.accessToken`, call:

```javascript
void syncLinksIndexFromWeb(session)
```

- [ ] **Step 7.3: Rebuild and verify.**

Run: `npm run build:extension`
Then in `chrome://extensions`, reload the extension.

Open the popup once while logged in. Open the extension's service worker console (Inspect views → service worker → Application → Storage → Extension storage → Local) and confirm `wishpoolLinksIndex` is populated with your saved items.

- [ ] **Step 7.4: End-to-end smoke test of the capture path.**

1. Save a link from the popup pointing to a known Shopify/Nuvemshop product whose JSON-LD includes `Product.offers.price`.
2. Wait for `syncLinksIndex` to repopulate (or close/reopen the popup).
3. Navigate to that product page.
4. Wait ~2s, then open Supabase Studio → `link_price_history`. A new row with `source='extension'` should be present **only if** the page's current price differs from the saved price.
5. If the prices match, change the price in the DB (`update links set price = price + 1 where id = '<id>'`) and revisit — a row should appear.

- [ ] **Step 7.5: Commit.**

```bash
git add extension/popup.jsx extension/sync-app.js extension/popup.js
git commit -m "feat(ext): sync links URL index for price-tracker"
```

---

## Task 8: App — `usePriceAlert` hook

**Files:**
- Create: `src/lib/price-history.ts`
- Create: `src/lib/use-price-alert.ts`

- [ ] **Step 8.1: Create the data helpers.**

Create `src/lib/price-history.ts`:

```typescript
import { supabase } from './supabase'

export interface PriceAlert {
  id: string
  link_id: string
  previous_price: number
  current_price: number
  drop_amount: number
  created_at: string
}

export interface PricePoint {
  price: number
  currency: string
  captured_at: string
}

export async function fetchLatestAlert(linkId: string): Promise<PriceAlert | null> {
  if (!supabase) return null
  const { data, error } = await supabase
    .from('price_alerts')
    .select('id, link_id, previous_price, current_price, drop_amount, created_at')
    .eq('link_id', linkId)
    .is('read_at', null)
    .order('created_at', { ascending: false })
    .limit(1)
    .maybeSingle()
  if (error) {
    console.warn('[price-history] fetchLatestAlert', error.message)
    return null
  }
  return data
}

export async function fetchPriceHistory(linkId: string): Promise<PricePoint[]> {
  if (!supabase) return []
  const { data, error } = await supabase
    .from('link_price_history')
    .select('price, currency, captured_at')
    .eq('link_id', linkId)
    .order('captured_at', { ascending: true })
  if (error) {
    console.warn('[price-history] fetchPriceHistory', error.message)
    return []
  }
  return data ?? []
}

export async function markAlertsRead(linkId: string): Promise<void> {
  if (!supabase) return
  const { error } = await supabase
    .from('price_alerts')
    .update({ read_at: new Date().toISOString() })
    .eq('link_id', linkId)
    .is('read_at', null)
  if (error) console.warn('[price-history] markAlertsRead', error.message)
}
```

- [ ] **Step 8.2: Create the hook.**

Create `src/lib/use-price-alert.ts`:

```typescript
import { useEffect, useState } from 'react'
import { fetchLatestAlert, type PriceAlert } from './price-history'

export interface PriceAlertSummary {
  dropAmount: number
  dropPct: number
  previousPrice: number
  currentPrice: number
  raw: PriceAlert
}

export function usePriceAlert(itemId: string | null | undefined): PriceAlertSummary | null {
  const [summary, setSummary] = useState<PriceAlertSummary | null>(null)

  useEffect(() => {
    let cancelled = false
    if (!itemId) {
      setSummary(null)
      return
    }
    void fetchLatestAlert(itemId).then((alert) => {
      if (cancelled || !alert) return
      const dropPct =
        alert.previous_price > 0 ? (alert.drop_amount / alert.previous_price) * 100 : 0
      setSummary({
        dropAmount: alert.drop_amount,
        dropPct,
        previousPrice: alert.previous_price,
        currentPrice: alert.current_price,
        raw: alert,
      })
    })
    return () => {
      cancelled = true
    }
  }, [itemId])

  return summary
}
```

- [ ] **Step 8.3: Commit.**

```bash
git add src/lib/price-history.ts src/lib/use-price-alert.ts
git commit -m "feat: usePriceAlert hook and Supabase helpers"
```

---

## Task 9: App — badge on `CardLink`

**Files:**
- Modify: `src/components/CardLink.tsx`

- [ ] **Step 9.1: Wire the hook into the card.**

Modify `src/components/CardLink.tsx`. Add imports and render a small badge below the price.

Replace the import block at the top:

```typescript
import { Trash2, TrendingDown } from 'lucide-react'
import type { Item } from '../lib/types'
import { formatCurrency } from '../lib/currencies'
import { Button } from '@/components/ui/button'
import LinkIcon from '../assets/images/link-icon.svg'
import { usePriceAlert } from '@/lib/use-price-alert'
```

Inside the `CardLink` component body, after the props destructure, add:

```typescript
const alert = usePriceAlert(item.id)
```

Replace the `<span>` that renders `formatCurrency(item.price, ...)` (the line `<span className="font-medium text-base whitespace-nowrap">{formatCurrency(item.price, item.currency ?? 'BRL')}</span>`) with a stack that includes the badge:

```tsx
<div className="flex flex-col items-end gap-0.5">
  <span className="font-medium text-base whitespace-nowrap">
    {formatCurrency(item.price, item.currency ?? 'BRL')}
  </span>
  {alert && (
    <span className="inline-flex items-center gap-1 text-xs font-medium text-emerald-700">
      <TrendingDown className="size-3" aria-hidden="true" />
      <span>
        -{formatCurrency(alert.dropAmount, item.currency ?? 'BRL')}
      </span>
      <span className="text-emerald-600/80">({alert.dropPct.toFixed(0)}%)</span>
    </span>
  )}
</div>
```

- [ ] **Step 9.2: Manual verification.**

1. `npm run dev`.
2. In Supabase Studio, manually insert a price drop for one of your items:
   ```sql
   insert into public.link_price_history (link_id, user_id, price, currency, source)
   values ('<LINK_ID>', '<USER_ID>', <current_price + 50>, 'BRL', 'manual');
   insert into public.link_price_history (link_id, user_id, price, currency, source)
   values ('<LINK_ID>', '<USER_ID>', <current_price>, 'BRL', 'manual');
   ```
   (Two inserts so the trigger sees a previous higher price and creates the alert.)
3. Refresh the app. The card for that item should show the green `↓ -R$ XX (Y%)` badge.

- [ ] **Step 9.3: Commit.**

```bash
git add src/components/CardLink.tsx
git commit -m "feat: price drop badge on CardLink"
```

---

## Task 10: App — sparkline + history in `ItemModal`

**Files:**
- Create: `src/components/PriceSparkline.tsx`
- Modify: `src/components/ItemModal.tsx`

- [ ] **Step 10.1: Build the sparkline component.**

Create `src/components/PriceSparkline.tsx`:

```tsx
import { useMemo } from 'react'
import { formatCurrency } from '@/lib/currencies'
import type { PricePoint } from '@/lib/price-history'

interface PriceSparklineProps {
  points: PricePoint[]
  currency: string
  width?: number
  height?: number
}

export function PriceSparkline({
  points,
  currency,
  width = 480,
  height = 80,
}: PriceSparklineProps) {
  const view = useMemo(() => {
    if (points.length < 2) return null
    const xs = points.map((p) => new Date(p.captured_at).getTime())
    const ys = points.map((p) => p.price)
    const minX = Math.min(...xs)
    const maxX = Math.max(...xs)
    const minY = Math.min(...ys)
    const maxY = Math.max(...ys)
    const xRange = maxX - minX || 1
    const yRange = maxY - minY || 1
    const padX = 4
    const padY = 6
    const innerW = width - padX * 2
    const innerH = height - padY * 2

    const toX = (t: number) => padX + ((t - minX) / xRange) * innerW
    const toY = (p: number) => padY + (1 - (p - minY) / yRange) * innerH

    const path = points
      .map((p, i) => {
        const x = toX(new Date(p.captured_at).getTime())
        const y = toY(p.price)
        return `${i === 0 ? 'M' : 'L'}${x.toFixed(2)},${y.toFixed(2)}`
      })
      .join(' ')

    const last = points[points.length - 1]
    return { path, minY, maxY, last }
  }, [points, width, height])

  if (!view) {
    return (
      <p className="text-sm text-slate-500">
        Ainda não temos histórico de preço pra mostrar.
      </p>
    )
  }

  return (
    <div className="flex flex-col gap-2">
      <svg
        width={width}
        height={height}
        viewBox={`0 0 ${width} ${height}`}
        className="block w-full h-auto"
        role="img"
        aria-label="Histórico de preço"
      >
        <path
          d={view.path}
          fill="none"
          stroke="#289717"
          strokeWidth={1.75}
          strokeLinecap="round"
          strokeLinejoin="round"
        />
      </svg>
      <div className="flex justify-between text-xs text-slate-500">
        <span>Mín {formatCurrency(view.minY, currency)}</span>
        <span>Atual {formatCurrency(view.last.price, currency)}</span>
        <span>Máx {formatCurrency(view.maxY, currency)}</span>
      </div>
    </div>
  )
}
```

- [ ] **Step 10.2: Lazy-load history in the modal and mark alerts read on close.**

Modify `src/components/ItemModal.tsx`. At the top of the file, add:

```typescript
import { useEffect, useMemo, useState } from 'react'
import { fetchPriceHistory, markAlertsRead, type PricePoint } from '@/lib/price-history'
import { PriceSparkline } from '@/components/PriceSparkline'
```

(`useEffect` is added to the existing `useMemo, useState` import line.)

Inside the component, after the existing `useState` declarations, add:

```typescript
const [history, setHistory] = useState<PricePoint[]>([])

useEffect(() => {
  if (mode !== 'edit' || !item?.id) return
  let cancelled = false
  void fetchPriceHistory(item.id).then((points) => {
    if (!cancelled) setHistory(points)
  })
  return () => {
    cancelled = true
  }
}, [mode, item?.id])
```

Render the sparkline above the form. Find the line `<form className="mt-4 flex flex-col gap-3" onSubmit={handleSubmit}>` and insert **just before** it:

```tsx
{mode === 'edit' && item && (
  <div className="mt-4 rounded-md border border-slate-200 p-3">
    <p className="mb-2 text-xs font-medium uppercase tracking-wide text-slate-500">
      Histórico de preço
    </p>
    <PriceSparkline points={history} currency={item.currency ?? 'BRL'} />
  </div>
)}
```

Change `onClose` to mark alerts read when the modal closes. Update the dialog's `onOpenChange` from:

```tsx
<Dialog open onOpenChange={(open) => !open && onClose()}>
```

to:

```tsx
<Dialog
  open
  onOpenChange={(open) => {
    if (!open) {
      if (item?.id) void markAlertsRead(item.id)
      onClose()
    }
  }}
>
```

- [ ] **Step 10.3: Manual verification.**

1. With the dev server running and an item that already has multiple `link_price_history` rows, click "Editar" on its card.
2. The modal should show the "Histórico de preço" panel with a sparkline; min/atual/máx values match the rows in `link_price_history`.
3. Close the modal. Refresh the page. The badge from Task 9 should be gone for that item (`read_at` now set in `price_alerts`).
4. Edge case: open an item with 0 or 1 history rows. The fallback text "Ainda não temos histórico de preço pra mostrar." should render.

- [ ] **Step 10.4: Commit.**

```bash
git add src/components/PriceSparkline.tsx src/components/ItemModal.tsx
git commit -m "feat: price history sparkline in ItemModal and mark-read on close"
```

---

## Task 11: End-to-end QA pass

This is the last gate before declaring done.

- [ ] **Step 11.1: Run a 5-store coverage check.**

Add five **real** product URLs to your account (use the extension popup). Pick a variety:

1. A Shopify or Nuvemshop store (e.g., any clean SSR brand store).
2. Mercado Livre.
3. Magalu or Americanas.
4. Amazon BR (expected to fail in cron, succeed via extension).
5. One international store (e.g., a Nike US product page).

Wait at least 24h **or** trigger `select public.cron_refresh_stale_prices();` manually after first resetting `last_check_at`:

```sql
update public.links set last_check_at = null where user_id = '<USER_ID>';
select public.cron_refresh_stale_prices();
select id, url, last_check_at, last_check_status from public.links where user_id = '<USER_ID>';
```

Acceptance: at least 3 of 5 should be `ok`. The failures are expected for known anti-bot sites.

- [ ] **Step 11.2: Run the extension capture pass.**

For each of the 5 URLs, navigate to the page. Check `link_price_history` for new rows tagged `source='extension'` when the price actually differs.

- [ ] **Step 11.3: Verify the alert UX.**

For one of the items, manually simulate a drop:

```sql
insert into public.link_price_history (link_id, user_id, price, currency, source)
values ('<LINK_ID>', '<USER_ID>',
        (select price from public.links where id = '<LINK_ID>') - 5,
        (select currency from public.links where id = '<LINK_ID>'),
        'manual');
```

Refresh the app. Confirm:
- ✅ Badge appears on the card.
- ✅ Modal shows sparkline.
- ✅ Closing the modal removes the badge after refresh.

- [ ] **Step 11.4: Verify zero-cost telemetry.**

Open Supabase Studio → Reports / Usage.
- ✅ Edge Function invocations < 100/day.
- ✅ Database size growth negligible (< 1MB/week with current item count).
- ✅ No paid extensions or third-party services were enabled.

- [ ] **Step 11.5: Commit any tweaks discovered during QA and write a short changelog.**

```bash
git commit -am "chore: price tracking QA fixes"
```

Append a single line to `README.md` under "O que já está implementado":

```markdown
- Acompanhamento automático de preço com histórico e alerta de queda no card
```

```bash
git add README.md
git commit -m "docs: mention price tracking feature in README"
```

---

## Self-review (already performed)

- **Spec coverage:** Tasks 1 + 5 cover schema + RPC + trigger + cron; Tasks 3 + 4 cover the Edge Function and extractor; Tasks 6 + 7 cover the extension capture path; Tasks 8–10 cover the app UI (badge + sparkline + mark-read); Task 2 adds the shadow-sync that the spec depended on implicitly.
- **No placeholders:** every code step contains executable code; every shell step includes the command and expected outcome.
- **Type consistency:** `extractPriceFromHtml` and `extractPriceFromDocument` share the `ExtractedPrice` shape; `usePriceAlert` returns a typed `PriceAlertSummary`; `LinkRow`/`PriceAlert`/`PricePoint` are referenced consistently across helpers and consumers.
