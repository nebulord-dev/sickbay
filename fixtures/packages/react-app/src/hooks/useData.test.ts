import { describe, it, expect, vi, beforeEach } from 'vitest'
import { renderHook, waitFor } from '@testing-library/react'
import { useData } from './useData'
import * as api from '../services/api'

vi.mock('../services/api')

describe('useData', () => {
  beforeEach(() => {
    vi.clearAllMocks()
  })

  it('should initialize with empty posts and loading false', () => {
    vi.mocked(api.fetchPosts).mockImplementation(() => new Promise(() => {}))
    
    const { result } = renderHook(() => useData())
    
    expect(result.current.posts).toEqual([])
    expect(result.current.loading).toBe(true)
    expect(result.current.error).toBe(null)
  })

  it('should fetch posts on mount', async () => {
    const mockPosts = [
      { id: 1, title: 'Post 1', body: 'Body 1', userId: 1 },
      { id: 2, title: 'Post 2', body: 'Body 2', userId: 1 }
    ]
    
    vi.mocked(api.fetchPosts).mockResolvedValue(mockPosts)
    
    const { result } = renderHook(() => useData())
    
    await waitFor(() => {
      expect(result.current.loading).toBe(false)
    })
    
    expect(result.current.posts).toEqual(mockPosts)
    expect(result.current.error).toBe(null)
  })

  it('should handle fetch errors', async () => {
    const errorMessage = 'Network error'
    vi.mocked(api.fetchPosts).mockRejectedValue(new Error(errorMessage))
    
    const { result } = renderHook(() => useData())
    
    await waitFor(() => {
      expect(result.current.loading).toBe(false)
    })
    
    expect(result.current.posts).toEqual([])
    expect(result.current.error).toBe(errorMessage)
  })

  it('should set loading to true while fetching', () => {
    vi.mocked(api.fetchPosts).mockImplementation(() => 
      new Promise(resolve => setTimeout(() => resolve([]), 100))
    )
    
    const { result } = renderHook(() => useData())
    
    expect(result.current.loading).toBe(true)
  })
})
