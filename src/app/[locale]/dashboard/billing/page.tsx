import { getLocale, getTranslations } from 'next-intl/server';
import { AlertTriangle, Check, CheckCircle2, CreditCard, Mail, MessageCircle, X } from 'lucide-react';
import { prisma } from '@/lib/db';
import { requireOrgPageRole } from '@/lib/guards';
import { getAllPlanLimits, type PlanLimits } from '@/lib/plans';
import { CURRENCY } from '@/lib/plans-shared';
import { ENTITLED_STATUSES } from '@/lib/billing-rules';
import { purchasablePlans, stripe } from '@/lib/billing';
import { formatDate } from '@/lib/format';
import { redirectTo } from '@/i18n/server';
import { Card, CardContent } from '@/components/ui/card';
import { cn } from '@/lib/utils';
import { BillingButton } from './billing-button';

export const dynamic = 'force-dynamic';

export async function generateMetadata() {
  const t = await getTranslations('billing');
  return { title: t('title') };
}

const STATUS_STYLE: Record<string, string> = {
  active: 'bg-emerald-100 text-emerald-700 dark:bg-emerald-950 dark:text-emerald-300',
  trialing: 'bg-sky-100 text-sky-700 dark:bg-sky-950 dark:text-sky-300',
  past_due: 'bg-amber-100 text-amber-800 dark:bg-amber-950 dark:text-amber-300',
};

export default async function BillingPage({ searchParams }: { searchParams: Promise<{ status?: string }> }) {
  const auth = await requireOrgPageRole('owner');
  const [org, plans, t, tp, locale, sp] = await Promise.all([
    prisma.organization.findUnique({
      where: { id: auth.orgId },
      select: { name: true, plan: true, billingStatus: true, planRenewsAt: true, cancelAtPeriodEnd: true, stripeCustomerId: true, stripeSubscriptionId: true },
    }),
    getAllPlanLimits(),
    getTranslations('billing'),
    getTranslations('plans'),
    getLocale(),
    searchParams,
  ]);
  if (!org) return redirectTo('/login');

  const online = !!stripe();
  const purchasable = purchasablePlans();
  const subscribed = !!org.stripeSubscriptionId && (ENTITLED_STATUSES as readonly string[]).includes(org.billingStatus ?? '');
  const whatsapp = (process.env.SUPPORT_WHATSAPP ?? '').replace(/\D/g, '');
  const email = process.env.SUPPORT_EMAIL || null;
  const planName = (p: string) => (tp.has(p) ? tp(p) : p);
  const current = plans.find((p) => p.plan === org.plan);

  return (
    <div className="container max-w-5xl py-6">
      <h1 className="mb-1 flex items-center gap-2 text-2xl font-bold">
        <CreditCard className="h-6 w-6 text-primary" /> {t('title')}
      </h1>
      <p className="mb-6 text-muted-foreground">{t('subtitle')}</p>

      {sp.status === 'success' && (
        <Notice tone="success" icon={<CheckCircle2 className="h-5 w-5" />} text={t('successNotice')} />
      )}
      {sp.status === 'cancelled' && <Notice tone="muted" icon={<X className="h-5 w-5" />} text={t('cancelledNotice')} />}
      {org.billingStatus === 'past_due' && (
        <Notice tone="warning" icon={<AlertTriangle className="h-5 w-5" />} text={t('pastDueNotice')}>
          {online && org.stripeCustomerId && (
            <div className="mt-3 max-w-xs">
              <BillingButton action="portal" label={t('updatePayment')} />
            </div>
          )}
        </Notice>
      )}

      <Card className="mb-8">
        <CardContent className="flex flex-wrap items-center justify-between gap-4 p-6">
          <div>
            <div className="text-sm text-muted-foreground">{t('currentPlan')}</div>
            <div className="mt-1 flex flex-wrap items-center gap-2">
              <span className="text-2xl font-bold">{planName(org.plan)}</span>
              {org.billingStatus && (
                <span className={cn('rounded-full px-2 py-0.5 text-xs font-medium', STATUS_STYLE[org.billingStatus] ?? 'bg-muted text-muted-foreground')}>
                  {t.has(`status.${org.billingStatus}`) ? t(`status.${org.billingStatus}`) : org.billingStatus}
                </span>
              )}
            </div>
            {current && current.price > 0 && (
              <div className="mt-1 text-sm text-muted-foreground">{t('perMonth', { price: current.price, currency: CURRENCY })}</div>
            )}
            {subscribed && org.planRenewsAt && (
              <div className="mt-1 text-sm text-muted-foreground">
                {org.cancelAtPeriodEnd
                  ? t('endsOn', { date: formatDate(org.planRenewsAt, locale) })
                  : t('renewsOn', { date: formatDate(org.planRenewsAt, locale) })}
              </div>
            )}
          </div>
          {online && org.stripeCustomerId && (
            <div className="w-full sm:w-56">
              <BillingButton action="portal" variant="outline" label={t('manage')} />
            </div>
          )}
        </CardContent>
      </Card>

      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
        {plans.map((p) => {
          const isCurrent = p.plan === org.plan;
          return (
            <Card key={p.plan} className={cn('flex flex-col', isCurrent && 'border-primary ring-1 ring-primary')}>
              <CardContent className="flex flex-1 flex-col p-5">
                <div className="text-lg font-semibold">{planName(p.plan)}</div>
                <div className="mt-1 text-2xl font-extrabold">
                  {p.price === 0 ? t('free') : t('perMonth', { price: p.price, currency: CURRENCY })}
                </div>
                <ul className="my-4 flex-1 space-y-1.5 text-sm">
                  {features(p, t).map(([label, on]) => (
                    <li key={label} className={cn('flex items-start gap-2', !on && 'text-muted-foreground line-through decoration-muted-foreground/40')}>
                      {on ? <Check className="mt-0.5 h-4 w-4 flex-shrink-0 text-emerald-600" /> : <X className="mt-0.5 h-4 w-4 flex-shrink-0" />}
                      {label}
                    </li>
                  ))}
                </ul>
                <PlanAction
                  plan={p.plan}
                  isCurrent={isCurrent}
                  online={online}
                  purchasable={purchasable.includes(p.plan)}
                  subscribed={subscribed}
                  hasCustomer={!!org.stripeCustomerId}
                  contactUrl={
                    whatsapp
                      ? `https://wa.me/${whatsapp}?text=${encodeURIComponent(t('contactMessage', { org: org.name, plan: planName(p.plan) }))}`
                      : email
                        ? `mailto:${email}?subject=${encodeURIComponent(t('contactMessage', { org: org.name, plan: planName(p.plan) }))}`
                        : null
                  }
                  viaWhatsapp={!!whatsapp}
                  t={t}
                />
              </CardContent>
            </Card>
          );
        })}
      </div>
      {!online && <p className="mt-6 text-sm text-muted-foreground">{t('manualBilling')}</p>}
    </div>
  );
}

