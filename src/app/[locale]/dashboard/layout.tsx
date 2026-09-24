import { getTranslations } from 'next-intl/server';
import { Link } from '@/i18n/routing';
import { requireOrgPage } from '@/lib/guards';
import { getActiveBranch, listOrgBranches } from '@/lib/branch';
import { prisma } from '@/lib/db';
import { ThemeToggle } from '@/components/theme-toggle';
import { LanguageSwitcher } from '@/components/language-switcher';
import { UserMenu } from '@/components/user-menu';
import { DashboardNav } from './dashboard-nav';
import { BranchSwitcher } from './branch-switcher';
import { ImpersonationBanner } from '@/components/impersonation-banner';
import { AlertTriangle } from 'lucide-react';
import { hasRole } from '@/lib/roles';

export const dynamic = 'force-dynamic';

export default async function DashboardLayout({ children }: { children: React.ReactNode }) {
  const auth = await requireOrgPage();
  const [org, branches, active] = await Promise.all([
    prisma.organization.findUnique({ where: { id: auth.orgId }, select: { name: true, logoUrl: true, billingStatus: true } }),
    listOrgBranches(auth.orgId),
    getActiveBranch(auth),
  ]);
  const [t, tb] = await Promise.all([getTranslations('dashboard'), getTranslations('billing')]);

  return (
    <div className="min-h-screen bg-background">
      {auth.impersonating && <ImpersonationBanner orgName={org?.name ?? ''} />}
      <header className="sticky top-0 z-30 border-b bg-card/95 backdrop-blur">
        <div className="container flex h-14 items-center justify-between gap-2">
          <div className="flex min-w-0 items-center gap-2">
            <Link href="/dashboard" className="flex shrink-0 items-center gap-2 font-bold">
              {org?.logoUrl ? (
                // eslint-disable-next-line @next/next/no-img-element
                <img src={org.logoUrl} alt="" className="h-7 w-7 rounded-md object-contain" />
              ) : (
                <span className="inline-flex h-7 w-7 items-center justify-center rounded-md bg-primary text-sm text-primary-foreground">
                  D
                </span>
              )}
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
            <DashboardNav role={auth.role} />
            <ThemeToggle className="ms-1 hidden md:inline-flex" />
            <LanguageSwitcher compact className="sm:hidden" />
            <LanguageSwitcher className="hidden sm:inline-flex" />
            <UserMenu name={auth.name} email={auth.email} role={auth.role} />
          </div>
        </div>
      </header>
      {org?.billingStatus === 'past_due' && hasRole(auth.role, 'owner') && (
        <div className="border-b border-amber-300 bg-amber-50 text-sm text-amber-900 dark:border-amber-800 dark:bg-amber-950/40 dark:text-amber-200">
          <div className="container flex flex-wrap items-center justify-between gap-2 py-2">
            <span className="flex items-center gap-2">
              <AlertTriangle className="h-4 w-4" /> {tb('pastDueBanner')}
            </span>
            <Link href="/dashboard/billing" className="font-medium underline underline-offset-2">
              {tb('updatePayment')}
            </Link>
          </div>
        </div>
      )}
      <main>{children}</main>
    </div>
  );
}
