import { useEffect, useState } from 'react'
import { fetchLatestAlert, type PriceAlert } from './price-history'

export interface PriceAlertSummary {
  dropAmount: number
  dropPct: number
  previousPrice: number
  currentPrice: number
  raw: PriceAlert
}

export function usePriceAlert(itemId: string | null | undefined): PriceAlertSummary | null {
  const [summary, setSummary] = useState<PriceAlertSummary | null>(null)

  useEffect(() => {
    let cancelled = false
    if (!itemId) {
      setSummary(null)
      return
    }
    void fetchLatestAlert(itemId).then((alert) => {
      if (cancelled || !alert) return
      const dropPct =
        alert.previous_price > 0 ? (alert.drop_amount / alert.previous_price) * 100 : 0
      setSummary({
        dropAmount: alert.drop_amount,
        dropPct,
        previousPrice: alert.previous_price,
        currentPrice: alert.current_price,
        raw: alert,
      })
    })
    return () => {
      cancelled = true
    }
  }, [itemId])

  return summary
}
