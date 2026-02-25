import { describe, it, expect, vi, beforeEach } from 'vitest'
import axios from 'axios'
import { fetchPosts, fetchUser, deletePost } from './api'

vi.mock('axios')

describe('api', () => {
  beforeEach(() => {
    vi.clearAllMocks()
  })

  describe('fetchPosts', () => {
    it('should fetch posts from API', async () => {
      const mockPosts = [
        { id: 1, title: 'Post 1', body: 'Body 1', userId: 1 },
        { id: 2, title: 'Post 2', body: 'Body 2', userId: 1 }
      ]
      
      vi.mocked(axios.get).mockResolvedValue({ data: mockPosts })
      
      const result = await fetchPosts()
      
      expect(axios.get).toHaveBeenCalledWith('https://jsonplaceholder.typicode.com/posts')
      expect(result).toEqual(mockPosts)
    })

    it('should throw error on failed request', async () => {
      vi.mocked(axios.get).mockRejectedValue(new Error('Network error'))
      
      await expect(fetchPosts()).rejects.toThrow('Network error')
    })
  })

  describe('fetchUser', () => {
    it('should fetch user by id', async () => {
      const mockUser = { id: 1, name: 'John Doe', email: 'john@example.com' }
      
      vi.mocked(axios.get).mockResolvedValue({ data: mockUser })
      
      const result = await fetchUser(1)
      
      expect(axios.get).toHaveBeenCalledWith('https://jsonplaceholder.typicode.com/users/1')
      expect(result).toEqual(mockUser)
    })

    it('should throw error on failed request', async () => {
      vi.mocked(axios.get).mockRejectedValue(new Error('User not found'))
      
      await expect(fetchUser(999)).rejects.toThrow('User not found')
    })
  })

  describe('deletePost', () => {
    it('should delete post by id', async () => {
      vi.mocked(axios.delete).mockResolvedValue({ data: {} })
      
      await deletePost(1)
      
      expect(axios.delete).toHaveBeenCalledWith('https://jsonplaceholder.typicode.com/posts/1')
    })

    it('should throw error on failed deletion', async () => {
      vi.mocked(axios.delete).mockRejectedValue(new Error('Delete failed'))
      
      await expect(deletePost(1)).rejects.toThrow('Delete failed')
    })
  })
})
