import { getTranslations } from 'next-intl/server';
import { Link } from '@/i18n/routing';
import { requireOrgPage } from '@/lib/guards';
import { getActiveBranch, listOrgBranches } from '@/lib/branch';
import { prisma } from '@/lib/db';
import { ThemeToggle } from '@/components/theme-toggle';
import { LanguageSwitcher } from '@/components/language-switcher';
import { LogoutButton } from '@/components/logout-button';
import { DashboardNav } from './dashboard-nav';
import { BranchSwitcher } from './branch-switcher';
import { ImpersonationBanner } from '@/components/impersonation-banner';

export const dynamic = 'force-dynamic';

export default async function DashboardLayout({ children }: { children: React.ReactNode }) {
  const auth = await requireOrgPage();
  const [org, branches, active] = await Promise.all([
    prisma.organization.findUnique({ where: { id: auth.orgId }, select: { name: true } }),
    listOrgBranches(auth.orgId),
    getActiveBranch(auth),
  ]);
  const t = await getTranslations('dashboard');

  return (
    <div className="min-h-screen bg-background">
      {auth.impersonating && <ImpersonationBanner orgName={org?.name ?? ''} />}
      <header className="sticky top-0 z-30 border-b bg-card/95 backdrop-blur">
        <div className="container flex h-14 items-center justify-between gap-2">
          <div className="flex min-w-0 items-center gap-2">
            <Link href="/dashboard" className="flex shrink-0 items-center gap-2 font-bold">
              <span className="inline-flex h-7 w-7 items-center justify-center rounded-md bg-primary text-sm text-primary-foreground">
                D
              </span>
              <span className="hidden max-w-[10rem] truncate lg:inline">{org?.name}</span>
            </Link>
            {branches.length > 1 && active && (
              <BranchSwitcher
                label={t('branch')}
                activeId={active.id}
                branches={branches.map((b) => ({ id: b.id, name: b.name }))}
              />
            )}
          </div>
          <div className="flex items-center gap-1">
            <DashboardNav />
            <ThemeToggle className="ms-1 hidden md:inline-flex" />
            <LanguageSwitcher compact className="sm:hidden" />
            <LanguageSwitcher className="hidden sm:inline-flex" />
            <LogoutButton />
          </div>
        </div>
      </header>
      <main>{children}</main>
    </div>
  );
}
