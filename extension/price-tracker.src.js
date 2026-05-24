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

setTimeout(() => { void run().catch((err) => console.warn('[bag price-tracker]', err)) }, 1500)
