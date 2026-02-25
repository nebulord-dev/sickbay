import { describe, it, expect } from 'vitest'
import { validator, truncate, capitalize } from './validator'

describe('validator', () => {
  describe('isValid', () => {
    it('should return true for non-empty strings within length limit', () => {
      expect(validator.isValid('hello')).toBe(true)
    })

    it('should return false for empty strings', () => {
      expect(validator.isValid('')).toBe(false)
    })

    it('should return false for strings >= 100 characters', () => {
      expect(validator.isValid('a'.repeat(100))).toBe(false)
    })

    it('should return true for strings just under limit', () => {
      expect(validator.isValid('a'.repeat(99))).toBe(true)
    })
  })

  describe('isEmail', () => {
    it('should return true for valid email', () => {
      expect(validator.isEmail('test@example.com')).toBe(true)
    })

    it('should return false for invalid email without @', () => {
      expect(validator.isEmail('testexample.com')).toBe(false)
    })

    it('should return false for invalid email without domain', () => {
      expect(validator.isEmail('test@')).toBe(false)
    })

    it('should return false for email with spaces', () => {
      expect(validator.isEmail('test @example.com')).toBe(false)
    })
  })

  describe('sanitize', () => {
    it('should sanitize and format valid values', () => {
      const result = validator.sanitize('hello')
      expect(result).toBe('HELLO')
    })

    it('should return empty string for invalid values', () => {
      const result = validator.sanitize('')
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
  })
})
