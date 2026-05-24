import type { ExtractedPrice } from '../price-extractor'
import { adidasAdapter } from './adidas'
import { amazonAdapter } from './amazon'
import { nikeAdapter } from './nike'

export interface SiteAdapter {
  name: string
  matches: (hostname: string) => boolean
  extract: (doc: Document) => ExtractedPrice | null
  waitForReady?: (doc: Document) => Promise<void>
}

const ADAPTERS: SiteAdapter[] = [amazonAdapter, nikeAdapter, adidasAdapter]

export function pickAdapter(hostname: string): SiteAdapter | null {
  const normalized = hostname.toLowerCase()
  return ADAPTERS.find((a) => a.matches(normalized)) ?? null
}
