import NumberFlow from '@number-flow/react'
import ReactCountryFlag from 'react-country-flag'
import { CURRENCIES_BY_CODE, formatCurrency } from '@/lib/currencies'

interface CurrencyTotal {
  code: string
  total: number
}

interface StatsPanelProps {
  total: number
  itemCount: number
  categoryCount: number
  currencyTotals?: CurrencyTotal[]
  isMultiCurrency?: boolean
}

export function StatsPanel({
  total,
  itemCount,
  categoryCount,
  currencyTotals = [],
  isMultiCurrency = false,
}: StatsPanelProps) {
  return (
    <aside className="stats" aria-label="Resumo">
      {isMultiCurrency ? (
        <div className="stat-item">
          <div className="rounded-lg border border-[#eee] p-3 space-y-2 w-full">
            <span className="text-xs font-medium text-neutral-400">Total salvo</span>
            {currencyTotals.map(({ code, total: currencyTotal }) => {
              const currency = CURRENCIES_BY_CODE[code]
              return (
                <div key={code} className="flex items-center gap-2">
                  {currency && (
                    <ReactCountryFlag
                      countryCode={currency.countryCode}
                      style={{ fontSize: '1rem', lineHeight: '1rem', borderRadius: '2px' }}
                    />
                  )}
                  <span className="stat-value text-sm font-semibold text-black">
                    {formatCurrency(currencyTotal, code)}
                  </span>
                </div>
              )
            })}
          </div>
        </div>
      ) : (
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
      )}
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
