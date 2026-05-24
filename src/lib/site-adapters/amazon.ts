import type { SiteAdapter } from './index'
import type { ExtractedPrice } from '../price-extractor'
import {
  currencyFromHostname,
  firstNonEmptyText,
  parseLocalizedPrice,
  symbolToCurrency,
} from './parse'

const AMAZON_HOST_RE = /(?:^|\.)amazon\.(?:com|com\.br|com\.mx|com\.au|co\.uk|de|fr|it|es|nl|ca|co\.jp)$/

const AMAZON_PRICE_SELECTORS = [
  '#corePriceDisplay_desktop_feature_div .a-price[data-a-color="price"] .a-offscreen',
  '#corePrice_feature_div .a-price[data-a-color="price"] .a-offscreen',
  '#corePrice_desktop .a-price[data-a-color="price"] .a-offscreen',
  '#apex_desktop .a-price[data-a-color="price"] .a-offscreen',
  '.priceToPay .a-offscreen',
  '#priceblock_ourprice',
  '#priceblock_dealprice',
  '#priceblock_saleprice',
  '#corePrice_feature_div .a-offscreen',
]

function extract(doc: Document): ExtractedPrice | null {
  const priceText = firstNonEmptyText(doc, AMAZON_PRICE_SELECTORS)
  if (!priceText) return null

  const amount = parseLocalizedPrice(priceText)
  if (!amount) return null

  const hostname = doc.defaultView?.location?.hostname ?? ''
  const currency = symbolToCurrency(priceText) ?? currencyFromHostname(hostname)
  if (!currency) return null

  return { amount, currency }
}

export const amazonAdapter: SiteAdapter = {
  name: 'amazon',
  matches: (hostname) => AMAZON_HOST_RE.test(hostname),
  extract,
}
