import type { Item } from '../lib/types'
import { CardLink } from './CardLink'
import { CURRENCIES_BY_CODE, flagClass, formatCurrency } from '@/lib/currencies'

interface CategorySectionProps {
  name: string
  items: Item[]
  onEdit: (item: Item) => void
  onDelete: (id: string) => void
  onMoveToHistory: (item: Item) => void
  isHistory?: boolean
}

export function CategorySection({
  name,
  items,
  onEdit,
  onDelete,
  onMoveToHistory,
  isHistory = false,
}: CategorySectionProps) {
  const currencyTotals = Object.entries(
    items.reduce<Record<string, number>>((acc, item) => {
      const code = item.currency ?? 'BRL'
      acc[code] = (acc[code] ?? 0) + item.price
      return acc
    }, {}),
  )

  return (
    <section className="product-section">
      <div className="flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between mb-4">
        <h2 className="section-title">{name}</h2>
        {currencyTotals.length > 0 && (
          <div className="flex flex-wrap items-center gap-x-3 gap-y-1">
            {currencyTotals.map(([code, total]) => {
              const currency = CURRENCIES_BY_CODE[code]
              return (
                <div key={code} className="flex items-center gap-1.5">
                  {currency && (
                    <span className={flagClass(currency.countryCode)} style={{ fontSize: '0.9rem' }} />
                  )}
                  <span className="text-sm font-medium text-black">
                    {formatCurrency(total, code)}
                  </span>
                </div>
              )
            })}
          </div>
        )}
      </div>
      <div className="item-list">
        {items.map((item) => (
          <CardLink
            key={item.id}
            item={item}
            onEdit={onEdit}
            onDelete={onDelete}
            onMoveToHistory={onMoveToHistory}
            isHistory={isHistory}
          />
        ))}
      </div>
    </section>
  )
}
