export interface Currency {
  code: string
  name: string
  symbol: string
  countryCode: string
}

export const CURRENCIES: Currency[] = [
  { code: 'BRL', name: 'Real', symbol: 'R$', countryCode: 'BR' },
  { code: 'USD', name: 'Dólar Americano', symbol: '$', countryCode: 'US' },
  { code: 'EUR', name: 'Euro', symbol: '€', countryCode: 'EU' },
  { code: 'GBP', name: 'Libra Esterlina', symbol: '£', countryCode: 'GB' },
  { code: 'ARS', name: 'Peso Argentino', symbol: '$', countryCode: 'AR' },
  { code: 'MXN', name: 'Peso Mexicano', symbol: '$', countryCode: 'MX' },
  { code: 'CLP', name: 'Peso Chileno', symbol: '$', countryCode: 'CL' },
  { code: 'COP', name: 'Peso Colombiano', symbol: '$', countryCode: 'CO' },
  { code: 'PEN', name: 'Sol Peruano', symbol: 'S/', countryCode: 'PE' },
  { code: 'UYU', name: 'Peso Uruguaio', symbol: '$', countryCode: 'UY' },
  { code: 'CAD', name: 'Dólar Canadense', symbol: 'CA$', countryCode: 'CA' },
  { code: 'AUD', name: 'Dólar Australiano', symbol: 'A$', countryCode: 'AU' },
  { code: 'JPY', name: 'Iene Japonês', symbol: '¥', countryCode: 'JP' },
  { code: 'CNY', name: 'Yuan Chinês', symbol: '¥', countryCode: 'CN' },
  { code: 'KRW', name: 'Won Sul-Coreano', symbol: '₩', countryCode: 'KR' },
  { code: 'INR', name: 'Rúpia Indiana', symbol: '₹', countryCode: 'IN' },
  { code: 'CHF', name: 'Franco Suíço', symbol: 'Fr', countryCode: 'CH' },
  { code: 'SEK', name: 'Coroa Sueca', symbol: 'kr', countryCode: 'SE' },
  { code: 'NOK', name: 'Coroa Norueguesa', symbol: 'kr', countryCode: 'NO' },
  { code: 'DKK', name: 'Coroa Dinamarquesa', symbol: 'kr', countryCode: 'DK' },
  { code: 'ZAR', name: 'Rand Sul-Africano', symbol: 'R', countryCode: 'ZA' },
  { code: 'RUB', name: 'Rublo Russo', symbol: '₽', countryCode: 'RU' },
]

export const CURRENCIES_BY_CODE: Record<string, Currency> = Object.fromEntries(
  CURRENCIES.map((c) => [c.code, c]),
)

export const DEFAULT_CURRENCY = CURRENCIES[0]

export function formatCurrency(amount: number, currencyCode: string): string {
  try {
    return new Intl.NumberFormat(currencyCode === 'BRL' ? 'pt-BR' : 'en-US', {
      style: 'currency',
      currency: currencyCode,
      minimumFractionDigits: 2,
      maximumFractionDigits: 2,
    }).format(amount)
  } catch {
    return `${amount.toFixed(2)} ${currencyCode}`
  }
}
