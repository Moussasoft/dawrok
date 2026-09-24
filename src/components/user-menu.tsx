'use client';
import { useEffect, useRef, useState } from 'react';
import { useLocale, useTranslations } from 'next-intl';
import { CreditCard, LogOut, UserRound, Users2 } from 'lucide-react';
import { Link } from '@/i18n/routing';
import { hasRole } from '@/lib/roles';

type Props = { name: string; email: string; role: string };

/** Menu du compte : profil, équipe et abonnement (propriétaire), déconnexion. */
export function UserMenu({ name, email, role }: Props) {
  const t = useTranslations('userMenu');
  const tr = useTranslations('roles');
  const locale = useLocale();
  const [open, setOpen] = useState(false);
  const ref = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!open) return;
    const onPointer = (e: MouseEvent) => {
      if (!ref.current?.contains(e.target as Node)) setOpen(false);
    };
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') setOpen(false);
    };
    document.addEventListener('mousedown', onPointer);
    document.addEventListener('keydown', onKey);
    return () => {
      document.removeEventListener('mousedown', onPointer);
      document.removeEventListener('keydown', onKey);
    };
  }, [open]);

  const owner = hasRole(role, 'owner');
  const items = [
    { href: '/dashboard/account', label: t('account'), icon: UserRound, show: true },
    { href: '/dashboard/team', label: t('team'), icon: Users2, show: owner },
    { href: '/dashboard/billing', label: t('billing'), icon: CreditCard, show: owner },
  ].filter((i) => i.show);

  return (
    <div ref={ref} className="relative">
      <button
        type="button"
        aria-haspopup="menu"
        aria-expanded={open}
        aria-label={t('open')}
        onClick={() => setOpen((o) => !o)}
        className="flex h-9 w-9 items-center justify-center rounded-full bg-primary/10 text-sm font-semibold uppercase text-primary hover:bg-primary/20"
      >
        {name.trim().charAt(0) || '?'}
      </button>
      {open && (
        <div role="menu" className="absolute end-0 top-11 z-50 w-64 rounded-xl border bg-card p-1 shadow-xl">
          <div className="px-3 py-2">
            <div className="truncate text-sm font-medium">{name}</div>
            <div className="truncate text-xs text-muted-foreground" dir="ltr">
              {email}
            </div>
            <div className="mt-1 inline-block rounded-full bg-muted px-2 py-0.5 text-[10px] font-medium">{tr.has(role) ? tr(role) : role}</div>
          </div>
          <div className="my-1 h-px bg-border" />
          {items.map(({ href, label, icon: Icon }) => (
            <Link
              key={href}
              href={href}
              role="menuitem"
              onClick={() => setOpen(false)}
              className="flex items-center gap-2 rounded-lg px-3 py-2 text-sm hover:bg-accent"
            >
              <Icon className="h-4 w-4 text-muted-foreground" /> {label}
            </Link>
          ))}
          <form action="/api/auth/logout" method="POST">
            <input type="hidden" name="locale" value={locale} />
            <button type="submit" role="menuitem" className="flex w-full items-center gap-2 rounded-lg px-3 py-2 text-sm text-destructive hover:bg-accent">
              <LogOut className="h-4 w-4 rtl:-scale-x-100" /> {t('logout')}
            </button>
          </form>
        </div>
      )}
    </div>
  );
}
