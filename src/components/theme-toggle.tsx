'use client';
import { Moon, Sun, Monitor } from 'lucide-react';
import { useTheme } from 'next-themes';
import { useEffect, useState } from 'react';

export function ThemeToggle({ className = '' }: { className?: string }) {
  const { theme, setTheme } = useTheme();
  const [mounted, setMounted] = useState(false);
  useEffect(() => setMounted(true), []);
  if (!mounted) {
    return <div className={`h-9 w-24 rounded-full bg-muted ${className}`} />;
  }
  const opts: { v: string; icon: React.ReactNode; label: string }[] = [
    { v: 'light', icon: <Sun className="h-3.5 w-3.5" />, label: 'Clair' },
    { v: 'dark', icon: <Moon className="h-3.5 w-3.5" />, label: 'Sombre' },
    { v: 'system', icon: <Monitor className="h-3.5 w-3.5" />, label: 'Auto' },
  ];
  return (
    <div className={`inline-flex items-center gap-0.5 rounded-full bg-muted p-0.5 ${className}`}>
      {opts.map((o) => (
        <button
          key={o.v}
          type="button"
          onClick={() => setTheme(o.v)}
          aria-label={o.label}
          title={o.label}
          className={`inline-flex h-7 w-8 items-center justify-center rounded-full text-xs transition-colors ${
            theme === o.v ? 'bg-card text-foreground shadow-sm' : 'text-muted-foreground hover:text-foreground'
          }`}
        >
          {o.icon}
        </button>
      ))}
    </div>
  );
}
