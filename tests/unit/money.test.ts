import { describe, it, expect } from 'vitest'
import {
  Money,
  NATIVE_XLM_ASSET,
  UnsafeMonetaryCoercionError,
  calculatePercentageStroops,
  decimalStringToStroops,
  safeAddStroops,
  safeMultiplyStroops,
  safeSubtractStroops,
  stroopsToDecimalString,
  toStroops,
} from '../../src/utils/money'

describe('Monetary Utility (money.ts)', () => {
  describe('decimalStringToStroops & stroopsToDecimalString', () => {
    it('converts integer decimal string to stroops correctly', () => {
      expect(decimalStringToStroops('5')).toBe(50_000_000n)
      expect(decimalStringToStroops('100')).toBe(1_000_000_000n)
      expect(decimalStringToStroops('0')).toBe(0n)
    })

    it('converts fractional decimal string to stroops correctly', () => {
      expect(decimalStringToStroops('5.5')).toBe(55_000_000n)
      expect(decimalStringToStroops('7.1234567')).toBe(71_234_567n)
      expect(decimalStringToStroops('0.0000001')).toBe(1n)
    })

    it('handles negative decimal strings correctly', () => {
      expect(decimalStringToStroops('-5.25')).toBe(-52_500_000n)
    })

    it('formats stroops to decimal string correctly', () => {
      expect(stroopsToDecimalString(50_000_000n)).toBe('5.0000000')
      expect(stroopsToDecimalString(1n)).toBe('0.0000001')
      expect(stroopsToDecimalString(0n)).toBe('0.0000000')
      expect(stroopsToDecimalString(-15_000_000n)).toBe('-1.5000000')
    })

    it('supports custom decimals', () => {
      expect(decimalStringToStroops('12.34', 2)).toBe(1234n)
      expect(stroopsToDecimalString(1234n, 2)).toBe('12.34')
    })

    it('throws UnsafeMonetaryCoercionError when decimal precision exceeds allowed decimals', () => {
      expect(() => decimalStringToStroops('5.12345678', 7)).toThrow(
        UnsafeMonetaryCoercionError,
      )
    })

    it('throws UnsafeMonetaryCoercionError for malformed strings', () => {
      expect(() => decimalStringToStroops('abc')).toThrow(UnsafeMonetaryCoercionError)
      expect(() => decimalStringToStroops('12.34.56')).toThrow(UnsafeMonetaryCoercionError)
      expect(() => decimalStringToStroops('')).toThrow(UnsafeMonetaryCoercionError)
    })
  })

  describe('toStroops coercion safety', () => {
    it('accepts BigInt directly', () => {
      expect(toStroops(1234567n)).toBe(1234567n)
    })

    it('accepts valid string amounts', () => {
      expect(toStroops('10.5')).toBe(105_000_000n)
    })

    it('accepts finite numbers that parse into valid decimal strings', () => {
      expect(toStroops(5)).toBe(50_000_000n)
      expect(toStroops(7.5)).toBe(75_000_000n)
    })

    it('rejects Non-finite numbers or exponential notation', () => {
      expect(() => toStroops(NaN)).toThrow(UnsafeMonetaryCoercionError)
      expect(() => toStroops(Infinity)).toThrow(UnsafeMonetaryCoercionError)
      expect(() => toStroops(1e-9)).toThrow(UnsafeMonetaryCoercionError)
    })

    it('rejects floats with excessive decimal places', () => {
      expect(() => toStroops(1.123456789)).toThrow(UnsafeMonetaryCoercionError)
    })
  })

  describe('Exact BigInt Arithmetic', () => {
    it('performs exact addition without binary floating point errors', () => {
      // In binary JS float: 0.1 + 0.2 = 0.30000000000000004
      const a = decimalStringToStroops('0.1')
      const b = decimalStringToStroops('0.2')
      const sum = safeAddStroops(a, b)

      expect(sum).toBe(3_000_000n)
      expect(stroopsToDecimalString(sum)).toBe('0.3000000')
    })

    it('performs exact subtraction', () => {
      const a = decimalStringToStroops('10.5')
      const b = decimalStringToStroops('3.2')
      const diff = safeSubtractStroops(a, b)

      expect(diff).toBe(73_000_000n)
      expect(stroopsToDecimalString(diff)).toBe('7.3000000')
    })

    it('performs multiplication with floor, ceil, and half-up rounding', () => {
      const base = 50_000_000n // 5 XLM
      // 5 * 1.5 = 7.5
      expect(safeMultiplyStroops(base, '1.5')).toBe(75_000_000n)

      // Test rounding with non-exact division
      const amt = 10n // 0.0000010
      // 10 * 0.3333333 = 3.333333 -> floor = 3n
      expect(safeMultiplyStroops(amt, '0.3333333', 'floor')).toBe(3n)
      expect(safeMultiplyStroops(amt, '0.3333333', 'ceil')).toBe(4n)
    })

    it('calculates percentages accurately and caps max percentage', () => {
      const base = 50_000_000n // 5 XLM
      // 10% bonus for 3 streak days (30%)
      expect(calculatePercentageStroops(base, 30n)).toBe(15_000_000n)

      // Capped at 100% max
      expect(calculatePercentageStroops(base, 200n, 100n)).toBe(50_000_000n)
    })
  })

  describe('Money Value Object', () => {
    it('creates Money instance with default XLM asset', () => {
      const m = new Money('5.0')
      expect(m.stroops).toBe(50_000_000n)
      expect(m.asset.code).toBe('XLM')
      expect(m.toDecimalString()).toBe('5.0000000')
    })

    it('adds two Money objects with matching assets', () => {
      const m1 = new Money('5.0')
      const m2 = new Money('2.5')
      const result = m1.add(m2)

      expect(result.stroops).toBe(75_000_000n)
      expect(result.toDecimalString()).toBe('7.5000000')
    })

    it('throws error when adding Money with mismatched assets', () => {
      const m1 = new Money('5.0', NATIVE_XLM_ASSET)
      const m2 = new Money('5.0', { code: 'USDC', issuer: 'G123', decimals: 7, network: 'testnet' })

      expect(() => m1.add(m2)).toThrow(/Asset mismatch/)
    })

    it('serializes to JSON with stroops, amountFormatted, and asset', () => {
      const m = new Money('10.0')
      expect(m.toJSON()).toEqual({
        stroops: '100000000',
        amountFormatted: '10.0000000',
        asset: NATIVE_XLM_ASSET,
      })
    })
  })
})
