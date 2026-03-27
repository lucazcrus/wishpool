import type { Item } from '../lib/types'
import { CardLink } from './CardLink'
import { CURRENCIES_BY_CODE, flagClass, formatCurrency } from '@/lib/currencies'

interface CategorySectionProps {
  name: string
  items: Item[]
  onEdit: (item: Item) => void
  onDelete: (id: string) => void
  isMultiCurrency?: boolean
}

export function CategorySection({ name, items, onEdit, onDelete, isMultiCurrency = false }: CategorySectionProps) {
  const currencyTotals = isMultiCurrency
    ? Object.entries(
        items.reduce<Record<string, number>>((acc, item) => {
          const code = item.currency ?? 'BRL'
          acc[code] = (acc[code] ?? 0) + item.price
          return acc
        }, {}),
      )
    : []

  return (
    <section className="product-section">
      <div className="flex items-center justify-between">
        <h2 className="section-title">{name}</h2>
        {isMultiCurrency && currencyTotals.length > 0 && (
          <div className="flex items-center gap-3">
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
          <CardLink key={item.id} item={item} onEdit={onEdit} onDelete={onDelete} />
        ))}
      </div>
    </section>
  )
}
