import type { Item } from '../lib/types'
import { CardLink } from './CardLink'

interface CategorySectionProps {
  name: string
  items: Item[]
  onEdit: (item: Item) => void
  onDelete: (id: string) => void
}

export function CategorySection({ name, items, onEdit, onDelete }: CategorySectionProps) {
  return (
    <section className="product-section">
      <h2 className="section-title">{name}</h2>
      <div className="item-list">
        {items.map((item) => (
          <CardLink key={item.id} item={item} onEdit={onEdit} onDelete={onDelete} />
        ))}
      </div>
    </section>
  )
}
