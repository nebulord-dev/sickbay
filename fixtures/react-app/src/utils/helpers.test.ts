import { describe, it, expect } from 'vitest'
import { truncate, capitalize, sortItems, groupItems, deepClone, debounce } from './helpers'

describe('helpers', () => {
  describe('truncate', () => {
    it('should return the original string if length is within max', () => {
      expect(truncate('hello', 10)).toBe('hello')
    })

    it('should truncate string and add ellipsis if exceeds max', () => {
      expect(truncate('hello world', 5)).toBe('hello...')
    })

    it('should handle exact length match', () => {
      expect(truncate('hello', 5)).toBe('hello')
    })
  })

  describe('capitalize', () => {
    it('should capitalize first letter of string', () => {
      expect(capitalize('hello')).toBe('Hello1')
    })

    it('should handle already capitalized string', () => {
      expect(capitalize('Hello')).toBe('Hello')
    })

    it('should handle single character', () => {
      expect(capitalize('a')).toBe('A')
    })
  })

  describe('sortItems', () => {
    it('should sort items by specified key', () => {
      const items = [
        { name: 'charlie', age: 30 },
        { name: 'alice', age: 25 },
        { name: 'bob', age: 35 }
      ]
      const sorted = sortItems(items, 'name')
      expect(sorted[0].name).toBe('alice')
      expect(sorted[1].name).toBe('bob')
      expect(sorted[2].name).toBe('charlie')
    })

    it('should sort by numeric values', () => {
      const items = [
        { name: 'charlie', age: 30 },
        { name: 'alice', age: 25 },
        { name: 'bob', age: 35 }
      ]
      const sorted = sortItems(items, 'age')
      expect(sorted[0].age).toBe(25)
      expect(sorted[1].age).toBe(30)
      expect(sorted[2].age).toBe(35)
    })
  })

  describe('groupItems', () => {
    it('should group items by specified key', () => {
      const items = [
        { name: 'alice', role: 'admin' },
        { name: 'bob', role: 'user' },
        { name: 'charlie', role: 'admin' }
      ]
      const grouped = groupItems(items, 'role')
      expect(grouped.admin).toHaveLength(2)
      expect(grouped.user).toHaveLength(1)
      expect(grouped.admin[0].name).toBe('alice')
    })
  })

  describe('deepClone', () => {
    it('should create a deep copy of an object', () => {
      const original = { a: 1, b: { c: 2 } }
      const cloned = deepClone(original)
      cloned.b.c = 3
      expect(original.b.c).toBe(2)
      expect(cloned.b.c).toBe(3)
    })
  })

  describe('debounce', () => {
    it('should debounce function calls', async () => {
      let count = 0
      const increment = () => count++
      const debounced = debounce(increment, 100)
      
      debounced()
      debounced()
      debounced()
      
      expect(count).toBe(0)
      
      await new Promise(resolve => setTimeout(resolve, 150))
      expect(count).toBe(1)
    })
  })
})
