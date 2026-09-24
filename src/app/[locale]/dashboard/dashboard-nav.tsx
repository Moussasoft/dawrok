'use client';
import { useTranslations } from 'next-intl';
import { LayoutDashboard, BarChart3, QrCode, Settings, Users } from 'lucide-react';
import { Link, usePathname } from '@/i18n/routing';
import { cn } from '@/lib/utils';

const ITEMS = [
  { href: '/dashboard', key: 'file', icon: LayoutDashboard },
  { href: '/dashboard/analytics', key: 'analytics', icon: BarChart3 },
  { href: '/dashboard/customers', key: 'customers', icon: Users },
  { href: '/dashboard/qr', key: 'qrCode', icon: QrCode },
  { href: '/dashboard/settings', key: 'settings', icon: Settings },
] as const;

export function DashboardNav() {
  const t = useTranslations('dashboard');
  const pathname = usePathname();
  return (
    <nav className="flex items-center gap-0.5">
      {ITEMS.map(({ href, key, icon: Icon }) => {
        const active = href === '/dashboard' ? pathname === href : pathname.startsWith(href);
        return (
          <Link
            key={href}
            href={href}
            aria-label={t(key)}
            aria-current={active ? 'page' : undefined}
            className={cn(
              'inline-flex h-9 items-center gap-1.5 rounded-md px-2.5 text-sm transition-colors',
              active ? 'bg-primary/10 font-medium text-primary' : 'text-muted-foreground hover:bg-accent hover:text-foreground'
            )}
          >
            <Icon className="h-5 w-5" />
            <span className="hidden lg:inline">{t(key)}</span>
          </Link>
        );
      })}
    </nav>
  );
}