type T = Awaited<ReturnType<typeof getTranslations<'billing'>>>;

function features(p: PlanLimits, t: T): [string, boolean][] {
  return [
    [t('featureBranches', { count: p.maxBranches }), true],
    [t('featureEmployees', { count: p.maxEmployees }), true],
    [t('featureServices', { count: p.maxServices }), true],
    [t('featureBooking'), p.allowBooking],
    [t('featureAnalytics'), p.allowAnalytics],
    [t('featureBrand'), p.allowCustomBrand],
    [p.smsQuota > 0 ? t('featureSms', { count: p.smsQuota }) : t('featureSmsNone'), p.smsQuota > 0],
  ];
}

function PlanAction(props: {
  plan: string;
  isCurrent: boolean;
  online: boolean;
  purchasable: boolean;
  subscribed: boolean;
  hasCustomer: boolean;
  contactUrl: string | null;
  viaWhatsapp: boolean;
  t: T;
}) {
  const { plan, isCurrent, online, purchasable, subscribed, hasCustomer, contactUrl, viaWhatsapp, t } = props;
  if (isCurrent) return <div className="rounded-lg bg-primary/10 py-2 text-center text-sm font-medium text-primary">{t('currentBadge')}</div>;
  // Abonné : tout changement (y compris le retour à l'offre gratuite) passe par le portail Stripe.
  if (online && subscribed && hasCustomer) return <BillingButton action="portal" variant="outline" label={t('change')} />;
  if (plan === 'free') return null;
  if (online && purchasable) return <BillingButton action="checkout" plan={plan} label={t('choose')} />;
  if (!contactUrl) return <p className="text-center text-xs text-muted-foreground">{t('contactFallback')}</p>;
  return (
    <a
      href={contactUrl}
      target="_blank"
      rel="noopener noreferrer"
      className="inline-flex h-10 w-full items-center justify-center gap-2 rounded-lg border bg-background px-4 text-sm font-medium hover:bg-accent"
    >
      {viaWhatsapp ? <MessageCircle className="h-4 w-4" /> : <Mail className="h-4 w-4" />}
      {t('contact')}
    </a>
  );
}

function Notice({ tone, icon, text, children }: { tone: 'success' | 'warning' | 'muted'; icon: React.ReactNode; text: string; children?: React.ReactNode }) {
  const styles = {
    success: 'border-emerald-300 bg-emerald-50 text-emerald-900 dark:border-emerald-800 dark:bg-emerald-950/40 dark:text-emerald-200',
    warning: 'border-amber-300 bg-amber-50 text-amber-900 dark:border-amber-800 dark:bg-amber-950/40 dark:text-amber-200',
    muted: 'border-border bg-muted/50 text-foreground',
  };
  return (
    <div className={cn('mb-6 rounded-2xl border p-4 text-sm', styles[tone])}>
      <div className="flex items-start gap-2">
        <span className="mt-0.5 flex-shrink-0">{icon}</span>
        <div className="flex-1">
          <p>{text}</p>
          {children}
        </div>
      </div>
    </div>
  );
}
