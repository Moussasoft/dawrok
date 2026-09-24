import { getLocale, getTranslations } from 'next-intl/server';
import { Phone, User, Calendar, X, Award, Search } from 'lucide-react';
import { containsText, prisma } from '@/lib/db';
import { requireOrgPageRole } from '@/lib/guards';
import { getActiveBranch } from '@/lib/branch';
import { redirectTo } from '@/i18n/server';
import { Card, CardContent } from '@/components/ui/card';
import { formatDate } from '@/lib/format';
import { DEFAULT_TIMEZONE } from '@/lib/time';
import { CustomerActions } from './customer-actions';

export const dynamic = 'force-dynamic';

export async function generateMetadata() {
  const t = await getTranslations('customers');
  return { title: t('title') };
}

export default async function CustomersPage({ searchParams }: { searchParams: Promise<{ q?: string }> }) {
  const auth = await requireOrgPageRole('manager');
  const [branch, t, locale, sp] = await Promise.all([
    getActiveBranch(auth),
    getTranslations('customers'),
    getLocale(),
    searchParams,
  ]);
  if (!branch) return redirectTo('/dashboard');
  const q = sp.q?.trim().slice(0, 80) ?? '';
  const tz = branch.timezone || DEFAULT_TIMEZONE;

  const customers = await prisma.customer.findMany({
    where: {
      branchId: branch.id,
      ...(q ? { OR: [{ name: containsText(q) }, { phone: containsText(q) }] } : {}),
    },
    orderBy: [{ totalVisits: 'desc' }, { lastVisitAt: 'desc' }],
    take: 200,
  });

  return (
    <div className="container max-w-5xl py-6">
      <div className="mb-4 flex flex-wrap items-center justify-between gap-2">
        <div>
          <h1 className="text-2xl font-bold">{t('title')}</h1>
          <p className="text-sm text-muted-foreground">{t('count', { count: customers.length })}</p>
        </div>
        <form role="search" className="relative">
          <Search className="pointer-events-none absolute start-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
          <input
            name="q"
            type="search"
            defaultValue={q}
            placeholder={t('search')}
            aria-label={t('search')}
            className="w-64 rounded-lg border bg-background py-2 pe-3 ps-9 text-sm"
          />
        </form>
      </div>

      {customers.length === 0 ? (
        <Card>
          <CardContent className="p-12 text-center">
            <User className="mx-auto mb-3 h-12 w-12 text-muted-foreground/40" />
            <div className="font-medium">{t('emptyTitle')}</div>
            <div className="mt-1 text-sm text-muted-foreground">{t('emptyDesc')}</div>
          </CardContent>
        </Card>
      ) : (
        <div className="overflow-hidden rounded-2xl border bg-card">
          <table className="w-full text-sm">
            <thead className="bg-muted/50 text-xs uppercase text-muted-foreground">
              <tr>
                <th className="p-3 text-start">{t('customer')}</th>
                <th className="hidden p-3 text-start sm:table-cell">{t('phone')}</th>
                <th className="p-3 text-end">{t('visits')}</th>
                <th className="hidden p-3 text-end md:table-cell">{t('noShow')}</th>
                <th className="hidden p-3 text-end md:table-cell">{t('lastVisit')}</th>
                <th className="p-3 text-end">
                  <span className="sr-only">{t('actions')}</span>
                </th>
              </tr>
            </thead>
            <tbody>
              {customers.map((c) => (
                <tr key={c.id} className="border-t hover:bg-accent/30">
                  <td className="p-3">
                    <div className="flex items-center gap-2">
                      {c.totalVisits >= 10 && (
                        <Award className="h-4 w-4 text-amber-500" aria-label={t('vip')}>
                          <title>{t('vip')}</title>
                        </Award>
                      )}
                      <div>
                        <div className="font-medium">{c.name}</div>
                        <div className="flex items-center gap-1 text-xs text-muted-foreground sm:hidden" dir="ltr">
                          <Phone className="h-3 w-3" /> {c.phone}
                        </div>
                      </div>
                    </div>
                  </td>
                  <td className="hidden p-3 text-muted-foreground sm:table-cell" dir="ltr">
                    {c.phone}
                  </td>
                  <td className="p-3 text-end font-bold tabular-nums">{c.totalVisits}</td>
                  <td className="hidden p-3 text-end md:table-cell">
                    {c.noShowCount > 0 ? (
                      <span className="inline-flex items-center gap-1 text-xs text-destructive">
                        <X className="h-3 w-3" /> {c.noShowCount}
                      </span>
                    ) : (
                      <span className="text-muted-foreground">—</span>
                    )}
                  </td>
                  <td className="hidden p-3 text-end text-xs text-muted-foreground md:table-cell">
                    {c.lastVisitAt ? (
                      <span className="inline-flex items-center gap-1">
                        <Calendar className="h-3 w-3" />
                        {formatDate(c.lastVisitAt, locale, tz)}
                      </span>
                    ) : (
                      '—'
                    )}
                  </td>
                  <td className="p-2">
                    <CustomerActions id={c.id} name={c.name} />
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}
