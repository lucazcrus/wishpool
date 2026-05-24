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
  if (extracted.amount === row.price) return { status: 'ok' }

  const { error } = await admin
    .from('link_price_history')
    .insert({
      link_id: row.id,
      user_id: row.user_id,
      price: extracted.amount,
      currency: extracted.currency,
      source: 'cron',
    })
  if (error) return { status: 'parse_fail' }
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
