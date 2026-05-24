import { useMemo } from 'react'
import { formatCurrency } from '@/lib/currencies'
import type { PricePoint } from '@/lib/price-history'

interface PriceSparklineProps {
  points: PricePoint[]
  currency: string
  width?: number
  height?: number
}

export function PriceSparkline({
  points,
  currency,
  width = 480,
  height = 80,
}: PriceSparklineProps) {
  const view = useMemo(() => {
    if (points.length < 2) return null
    const xs = points.map((p) => new Date(p.captured_at).getTime())
    const ys = points.map((p) => p.price)
    const minX = Math.min(...xs)
    const maxX = Math.max(...xs)
    const minY = Math.min(...ys)
    const maxY = Math.max(...ys)
    const xRange = maxX - minX || 1
    const yRange = maxY - minY || 1
    const padX = 4
    const padY = 6
    const innerW = width - padX * 2
    const innerH = height - padY * 2

    const toX = (t: number) => padX + ((t - minX) / xRange) * innerW
    const toY = (p: number) => padY + (1 - (p - minY) / yRange) * innerH

    const path = points
      .map((p, i) => {
        const x = toX(new Date(p.captured_at).getTime())
        const y = toY(p.price)
        return `${i === 0 ? 'M' : 'L'}${x.toFixed(2)},${y.toFixed(2)}`
      })
      .join(' ')

    const last = points[points.length - 1]
    return { path, minY, maxY, last }
  }, [points, width, height])

  if (!view) {
    return (
      <p className="text-sm text-slate-500">
        Ainda não temos histórico de preço pra mostrar.
      </p>
    )
  }

  return (
    <div className="flex flex-col gap-2">
      <svg
        width={width}
        height={height}
        viewBox={`0 0 ${width} ${height}`}
        className="block w-full h-auto"
        role="img"
        aria-label="Histórico de preço"
      >
        <path
          d={view.path}
          fill="none"
          stroke="#289717"
          strokeWidth={1.75}
          strokeLinecap="round"
          strokeLinejoin="round"
        />
      </svg>
      <div className="flex justify-between text-xs text-slate-500">
        <span>Mín {formatCurrency(view.minY, currency)}</span>
        <span>Atual {formatCurrency(view.last.price, currency)}</span>
        <span>Máx {formatCurrency(view.maxY, currency)}</span>
      </div>
    </div>
  )
}
