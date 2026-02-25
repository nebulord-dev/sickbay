import { formatDate } from '../utils/formatter.js';

// Unused component - never imported in App.tsx
export function OldBanner() {
  return <div className="old-banner">This is deprecated</div>;
}

export function Header() {
  return (
    <header>
      <h1>My App</h1>
      <span>{formatDate(new Date())}</span>
    </header>
  );
}
