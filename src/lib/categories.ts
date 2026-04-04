export const ALL_CATEGORY = 'Todos'
export const PURCHASE_HISTORY_CATEGORY = 'Histórico de Compras'

export function isPurchaseHistoryCategory(category: string) {
  return category.trim().toLowerCase() === PURCHASE_HISTORY_CATEGORY.toLowerCase()
}

export function sanitizeCategories(categories: string[]) {
  const seen = new Set<string>()
  const result: string[] = []

  for (const category of categories) {
    const normalized = category.trim()
    if (!normalized) continue
    if (normalized.toLowerCase() === ALL_CATEGORY.toLowerCase()) continue

    const key = normalized.toLowerCase()
    if (seen.has(key)) continue
    seen.add(key)
    result.push(normalized)
  }

  return result
}

export function getUserCategoryOptions(categories: string[]) {
  return sanitizeCategories(categories).filter((category) => !isPurchaseHistoryCategory(category))
}
