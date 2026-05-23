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
