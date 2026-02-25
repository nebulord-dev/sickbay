import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { render, fireEvent } from '@testing-library/react';
import { CRTOverlay } from './CRTOverlay.js';

beforeEach(() => {
  vi.useFakeTimers();
});

afterEach(() => {
  vi.useRealTimers();
});

describe('CRTOverlay', () => {
  it('renders without crashing', () => {
    const { container } = render(<CRTOverlay onClose={vi.fn()} />);
    expect(container.firstChild).toBeTruthy();
  });

  it('calls onClose when the overlay is clicked', () => {
    const onClose = vi.fn();
    render(<CRTOverlay onClose={onClose} />);
    fireEvent.click(document.querySelector('.fixed') as Element);
    expect(onClose).toHaveBeenCalledTimes(1);
  });

  it('calls onClose when the Escape key is pressed', () => {
    const onClose = vi.fn();
    render(<CRTOverlay onClose={onClose} />);
    fireEvent.keyDown(document, { key: 'Escape' });
    expect(onClose).toHaveBeenCalledTimes(1);
  });

  it('calls onClose when the Enter key is pressed', () => {
    const onClose = vi.fn();
    render(<CRTOverlay onClose={onClose} />);
    fireEvent.keyDown(document, { key: 'Enter' });
    expect(onClose).toHaveBeenCalledTimes(1);
  });

  it('does not call onClose for other key presses', () => {
    const onClose = vi.fn();
    render(<CRTOverlay onClose={onClose} />);
    fireEvent.keyDown(document, { key: 'Space' });
    fireEvent.keyDown(document, { key: 'a' });
    expect(onClose).not.toHaveBeenCalled();
  });

  it('removes the keydown listener on unmount', () => {
    const onClose = vi.fn();
    const { unmount } = render(<CRTOverlay onClose={onClose} />);
    unmount();
    fireEvent.keyDown(document, { key: 'Escape' });
    expect(onClose).not.toHaveBeenCalled();
  });

  it('renders the scanline and vignette overlay elements', () => {
    const { container } = render(<CRTOverlay onClose={vi.fn()} />);
    // The overlay should have multiple decorative layers
    const divs = container.querySelectorAll('.absolute');
    expect(divs.length).toBeGreaterThan(0);
  });
});
