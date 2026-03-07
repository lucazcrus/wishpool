import NumberFlow from '@number-flow/react'

interface StatsPanelProps {
  total: number
  itemCount: number
  categoryCount: number
}

export function StatsPanel({ total, itemCount, categoryCount }: StatsPanelProps) {
  return (
    <aside className="stats" aria-label="Resumo">
      <div className="stat-item">
        <span className="stat-value">
          <NumberFlow
            value={total}
            locales="pt-BR"
            format={{
              style: 'currency',
              currency: 'BRL',
              minimumFractionDigits: 2,
              maximumFractionDigits: 2,
            }}
          />
        </span>
        <span className="text-neutral-400 text-sm">Total salvo</span>
      </div>
      <div className="stat-item">
        <span className="stat-value">
          <NumberFlow value={itemCount} />
        </span>
        <span className="text-neutral-400 text-sm">Links</span>
      </div>
      <div className="stat-item">
        <span className="stat-value">
          <NumberFlow value={categoryCount} />
        </span>
        <span className="text-neutral-400 text-sm">Categorias</span>
      </div>
    </aside>
  )
}
