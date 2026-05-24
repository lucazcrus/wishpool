// Deno-side price extractor. Mirrors the string path of
// src/lib/price-extractor.ts. Keep them in sync.

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

  const priceRaw = obj['price'] ?? obj['lowPrice']
  const currencyRaw = obj['priceCurrency'] ?? obj['currency']
  if (priceRaw != null && typeof currencyRaw === 'string') {
    const amount = Number(String(priceRaw).replace(/[^\d.,-]/g, '').replace(',', '.'))
    if (Number.isFinite(amount) && amount > 0) {
      return { amount, currency: currencyRaw.toUpperCase() }
    }
  }

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
  const blocks: string[] = []
  let match: RegExpExecArray | null
  while ((match = LD_BLOCK_RE.exec(html)) !== null) {
    blocks.push(match[1])
  }
  const fromLd = tryJsonLdScripts(blocks)
  if (fromLd) return fromLd

  const ogAmount = parseAmount(readMeta(html, 'og:price:amount'))
  const ogCurrency = readMeta(html, 'og:price:currency')?.toUpperCase() ?? null
  if (ogAmount && ogCurrency) return { amount: ogAmount, currency: ogCurrency }

  const productAmount = parseAmount(readMeta(html, 'product:price:amount'))
  const productCurrency = readMeta(html, 'product:price:currency')?.toUpperCase() ?? null
  if (productAmount && productCurrency) return { amount: productAmount, currency: productCurrency }

  return null
}
