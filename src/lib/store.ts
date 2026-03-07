import { useState, useCallback } from 'react'
import type { AppState, Item, Profile } from './types'
import { DEFAULT_CATEGORIES, DEFAULT_ITEMS, DEFAULT_PROFILE } from './data'

export const STORAGE_KEY = 'wishpool:v1'
export const EXT_QUEUE_KEY = 'wishpool:extQueue'

function storageKeyForUser(userId: string) {
  return `${STORAGE_KEY}:${userId}`
}

function loadState(storageKey: string, initialProfile: Profile): AppState {
  try {
    const raw = localStorage.getItem(storageKey)
    if (!raw) throw new Error('no data')
    const parsed = JSON.parse(raw)
    if (!parsed?.profile || !Array.isArray(parsed?.items)) throw new Error('invalid')
    const categories =
      Array.isArray(parsed.categories) && parsed.categories.length > 0
        ? parsed.categories
        : Array.from(new Set(parsed.items.map((i: Item) => i.category).filter(Boolean)))
    return {
      ...parsed,
      categories,
      profile: {
        ...DEFAULT_PROFILE,
        ...parsed.profile,
        email: parsed.profile.email || initialProfile.email,
      },
    }
  } catch {
    return {
      profile: initialProfile,
      items: DEFAULT_ITEMS,
      categories: DEFAULT_CATEGORIES,
    }
  }
}

function saveState(storageKey: string, state: AppState) {
  localStorage.setItem(storageKey, JSON.stringify(state))
}

export function useStore(userId: string, initialProfile: Profile) {
  const storageKey = storageKeyForUser(userId)
  const [state, setState] = useState<AppState>(() => loadState(storageKey, initialProfile))

  const setItems = useCallback((items: Item[]) => {
    setState((prev) => {
      const next = { ...prev, items }
      saveState(storageKey, next)
      return next
    })
  }, [storageKey])

  const addItem = useCallback((item: Item) => {
    setState((prev) => {
      const items = [item, ...prev.items]
      const categories = prev.categories.includes(item.category)
        ? prev.categories
        : [...prev.categories, item.category]
      const next = { ...prev, items, categories }
      saveState(storageKey, next)
      return next
    })
  }, [storageKey])

  const setCategories = useCallback((categories: string[]) => {
    setState((prev) => {
      const next = { ...prev, categories }
      saveState(storageKey, next)
      return next
    })
  }, [storageKey])

  const setProfile = useCallback((profile: Profile) => {
    setState((prev) => {
      const next = { ...prev, profile }
      saveState(storageKey, next)
      return next
    })
  }, [storageKey])

  return { state, setItems, addItem, setCategories, setProfile }
}
