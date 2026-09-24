'use client';
import { ThemeProvider } from 'next-themes';
import { Toaster } from 'sonner';

export function Providers({ children, dir }: { children: React.ReactNode; dir: 'ltr' | 'rtl' }) {
  return (
    <ThemeProvider attribute="class" defaultTheme="system" enableSystem disableTransitionOnChange>
      {children}
      <Toaster
        richColors
        closeButton
        dir={dir}
        position="top-center"
        toastOptions={{ classNames: { toast: 'rounded-xl border shadow-lg' } }}
      />
    </ThemeProvider>
  );
}
