export interface Currency {
  code: string
  name: string
  symbol: string
  countryCode: string
  emoji: string
}

export const CURRENCIES: Currency[] = [
  { code: 'BRL', name: 'Real', symbol: 'R$', countryCode: 'BR', emoji: '🇧🇷' },
  { code: 'USD', name: 'Dólar Americano', symbol: '$', countryCode: 'US', emoji: '🇺🇸' },
  { code: 'EUR', name: 'Euro', symbol: '€', countryCode: 'EU', emoji: '🇪🇺' },
  { code: 'GBP', name: 'Libra Esterlina', symbol: '£', countryCode: 'GB', emoji: '🇬🇧' },
  { code: 'ARS', name: 'Peso Argentino', symbol: '$', countryCode: 'AR', emoji: '🇦🇷' },
  { code: 'MXN', name: 'Peso Mexicano', symbol: '$', countryCode: 'MX', emoji: '🇲🇽' },
  { code: 'CLP', name: 'Peso Chileno', symbol: '$', countryCode: 'CL', emoji: '🇨🇱' },
  { code: 'COP', name: 'Peso Colombiano', symbol: '$', countryCode: 'CO', emoji: '🇨🇴' },
  { code: 'PEN', name: 'Sol Peruano', symbol: 'S/', countryCode: 'PE', emoji: '🇵🇪' },
  { code: 'UYU', name: 'Peso Uruguaio', symbol: '$', countryCode: 'UY', emoji: '🇺🇾' },
  { code: 'CAD', name: 'Dólar Canadense', symbol: 'CA$', countryCode: 'CA', emoji: '🇨🇦' },
  { code: 'AUD', name: 'Dólar Australiano', symbol: 'A$', countryCode: 'AU', emoji: '🇦🇺' },
  { code: 'JPY', name: 'Iene Japonês', symbol: '¥', countryCode: 'JP', emoji: '🇯🇵' },
  { code: 'CNY', name: 'Yuan Chinês', symbol: '¥', countryCode: 'CN', emoji: '🇨🇳' },
  { code: 'KRW', name: 'Won Sul-Coreano', symbol: '₩', countryCode: 'KR', emoji: '🇰🇷' },
  { code: 'INR', name: 'Rúpia Indiana', symbol: '₹', countryCode: 'IN', emoji: '🇮🇳' },
  { code: 'CHF', name: 'Franco Suíço', symbol: 'Fr', countryCode: 'CH', emoji: '🇨🇭' },
  { code: 'SEK', name: 'Coroa Sueca', symbol: 'kr', countryCode: 'SE', emoji: '🇸🇪' },
  { code: 'NOK', name: 'Coroa Norueguesa', symbol: 'kr', countryCode: 'NO', emoji: '🇳🇴' },
  { code: 'DKK', name: 'Coroa Dinamarquesa', symbol: 'kr', countryCode: 'DK', emoji: '🇩🇰' },
  { code: 'ZAR', name: 'Rand Sul-Africano', symbol: 'R', countryCode: 'ZA', emoji: '🇿🇦' },
  { code: 'RUB', name: 'Rublo Russo', symbol: '₽', countryCode: 'RU', emoji: '🇷🇺' },
]

export const CURRENCIES_BY_CODE: Record<string, Currency> = Object.fromEntries(
  CURRENCIES.map((c) => [c.code, c]),
)

export const DEFAULT_CURRENCY = CURRENCIES[0]

/** Returns the CSS class for flag-icons: "fi fi-br" */
export function flagClass(countryCode: string): string {
  return `fi fi-${countryCode.toLowerCase()}`
}

/** Parse a masked price string back to a number */
export function parseMaskedPrice(masked: string, currencyCode: string): number {
  const isBRL = currencyCode === 'BRL'
  const normalized = isBRL
    ? masked.replace(/\./g, '').replace(',', '.')
    : masked.replace(/,/g, '')
  return parseFloat(normalized) || 0
}

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
