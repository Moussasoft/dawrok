'use client';
import { useTranslations } from 'next-intl';
import { LayoutDashboard, BarChart3, QrCode, Settings, Users } from 'lucide-react';
import { Link, usePathname } from '@/i18n/routing';
import { cn } from '@/lib/utils';
import { hasRole, type Role } from '@/lib/roles';

// Onglets visibles selon le rôle (les pages et l'API vérifient aussi les droits).
const ITEMS = [
  { href: '/dashboard', key: 'file', icon: LayoutDashboard, min: 'staff' },
  { href: '/dashboard/analytics', key: 'analytics', icon: BarChart3, min: 'manager' },
  { href: '/dashboard/customers', key: 'customers', icon: Users, min: 'manager' },
  { href: '/dashboard/qr', key: 'qrCode', icon: QrCode, min: 'staff' },
  { href: '/dashboard/settings', key: 'settings', icon: Settings, min: 'manager' },
] as const satisfies readonly { href: string; key: string; icon: unknown; min: Role }[];

export function DashboardNav({ role }: { role: string }) {
  const t = useTranslations('dashboard');
  const pathname = usePathname();
  return (
    <nav className="flex items-center gap-0.5">
      {ITEMS.filter((item) => hasRole(role, item.min)).map(({ href, key, icon: Icon }) => {
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
