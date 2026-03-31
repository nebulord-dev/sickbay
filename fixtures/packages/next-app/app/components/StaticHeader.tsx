"use client";

// Intentional: this component has no hooks and no event handlers.
// The use-client directive is unnecessary here — triggers next-client-components.
export function StaticHeader() {
  return (
    <header>
      <h1>My App</h1>
      <nav>Home | About | Dashboard</nav>
    </header>
  );
}
