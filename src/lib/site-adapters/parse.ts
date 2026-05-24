// Shared parsing helpers for per-domain price adapters (extension-only).

export function parseLocalizedPrice(raw: string | null | undefined): number | null {
  if (!raw) return null
  const cleaned = raw.replace(/[^\d.,-]/g, '')
  if (!cleaned) return null

  const lastDot = cleaned.lastIndexOf('.')
  const lastComma = cleaned.lastIndexOf(',')

  let normalized: string
  if (lastDot === -1 && lastComma === -1) {
    normalized = cleaned
  } else if (lastComma > lastDot) {
    normalized = cleaned.replace(/\./g, '').replace(',', '.')
  } else {
    normalized = cleaned.replace(/,/g, '')
  }

  const n = Number(normalized)
  return Number.isFinite(n) && n > 0 ? n : null
}

export function symbolToCurrency(text: string): string | null {
  if (text.includes('R$')) return 'BRL'
  if (text.includes('US$')) return 'USD'
  if (text.includes('€')) return 'EUR'
  if (text.includes('£')) return 'GBP'
  if (text.includes('¥')) return 'JPY'
  if (text.includes('CHF')) return 'CHF'
  if (/[A-Z]{0,2}\$/.test(text)) return 'USD'
  return null
}

const EUR_TLDS = new Set([
  '.de', '.fr', '.it', '.es', '.nl', '.pt', '.ie', '.be',
  '.at', '.fi', '.lu', '.gr', '.sk', '.si', '.lt', '.lv',
  '.ee', '.eu',
])

export function currencyFromHostname(hostname: string): string | null {
  const h = hostname.toLowerCase()
  if (h.endsWith('.com.br')) return 'BRL'
  if (h.endsWith('.com.mx')) return 'MXN'
  if (h.endsWith('.com.ar')) return 'ARS'
  if (h.endsWith('.com.au')) return 'AUD'
  if (h.endsWith('.co.uk') || h.endsWith('.uk')) return 'GBP'
  if (h.endsWith('.co.jp') || h.endsWith('.jp')) return 'JPY'
  if (h.endsWith('.ca')) return 'CAD'
  if (h.endsWith('.ch')) return 'CHF'
  for (const tld of EUR_TLDS) {
    if (h.endsWith(tld)) return 'EUR'
  }
  if (h.endsWith('.com')) return 'USD'
  return null
}

export async function waitFor(
  doc: Document,
  selectors: string[],
  timeoutMs = 5000,
  intervalMs = 250,
): Promise<Element | null> {
  const start = Date.now()
  while (Date.now() - start < timeoutMs) {
    for (const sel of selectors) {
      const el = doc.querySelector(sel)
      if (el && el.textContent && el.textContent.trim()) return el
    }
    await new Promise((r) => setTimeout(r, intervalMs))
  }
  for (const sel of selectors) {
    const el = doc.querySelector(sel)
    if (el) return el
  }
  return null
}

export function firstNonEmptyText(doc: Document, selectors: string[]): string | null {
  for (const sel of selectors) {
    const el = doc.querySelector(sel)
    const text = el?.textContent?.trim()
    if (text) return text
  }
  return null
}
