import { describe, it, expect } from 'vitest'
import { render, screen } from '@testing-library/react'
import { Header, OldBanner } from './Header'

describe('Header', () => {
  it('should render app title', () => {
    render(<Header />)
    
    expect(screen.getByText('My App')).toBeInTheDocument()
  })

  it('should render current date', () => {
    render(<Header />)
    
    const dateElement = screen.getByText(/\d{4}/)
    expect(dateElement).toBeInTheDocument()
  })

  it('should render header element', () => {
    const { container } = render(<Header />)
    
    expect(container.querySelector('header')).toBeInTheDocument()
  })
})

describe('OldBanner', () => {
  it('should render deprecated message', () => {
    render(<OldBanner />)
    
    expect(screen.getByText('This is deprecated')).toBeInTheDocument()
  })

  it('should render with correct class name', () => {
    const { container } = render(<OldBanner />)
    
    expect(container.querySelector('.old-banner')).toBeInTheDocument()
  })
})
