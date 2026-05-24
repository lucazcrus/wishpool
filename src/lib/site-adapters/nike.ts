import type { SiteAdapter } from './index'
import type { ExtractedPrice } from '../price-extractor'
import {
  currencyFromHostname,
  firstNonEmptyText,
  parseLocalizedPrice,
  symbolToCurrency,
  waitFor,
} from './parse'

const NIKE_HOST_RE = /(?:^|\.)nike\.(?:com|com\.br|com\.mx|co\.uk|com\.au|co\.jp|de|fr|it|es|nl|ca)$/

const NIKE_PRICE_SELECTORS = [
  '[data-testid="currentPrice-container"]',
  '[data-testid="product-price-reduced"]',
  '[data-testid="product-price"]',
  '[data-test="product-price-reduced"]',
  '[data-test="product-price"]',
  '.product-price.is--current-price',
  '.product-price',
]

async function waitForReady(doc: Document): Promise<void> {
  await waitFor(doc, NIKE_PRICE_SELECTORS, 4000, 250)
}

function extract(doc: Document): ExtractedPrice | null {
  const priceText = firstNonEmptyText(doc, NIKE_PRICE_SELECTORS)
  if (!priceText) return null

  const amount = parseLocalizedPrice(priceText)
  if (!amount) return null

  const hostname = doc.defaultView?.location?.hostname ?? ''
  const currency = symbolToCurrency(priceText) ?? currencyFromHostname(hostname)
  if (!currency) return null

  return { amount, currency }
}

export const nikeAdapter: SiteAdapter = {
  name: 'nike',
  matches: (hostname) => NIKE_HOST_RE.test(hostname),
  extract,
  waitForReady,
}
