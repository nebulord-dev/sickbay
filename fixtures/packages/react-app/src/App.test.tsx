import { describe, it, expect, vi } from 'vitest'
import { render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import App from './App'
import * as useDataHook from './hooks/useData'

vi.mock('./hooks/useData')

describe('App', () => {
  it('should render header component', () => {
    vi.mocked(useDataHook.useData).mockReturnValue({
      posts: [],
      loading: false,
      error: null
    })

    render(<App />)
    
    expect(screen.getByText('My App')).toBeInTheDocument()
  })

  it('should render user card with correct props', () => {
    vi.mocked(useDataHook.useData).mockReturnValue({
      posts: [],
      loading: false,
      error: null
    })

    render(<App />)
    
    expect(screen.getByText('Jane doe')).toBeInTheDocument()
    expect(screen.getByText('jane@example.com')).toBeInTheDocument()
    expect(screen.getByText('Admin')).toBeInTheDocument()
  })

  it('should render counter button with initial count', () => {
    vi.mocked(useDataHook.useData).mockReturnValue({
      posts: [],
      loading: false,
      error: null
    })

    render(<App />)
    
    expect(screen.getByText('count is 0')).toBeInTheDocument()
  })

  it('should increment counter on button click', async () => {
    vi.mocked(useDataHook.useData).mockReturnValue({
      posts: [],
      loading: false,
      error: null
    })

    const user = userEvent.setup()
    render(<App />)
    
    const button = screen.getByRole('button', { name: /count is/i })
    
    await user.click(button)
    expect(screen.getByText('count is 1')).toBeInTheDocument()
    
    await user.click(button)
    expect(screen.getByText('count is 2')).toBeInTheDocument()
  })

  it('should render post list component', () => {
    vi.mocked(useDataHook.useData).mockReturnValue({
      posts: [
        { id: 1, title: 'Test Post', body: 'Test Body', userId: 1 }
      ],
      loading: false,
      error: null
    })

    render(<App />)
    
    expect(screen.getByText('Test Post')).toBeInTheDocument()
  })
})
