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

export async function fetchPriceHistory(
  linkId: string,
  currency?: string,
): Promise<PricePoint[]> {
  if (!supabase) return []
  let query = supabase
    .from('link_price_history')
    .select('price, currency, captured_at')
    .eq('link_id', linkId)
    .order('captured_at', { ascending: true })
  if (currency) query = query.eq('currency', currency)
  const { data, error } = await query
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
