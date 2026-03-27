import { Trash2 } from 'lucide-react'
import type { Item } from '../lib/types'
import { formatCurrency } from '../lib/currencies'
import { Button } from '@/components/ui/button'
import LinkIcon from '../assets/images/link-icon.svg'

interface CardLinkProps {
  item: Item
  onEdit: (item: Item) => void
  onDelete: (id: string) => void
}

export function CardLink({ item, onEdit, onDelete }: CardLinkProps) {
  return (
    <article
      data-id={item.id}
      className={[
        'group rounded-lg transition-colors',
        /* Mobile: card style */
        'flex flex-col gap-2 p-4 bg-[#f9f9f9]',
        /* Desktop: flat row, no card background */
        'md:flex-row md:items-center md:justify-between md:bg-transparent md:p-0 md:gap-3',
      ].join(' ')}
    >
      {/* Left: favicon + info */}
      <div className="flex items-start gap-2 md:gap-3 min-w-0 flex-1 md:max-w-[332px]">
        <img
          src={item.image}
          alt={item.name}
          width={24}
          height={24}
          loading="lazy"
          decoding="async"
          className="size-6 rounded object-cover shrink-0"
        />
        <div className="group/link flex flex-col gap-1 min-w-0 flex-1">
          <a
            href={item.url}
            target="_blank"
            rel="noopener noreferrer"
            className="flex items-center gap-1 min-w-0 w-fit max-w-full"
          >
            <p className="text-sm font-medium text-black truncate">{item.name}</p>
            <img
              src={LinkIcon}
              alt=""
              aria-hidden="true"
              className="hidden md:block size-5 shrink-0 opacity-0 transition-opacity group-hover:opacity-100"
            />
          </a>
          <a
            href={item.url}
            target="_blank"
            rel="noopener noreferrer"
            className="block min-w-0 max-w-full text-sm !text-neutral-400 group-hover:!text-black transition-colors"
          >
            <span className="block truncate">{item.url}</span>
          </a>
        </div>
      </div>

      {/* Right: price + buttons */}
      {/* Mobile: full-width, indented to align with text (favicon 24px + gap 8px = 32px) */}
      <div className="flex items-center justify-between pl-8 w-full md:pl-0 md:w-auto md:gap-6 shrink-0">
        <span className="font-medium text-base whitespace-nowrap">{formatCurrency(item.price, item.currency ?? 'BRL')}</span>
        <div className="flex gap-2 items-center" role="group" aria-label="Ações do link">
          <Button
            variant="secondary"
            size="sm"
            type="button"
            className="h-12 md:h-9 rounded-[20px] md:rounded-xl bg-black/4 px-6 md:px-4 text-base font-medium text-black hover:bg-black/8"
            onClick={() => onEdit(item)}
          >
            Editar
          </Button>
          <Button
            variant="secondary"
            size="icon"
            type="button"
            aria-label="Deletar"
            className="size-12 md:size-9 rounded-[20px] md:rounded-xl bg-black/4 text-black hover:bg-black/8"
            onClick={() => onDelete(item.id)}
          >
            <Trash2 size={22} />
          </Button>
        </div>
      </div>
    </article>
  )
}
