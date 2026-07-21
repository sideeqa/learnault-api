/**
 * Exact monetary utilities and Money value object for Learnault API.
 * Prevents binary floating-point rounding errors and enforces explicit asset identity.
 */

export interface AssetIdentity {
  code: string
  issuer?: string | null
  decimals: number
  network: string
}

export const DEFAULT_STELLAR_DECIMALS = 7
export const STROOPS_PER_XLM = 10_000_000n

export const NATIVE_XLM_ASSET: AssetIdentity = {
  code: 'XLM',
  issuer: null,
  decimals: DEFAULT_STELLAR_DECIMALS,
  network: process.env.STELLAR_NETWORK || 'testnet',
}

export class UnsafeMonetaryCoercionError extends Error {
  constructor(message: string) {
    super(message)
    this.name = 'UnsafeMonetaryCoercionError'
  }
}

/**
 * Converts a decimal string (e.g., "5.25") to integer stroops (e.g., 52500000n).
 * Rejects strings with more fractional digits than allowed by `decimals`.
 */
export function decimalStringToStroops(
  val: string,
  decimals: number = DEFAULT_STELLAR_DECIMALS,
): bigint {
  if (typeof val !== 'string' || !val.trim()) {
    throw new UnsafeMonetaryCoercionError(`Invalid decimal string input: ${String(val)}`)
  }

  const cleanVal = val.trim()
  if (!/^-?\d+(\.\d+)?$/.test(cleanVal)) {
    throw new UnsafeMonetaryCoercionError(`Invalid numeric format: "${val}"`)
  }

  const isNegative = cleanVal.startsWith('-')
  const absVal = isNegative ? cleanVal.slice(1) : cleanVal
  const [integerPart, fractionalPart = ''] = absVal.split('.')

  if (fractionalPart.length > decimals) {
    throw new UnsafeMonetaryCoercionError(
      `Amount "${val}" exceeds maximum allowed decimals (${decimals})`,
    )
  }

  const paddedFractional = fractionalPart.padEnd(decimals, '0')
  const combined = integerPart + paddedFractional
  const result = BigInt(combined)

  return isNegative ? -result : result
}

/**
 * Formats integer stroops (e.g., 52500000n) into a decimal string (e.g., "5.2500000").
 */
export function stroopsToDecimalString(
  stroops: bigint,
  decimals: number = DEFAULT_STELLAR_DECIMALS,
): string {
  const isNegative = stroops < 0n
  const absStroops = isNegative ? -stroops : stroops
  const str = absStroops.toString().padStart(decimals + 1, '0')

  const integerPart = str.slice(0, str.length - decimals)
  const fractionalPart = str.slice(str.length - decimals)

  const formatted = `${integerPart}.${fractionalPart}`
  return isNegative ? `-${formatted}` : formatted
}

/**
 * Safely converts string, bigint, or number into stroops.
 * Throws UnsafeMonetaryCoercionError for unsafe JavaScript floats.
 */
export function toStroops(
  val: string | bigint | number,
  decimals: number = DEFAULT_STELLAR_DECIMALS,
): bigint {
  if (typeof val === 'bigint') {
    return val
  }

  if (typeof val === 'string') {
    return decimalStringToStroops(val, decimals)
  }

  if (typeof val === 'number') {
    if (isNaN(val) || !isFinite(val)) {
      throw new UnsafeMonetaryCoercionError(`Cannot convert non-finite number: ${val}`)
    }

    // Convert number to decimal string with fixed precision to check for unsafe float loss
    const str = val.toString()
    if (str.includes('e') || str.includes('E')) {
      throw new UnsafeMonetaryCoercionError(
        `Exponential notation number is unsafe for monetary calculations: ${val}`,
      )
    }

    // Attempt parsing decimal string representation
    return decimalStringToStroops(str, decimals)
  }

  throw new UnsafeMonetaryCoercionError(`Unsupported type for monetary conversion: ${typeof val}`)
}

/**
 * Perform exact integer addition of stroop amounts.
 */
export function safeAddStroops(...amounts: bigint[]): bigint {
  return amounts.reduce((sum, amt) => sum + amt, 0n)
}

/**
 * Perform exact integer subtraction of stroop amounts.
 */
export function safeSubtractStroops(a: bigint, b: bigint): bigint {
  return a - b
}

/**
 * Multiply stroops by a multiplier (number or string) with explicit rounding mode.
 */
export function safeMultiplyStroops(
  baseStroops: bigint,
  multiplier: number | string,
  roundingMode: 'floor' | 'ceil' | 'half-up' = 'floor',
  decimals: number = DEFAULT_STELLAR_DECIMALS,
): bigint {
  const multStr = typeof multiplier === 'number' ? multiplier.toString() : multiplier
  const multStroops = decimalStringToStroops(multStr, decimals)
  const scale = 10n ** BigInt(decimals)

  const product = baseStroops * multStroops

  if (roundingMode === 'floor') {
    return product / scale
  }

  if (roundingMode === 'ceil') {
    const remainder = product % scale
    const base = product / scale
    if (remainder > 0n) return base + 1n
    if (remainder < 0n) return base - 1n
    return base
  }

  // half-up
  const remainder = product % scale
  const halfScale = scale / 2n
  const base = product / scale
  if (remainder >= halfScale) return base + 1n
  return base
}

/**
 * Calculate percentage of base stroops (e.g. 10% streak bonus).
 * `percent` is integer percentage (e.g. 10 for 10%, 100 for 100%).
 */
export function calculatePercentageStroops(
  baseStroops: bigint,
  percent: bigint,
  maxPercent?: bigint,
): bigint {
  const effectivePercent = maxPercent !== undefined && percent > maxPercent ? maxPercent : percent
  if (effectivePercent <= 0n) return 0n
  return (baseStroops * effectivePercent) / 100n
}

/**
 * Immutable Money Value Object
 */
export class Money {
  readonly stroops: bigint
  readonly asset: AssetIdentity

  constructor(
    stroopsInput: bigint | string | number,
    asset: AssetIdentity = NATIVE_XLM_ASSET,
  ) {
    this.asset = { ...asset }
    this.stroops = toStroops(stroopsInput, asset.decimals)
  }

  toDecimalString(): string {
    return stroopsToDecimalString(this.stroops, this.asset.decimals)
  }

  add(other: Money): Money {
    this.assertSameAsset(other)
    return new Money(this.stroops + other.stroops, this.asset)
  }

  subtract(other: Money): Money {
    this.assertSameAsset(other)
    return new Money(this.stroops - other.stroops, this.asset)
  }

  multiply(multiplier: number | string, roundingMode: 'floor' | 'ceil' | 'half-up' = 'floor'): Money {
    const newStroops = safeMultiplyStroops(this.stroops, multiplier, roundingMode, this.asset.decimals)
    return new Money(newStroops, this.asset)
  }

  toJSON() {
    return {
      stroops: this.stroops.toString(),
      amountFormatted: this.toDecimalString(),
      asset: this.asset,
    }
  }

  private assertSameAsset(other: Money) {
    if (
      this.asset.code !== other.asset.code ||
      this.asset.issuer !== other.asset.issuer ||
      this.asset.network !== other.asset.network
    ) {
      throw new Error(
        `Asset mismatch: cannot perform operation between ${this.asset.code} and ${other.asset.code}`,
      )
    }
  }
}
