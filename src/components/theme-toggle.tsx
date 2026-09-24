'use client';
import { Moon, Sun, Monitor } from 'lucide-react';
import { useTheme } from 'next-themes';
import { useTranslations } from 'next-intl';
import { useEffect, useState } from 'react';

export function ThemeToggle({ className = '' }: { className?: string }) {
  const { theme, setTheme } = useTheme();
  const t = useTranslations('theme');
  const [mounted, setMounted] = useState(false);
  useEffect(() => setMounted(true), []);
  if (!mounted) {
    return <div className={`h-8 w-[5.5rem] rounded-full bg-muted ${className}`} />;
  }
  const opts = [
    { v: 'light', icon: <Sun className="h-3.5 w-3.5" /> },
    { v: 'dark', icon: <Moon className="h-3.5 w-3.5" /> },
    { v: 'system', icon: <Monitor className="h-3.5 w-3.5" /> },
  ] as const;
  return (
    <div role="radiogroup" aria-label={t('label')} className={`inline-flex items-center gap-0.5 rounded-full bg-muted p-0.5 ${className}`}>
      {opts.map((o) => (
        <button
          key={o.v}
          type="button"
          role="radio"
          aria-checked={theme === o.v}
          onClick={() => setTheme(o.v)}
          aria-label={t(o.v)}
          title={t(o.v)}
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
