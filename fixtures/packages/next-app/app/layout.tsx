// Intentional: Google Fonts loaded via external stylesheet link.
// This triggers the next-fonts check.
import { StaticHeader } from './components/StaticHeader';

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en">
      <head>
        <link rel="preconnect" href="https://fonts.googleapis.com" />
        <link
          rel="stylesheet"
          href="https://fonts.googleapis.com/css2?family=Inter:wght@400;700&display=swap"
        />
      </head>
      <body>
        <StaticHeader />
        {children}
      </body>
    </html>
  );
}
