import { describe, it, expect } from 'vitest'
import { render, screen } from '@testing-library/react'
import { UserCard, PostCard } from './UserCard'

describe('UserCard', () => {
  it('should render user information', () => {
    render(<UserCard name="john doe" email="john@example.com" role="admin" />)
    
    expect(screen.getByText('John doe')).toBeInTheDocument()
    expect(screen.getByText('john@example.com')).toBeInTheDocument()
    expect(screen.getByText('Admin')).toBeInTheDocument()
  })

  it('should capitalize name and role', () => {
    render(<UserCard name="jane smith" email="jane@test.com" role="user" />)
    
    expect(screen.getByText('Jane smith')).toBeInTheDocument()
    expect(screen.getByText('User')).toBeInTheDocument()
  })

  it('should render with correct class name', () => {
    const { container } = render(
      <UserCard name="test" email="test@test.com" role="user" />
    )
    
    expect(container.querySelector('.user-card')).toBeInTheDocument()
  })
})

describe('PostCard', () => {
  it('should render post title and body', () => {
    render(<PostCard title="test title" body="test body content" />)
    
    expect(screen.getByText('Test title')).toBeInTheDocument()
    expect(screen.getByText('test body content')).toBeInTheDocument()
  })

  it('should capitalize title', () => {
    render(<PostCard title="hello world" body="content" />)
    
    expect(screen.getByText('Hello world')).toBeInTheDocument()
  })

  it('should render with correct class name', () => {
    const { container } = render(<PostCard title="title" body="body" />)
    
    expect(container.querySelector('.post-card')).toBeInTheDocument()
  })
})
