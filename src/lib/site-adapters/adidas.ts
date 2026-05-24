import type { SiteAdapter } from './index'
import type { ExtractedPrice } from '../price-extractor'
import {
  currencyFromHostname,
  firstNonEmptyText,
  parseLocalizedPrice,
  symbolToCurrency,
  waitFor,
} from './parse'

const ADIDAS_HOST_RE =
  /(?:^|\.)adidas\.(?:com|com\.br|com\.mx|com\.ar|co\.uk|com\.au|co\.jp|de|fr|it|es|nl|ca)$/

const ADIDAS_PRICE_SELECTORS = [
  '[data-testid="main-price"]',
  '[data-testid="product-price"]',
  '[data-auto-id="product-price"]',
  '.gl-price-item--sale',
  '.gl-price-item--current',
  '.gl-price-item',
  '.product-price',
]

async function waitForReady(doc: Document): Promise<void> {
  await waitFor(doc, ADIDAS_PRICE_SELECTORS, 4000, 250)
}

function extract(doc: Document): ExtractedPrice | null {
  const priceText = firstNonEmptyText(doc, ADIDAS_PRICE_SELECTORS)
  if (!priceText) return null

  const amount = parseLocalizedPrice(priceText)
  if (!amount) return null

  const hostname = doc.defaultView?.location?.hostname ?? ''
  const currency = symbolToCurrency(priceText) ?? currencyFromHostname(hostname)
  if (!currency) return null

  return { amount, currency }
}

export const adidasAdapter: SiteAdapter = {
  name: 'adidas',
  matches: (hostname) => ADIDAS_HOST_RE.test(hostname),
  extract,
  waitForReady,
}
