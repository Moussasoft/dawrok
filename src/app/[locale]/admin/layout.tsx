import { getTranslations } from 'next-intl/server';
import { Shield, Building2, BarChart3, Activity, Settings } from 'lucide-react';
import { Link } from '@/i18n/routing';
import { prisma } from '@/lib/db';
import { requireSuperadminPage } from '@/lib/guards';
import { LanguageSwitcher } from '@/components/language-switcher';
import { ThemeToggle } from '@/components/theme-toggle';
import { LogoutButton } from '@/components/logout-button';
import { ImpersonationBanner } from '@/components/impersonation-banner';

export const dynamic = 'force-dynamic';

export default async function AdminLayout({ children }: { children: React.ReactNode }) {
  const auth = await requireSuperadminPage();
  const t = await getTranslations('admin');
  const org = auth.impersonating && auth.orgId
    ? await prisma.organization.findUnique({ where: { id: auth.orgId }, select: { name: true } })
    : null;

  const items = [
    { href: '/admin', label: t('overview'), icon: BarChart3 },
    { href: '/admin/orgs', label: t('organizations'), icon: Building2 },
    { href: '/admin/audit', label: t('audit'), icon: Activity },
    { href: '/admin/settings', label: t('settings'), icon: Settings },
  ];

  return (
    <div className="min-h-screen bg-background">
      {auth.impersonating && <ImpersonationBanner orgName={org?.name ?? ''} />}
      <header className="sticky top-0 z-30 border-b bg-card/95 backdrop-blur">
        <div className="container flex h-14 items-center justify-between gap-2">
          <Link href="/admin" className="flex items-center gap-2 font-bold">
            <span className="inline-flex h-7 w-7 items-center justify-center rounded-md bg-rose-600 text-white">
              <Shield className="h-4 w-4" />
            </span>
            <span className="hidden sm:inline">{t('consoleName')}</span>
          </Link>
          <nav className="flex items-center gap-1">
            {items.map(({ href, label, icon: Icon }) => (
              <Link
                key={href}
                href={href}
                aria-label={label}
                className="inline-flex h-9 items-center gap-1.5 rounded-md px-2.5 text-sm text-muted-foreground hover:bg-accent hover:text-foreground"
              >
                <Icon className="h-5 w-5" />
                <span className="hidden md:inline">{label}</span>
              </Link>
            ))}
            <ThemeToggle className="ms-1 hidden lg:inline-flex" />
            <LanguageSwitcher compact className="sm:hidden" />
            <LanguageSwitcher className="hidden sm:inline-flex" />
            <LogoutButton />
          </nav>
        </div>
      </header>
      <main>{children}</main>
    </div>
  );
}
