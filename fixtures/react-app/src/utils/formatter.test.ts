import { describe, it, expect } from 'vitest'
import { formatDate, formatCurrency, formatAndValidate, truncate, capitalize } from './formatter'

describe('formatter', () => {
  describe('formatDate', () => {
    it('should format date using moment', () => {
      const date = new Date('2024-01-15')
      const formatted = formatDate(date)
      expect(formatted).toContain('January')
      expect(formatted).toContain('2024')
    })
  })

  describe('formatCurrency', () => {
    it('should format number as currency', () => {
      expect(formatCurrency(100)).toBe('$100.00')
    })

    it('should handle decimal values', () => {
      expect(formatCurrency(99.99)).toBe('$99.99')
    })

    it('should round to 2 decimal places', () => {
      expect(formatCurrency(99.999)).toBe('$100.00')
    })
  })

  describe('formatAndValidate', () => {
    it('should format valid values', () => {
      const result = formatAndValidate('hello')
      expect(result).toBe('HELLO')
    })

    it('should return empty string for invalid values', () => {
      const result = formatAndValidate('')
      expect(result).toBe('')
    })
  })

  describe('truncate', () => {
    it('should return the original string if length is within max', () => {
      expect(truncate('hello', 10)).toBe('hello')
    })

    it('should truncate string and add ellipsis if exceeds max', () => {
      expect(truncate('hello world', 5)).toBe('hello...')
    })
  })

  describe('capitalize', () => {
    it('should capitalize first letter of string', () => {
      expect(capitalize('hello')).toBe('Hello')
    })

    it('should handle already capitalized string', () => {
      expect(capitalize('Hello')).toBe('Hello')
    })
  })
})
