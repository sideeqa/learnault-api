import { stroopsToDecimalString, toStroops } from './money'

/**
 * Format a numeric amount, decimal string, or BigInt stroops as currency using Intl.NumberFormat.
 *
 * @param value - numeric amount, decimal string, or BigInt stroops
 * @param currency - ISO 4217 currency code (e.g. "USD", "XLM")
 * @param locale - locale string for formatting
 * @param decimals - number of fraction digits to show
 */
export function formatCurrency(
  value: number | bigint | string,
  currency = 'USD',
  locale = 'en-US',
  decimals = 2,
): string {
  let num: number

  if (typeof value === 'bigint') {
    num = Number(stroopsToDecimalString(value, 7))
  } else if (typeof value === 'string') {
    num = Number(value)
  } else {
    num = value
  }

  const formatter = new Intl.NumberFormat(locale, {
    style: 'currency',
    currency,
    minimumFractionDigits: decimals,
    maximumFractionDigits: decimals,
  })

  return formatter.format(num)
}
