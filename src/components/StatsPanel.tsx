import NumberFlow from '@number-flow/react'
import { CURRENCIES_BY_CODE, flagClass, formatCurrency } from '@/lib/currencies'

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
        <div className="stat-item w-full">
          <div className="rounded-lg border border-[#eee] w-full overflow-hidden">
            <div className="px-3 py-2.5">
              <span className="text-sm text-neutral-400">Total salvo</span>
            </div>
            <div className="border-t border-[#eee]" />
            <div className="px-3 py-2.5 space-y-2">
              {currencyTotals.map(({ code, total: currencyTotal }) => {
                const currency = CURRENCIES_BY_CODE[code]
                return (
                  <div key={code} className="flex items-center gap-2">
                    {currency && (
                      <span
                        className={`${flagClass(currency.countryCode)} fis`}
                        style={{ fontSize: '1.4rem', borderRadius: '50%' }}
                      />
                    )}
                    <span className="text-base font-semibold text-black">
                      {formatCurrency(currencyTotal, code)}
                    </span>
                  </div>
                )
              })}
            </div>
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
