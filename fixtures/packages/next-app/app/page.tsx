// Intentional issues:
// 1. Raw image element used instead of the optimized image component — triggers next-images.
// 2. Raw anchor tag used for internal navigation — triggers next-link.
export default function HomePage() {
  return (
    <main>
      <h1>Welcome</h1>
      <img src="/hero.jpg" alt="Hero" width={800} height={400} />
      <nav>
        <a href="/about">About</a>
        <a href="/dashboard">Dashboard</a>
      </nav>
    </main>
  );
}
