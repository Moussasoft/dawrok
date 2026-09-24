import type { ReactNode } from 'react';

// Les balises <html>/<body> sont rendues par `app/[locale]/layout.tsx` (langue et sens d'écriture).
export default function RootLayout({ children }: { children: ReactNode }) {
  return children;
}
