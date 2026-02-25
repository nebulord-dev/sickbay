import { describe, it, expect, vi } from 'vitest'
import { render, screen } from '@testing-library/react'
import { PostList } from './PostList'
import * as useDataHook from '../hooks/useData'

vi.mock('../hooks/useData')

describe('PostList', () => {
  it('should render loading state', () => {
    vi.mocked(useDataHook.useData).mockReturnValue({
      posts: [],
      loading: true,
      error: null
    })

    render(<PostList />)
    
    expect(screen.getByText('Loading...')).toBeInTheDocument()
  })

  it('should render error state', () => {
    vi.mocked(useDataHook.useData).mockReturnValue({
      posts: [],
      loading: false,
      error: 'Failed to fetch'
    })

    render(<PostList />)
    
    expect(screen.getByText('Error: Failed to fetch')).toBeInTheDocument()
  })

  it('should render posts list', () => {
    vi.mocked(useDataHook.useData).mockReturnValue({
      posts: [
        { id: 1, title: 'Post 1', body: 'Body 1', userId: 1 },
        { id: 2, title: 'Post 2', body: 'Body 2', userId: 1 }
      ],
      loading: false,
      error: null
    })

    render(<PostList />)
    
    expect(screen.getByText('Post 1')).toBeInTheDocument()
    expect(screen.getByText('Post 2')).toBeInTheDocument()
  })

  it('should truncate long post bodies', () => {
    const longBody = 'a'.repeat(150)
    vi.mocked(useDataHook.useData).mockReturnValue({
      posts: [
        { id: 1, title: 'Long Post', body: longBody, userId: 1 }
      ],
      loading: false,
      error: null
    })

    render(<PostList />)
    
    const bodyText = screen.getByText(/a+\.\.\./)
    expect(bodyText.textContent).toContain('...')
  })

  it('should limit to 10 posts', () => {
    const posts = Array.from({ length: 20 }, (_, i) => ({
      id: i + 1,
      title: `Post ${i + 1}`,
      body: `Body ${i + 1}`,
      userId: 1
    }))

    vi.mocked(useDataHook.useData).mockReturnValue({
      posts,
      loading: false,
      error: null
    })

    const { container } = render(<PostList />)
    
    const listItems = container.querySelectorAll('li')
    expect(listItems).toHaveLength(10)
  })
})
