import Image from 'next/image';
import { getLocale, getTranslations, setRequestLocale } from 'next-intl/server';
import {
  ArrowRight,
  QrCode,
  Smartphone,
  BarChart3,
  Bell,
  Users,
  CheckCircle2,
  Scissors,
  Stethoscope,
  Car,
  Building2,
  UtensilsCrossed,
  Zap,
  Clock,
  Languages,
} from 'lucide-react';
import { Link } from '@/i18n/routing';
import { Button } from '@/components/ui/button';
import { Card } from '@/components/ui/card';
import { LanguageSwitcher } from '@/components/language-switcher';
import { ThemeToggle } from '@/components/theme-toggle';
import { LegalLinks } from '@/components/legal-links';

// Page statique (composant serveur) : aucun JavaScript client hormis les sélecteurs thème/langue.

const SECTORS_VISUAL = [
  { k: 'hairdresser', i: Scissors, c: 'from-rose-500 to-pink-500', img: '/images/salon-coiffure.jpg' },
  { k: 'doctor', i: Stethoscope, c: 'from-sky-500 to-blue-500', img: '/images/cabinet-medical.jpg' },
  { k: 'vehicleInspection', i: Car, c: 'from-amber-500 to-orange-500', img: '/images/garage-auto.jpg' },
  { k: 'bank', i: Building2, c: 'from-violet-500 to-purple-500', img: '/images/banque-admin.jpg' },
  { k: 'restaurant', i: UtensilsCrossed, c: 'from-emerald-500 to-teal-500', img: '/images/restaurant.jpg' },
] as const;

function DashboardMockup({ label, labels }: { label: string; labels: [string, string, string] }) {
  const stats = [
    { c: 'bg-amber-100 dark:bg-amber-900/30', tc: 'text-amber-700 dark:text-amber-300', l: labels[0], v: '12' },
    { c: 'bg-blue-100 dark:bg-blue-900/30', tc: 'text-blue-700 dark:text-blue-300', l: labels[1], v: '3' },
    { c: 'bg-emerald-100 dark:bg-emerald-900/30', tc: 'text-emerald-700 dark:text-emerald-300', l: labels[2], v: '47' },
  ];
  const rows = [
    { n: '012', nm: 'Karim', tm: '2 min', a: true },
    { n: '013', nm: 'Sara', tm: '5 min', a: false },
    { n: '014', nm: 'Youssef', tm: '8 min', a: false },
  ];
  return (
    <div className="mx-auto max-w-sm overflow-hidden rounded-2xl border bg-card shadow-2xl" aria-hidden>
      <div className="flex items-center gap-2 border-b bg-muted/50 px-4 py-2.5">
        <div className="flex gap-1.5">
          <div className="h-2.5 w-2.5 rounded-full bg-red-400" />
          <div className="h-2.5 w-2.5 rounded-full bg-amber-400" />
          <div className="h-2.5 w-2.5 rounded-full bg-emerald-400" />
        </div>
        <span className="ms-3 truncate text-xs text-muted-foreground">{label}</span>
      </div>
      <div className="space-y-3 p-4">
        <div className="grid grid-cols-3 gap-2">
          {stats.map((s) => (
            <div key={s.l} className={`rounded-lg ${s.c} p-2 text-center`}>
              <div className={`text-lg font-bold ${s.tc}`}>{s.v}</div>
              <div className={`text-[10px] ${s.tc}`}>{s.l}</div>
            </div>
          ))}
        </div>
        <div className="space-y-1.5">
          {rows.map((x) => (
            <div
              key={x.n}
              className={`flex items-center justify-between rounded-lg border px-3 py-2 text-xs ${x.a ? 'border-primary/40 bg-primary/5' : ''}`}
            >
              <div className="flex items-center gap-2">
                <span
                  className={`inline-flex h-5 min-w-8 items-center justify-center rounded px-1 text-[10px] font-bold tabular-nums ${
                    x.a ? 'bg-primary text-primary-foreground' : 'bg-muted text-muted-foreground'
                  }`}
                >
                  {x.n}
                </span>
                <span className="font-medium">{x.nm}</span>
              </div>
              <span className="text-muted-foreground">{x.tm}</span>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}

export default async function HomePage({ params }: { params: Promise<{ locale: string }> }) {
  const { locale: requested } = await params;
  setRequestLocale(requested);
  const [t, locale] = await Promise.all([getTranslations(), getLocale()]);

  const steps = [
    { icon: QrCode, title: t('howItWorks.step1Title'), desc: t('howItWorks.step1Desc'), c: 'from-indigo-500 to-blue-500' },
    { icon: Smartphone, title: t('howItWorks.step2Title'), desc: t('howItWorks.step2Desc'), c: 'from-violet-500 to-purple-500' },
    { icon: BarChart3, title: t('howItWorks.step3Title'), desc: t('howItWorks.step3Desc'), c: 'from-emerald-500 to-teal-500' },
  ];
  const features = [
    { i: Bell, title: t('features.feature1Title'), desc: t('features.feature1Desc') },
    { i: Users, title: t('features.feature2Title'), desc: t('features.feature2Desc') },
    { i: BarChart3, title: t('features.feature3Title'), desc: t('features.feature3Desc') },
    { i: CheckCircle2, title: t('features.feature4Title'), desc: t('features.feature4Desc') },
  ];

  return (
    <main className="min-h-screen overflow-x-hidden">
      <nav className="sticky top-0 z-50 border-b bg-background/80 backdrop-blur-xl">
        <div className="container flex h-16 items-center justify-between gap-2">
          <Link href="/" className="flex items-center gap-2.5 text-xl font-bold">
            <span className="inline-flex h-9 w-9 items-center justify-center rounded-xl bg-gradient-to-br from-primary to-indigo-500 text-primary-foreground shadow-lg shadow-primary/25">
              D
            </span>
            <span className="hidden sm:inline">{t('common.siteName')}</span>
          </Link>
          <div className="flex items-center gap-1 sm:gap-2">
            <ThemeToggle className="hidden md:inline-flex" />
            <LanguageSwitcher />
            <Button asChild variant="ghost" size="sm">
              <Link href="/login">{t('nav.login')}</Link>
            </Button>
            <Button asChild size="sm" className="shadow-lg shadow-primary/25">
              <Link href="/signup">{t('nav.signup')}</Link>
            </Button>
          </div>
        </div>
      </nav>

      <section className="relative overflow-hidden">
        <div className="absolute inset-0 -z-10">
          <div className="absolute -end-40 -top-40 h-96 w-96 rounded-full bg-primary/10 blur-3xl" />
          <div className="absolute -bottom-20 -start-20 h-72 w-72 rounded-full bg-indigo-500/10 blur-3xl" />
          <div className="absolute inset-0 bg-[linear-gradient(rgba(99,102,241,0.03)_1px,transparent_1px),linear-gradient(90deg,rgba(99,102,241,0.03)_1px,transparent_1px)] bg-[size:64px_64px]" />
        </div>
        <div className="container pb-16 pt-12 md:pb-32 md:pt-24">
          <div className="grid items-center gap-12 lg:grid-cols-2">
            <div className="text-center lg:text-start">
              <span className="inline-flex items-center gap-2 rounded-full border bg-card px-4 py-1.5 text-sm font-medium shadow-sm">
                <Zap className="h-3.5 w-3.5 text-primary" />
                {t('hero.badge')}
              </span>
              <h1 className="mt-6 text-4xl font-extrabold leading-tight tracking-tight md:text-5xl lg:text-6xl">
                {t('hero.titleStart')}{' '}
                <span className="bg-gradient-to-r from-primary to-indigo-500 bg-clip-text text-transparent">{t('hero.titleHighlight')}</span>
              </h1>
              <p className="mx-auto mt-6 max-w-xl text-lg leading-relaxed text-muted-foreground md:text-xl lg:mx-0">
                {t('hero.description')}
              </p>
              <div className="mt-8 flex flex-col justify-center gap-3 sm:flex-row lg:justify-start">
                <Button asChild size="xl" className="w-full gap-2 shadow-xl shadow-primary/25 sm:w-auto">
                  <Link href="/signup">
                    {t('hero.cta')}
                    <ArrowRight className="h-5 w-5 rtl:-scale-x-100" />
                  </Link>
                </Button>
                <Button asChild size="xl" variant="outline" className="w-full sm:w-auto">
                  <Link href="/login">{t('hero.ctaAlt')}</Link>
                </Button>
              </div>
              <p className="mt-4 flex items-center justify-center gap-1.5 text-sm text-muted-foreground lg:justify-start">
                <CheckCircle2 className="h-4 w-4 text-emerald-500" />
                {t('hero.noCard')}
              </p>
            </div>
            <div className="flex flex-col items-center gap-6">
              <Image
                src={`/images/dawrok-${locale}.jpg`}
                alt={t('home.phonePreview')}
                width={576}
                height={1024}
                priority
                sizes="(min-width: 768px) 288px, 240px"
                className="h-auto w-60 rounded-2xl shadow-2xl md:w-72"
              />
            </div>
          </div>
        </div>
      </section>

      <section className="border-y bg-muted/30 py-10">
        <div className="container grid grid-cols-3 gap-4 text-center">
          {/* Des faits vérifiables sur le produit, pas des chiffres de clientèle invérifiables. */}
          {[
            { i: Languages, l: t('home.statsLanguages'), d: t('home.statsLanguagesDesc') },
            { i: Smartphone, l: t('home.statsNoApp'), d: t('home.statsNoAppDesc') },
            { i: Clock, l: t('home.statsRealtime'), d: t('home.statsRealtimeDesc') },
          ].map((s) => (
            <div key={s.l} className="flex flex-col items-center gap-1">
              <s.i className="mb-1 h-5 w-5 text-primary" />
              <span className="text-xl font-extrabold md:text-3xl">{s.l}</span>
              <span className="text-xs text-muted-foreground md:text-sm">{s.d}</span>
            </div>
          ))}
        </div>
      </section>

      <section className="container py-16 md:py-24">
        <div className="mb-12 text-center">
          <h2 className="text-3xl font-bold md:text-5xl">{t('howItWorks.title')}</h2>
          <p className="mt-3 text-lg text-muted-foreground">{t('howItWorks.subtitle')}</p>
        </div>
        <div className="mx-auto grid max-w-4xl items-center gap-8 md:grid-cols-[1fr_auto_1fr]">
          <BeforeAfterCard
            img="/images/fille-attente.jpg"
            tint="bg-rose-500/30"
            badge="bg-rose-500"
            label={t('howItWorks.beforeLabel')}
            title={t('howItWorks.beforeTitle')}
            desc={t('howItWorks.beforeDesc')}
          />
          <ArrowRight className="mx-auto hidden h-8 w-8 text-muted-foreground/40 md:block rtl:-scale-x-100" aria-hidden />
          <BeforeAfterCard
            img="/images/solution-fille-attente.jpg"
            tint="bg-emerald-500/30"
            badge="bg-emerald-500"
            label={t('howItWorks.afterLabel')}
            title={t('howItWorks.afterTitle')}
            desc={t('howItWorks.afterDesc')}
          />
        </div>
      </section>

      <section className="border-y bg-muted/30 py-16 md:py-24">
        <div className="container">
          <div className="mx-auto grid max-w-5xl gap-8 md:grid-cols-3">
            {steps.map((s, i) => (
              <Card
                key={s.title}
                className="relative px-5 pb-6 pt-10 text-center transition-all duration-300 hover:-translate-y-1 hover:shadow-xl"
              >
                <div className="absolute -top-4 left-1/2 z-10 inline-flex h-10 w-10 -translate-x-1/2 items-center justify-center rounded-full border-4 border-background bg-primary text-sm font-bold text-primary-foreground shadow-md">
                  {i + 1}
                </div>
                <div className={`mx-auto mb-4 inline-flex h-16 w-16 items-center justify-center rounded-2xl bg-gradient-to-br ${s.c} p-3 shadow-lg`}>
                  <s.icon className="h-8 w-8 text-white" />
                </div>
                <h3 className="mb-2 text-xl font-bold">{s.title}</h3>
                <p className="text-sm leading-relaxed text-muted-foreground">{s.desc}</p>
              </Card>
            ))}
          </div>
          <div className="mt-10 flex justify-center">
            <div className="relative h-56 w-full max-w-md overflow-hidden rounded-2xl shadow-xl">
              <Image src="/images/scan-qr.jpg" alt={t('howItWorks.step1Title')} fill sizes="(min-width: 768px) 448px, 100vw" className="object-cover" />
            </div>
          </div>
        </div>
      </section>

      <section className="container py-16 md:py-24">
        <div className="grid items-center gap-12 lg:grid-cols-2">
          <div className="order-2 lg:order-1">
            <DashboardMockup
              label={t('home.preview')}
              labels={[t('dashboard.waitingLabel'), t('dashboard.inProgressLabel'), t('dashboard.servedToday')]}
            />
          </div>
          <div className="order-1 text-center lg:order-2 lg:text-start">
            <h2 className="text-3xl font-bold md:text-5xl">{t('features.title')}</h2>
            <div className="mt-8 grid gap-4 sm:grid-cols-2">
              {features.map((f) => (
                <div key={f.title} className="flex gap-3 rounded-xl p-3 text-start transition-colors hover:bg-muted/50">
                  <div className="mt-0.5 flex h-9 w-9 flex-shrink-0 items-center justify-center rounded-lg bg-primary/10">
                    <f.i className="h-5 w-5 text-primary" />
                  </div>
                  <div>
                    <h3 className="text-sm font-semibold">{f.title}</h3>
                    <p className="mt-0.5 text-xs text-muted-foreground">{f.desc}</p>
                  </div>
                </div>
              ))}
            </div>
          </div>
        </div>
      </section>

      <section className="border-y bg-muted/30 py-16 md:py-24">
        <div className="container">
          <div className="mb-12 text-center">
            <h2 className="text-3xl font-bold md:text-5xl">{t('sectors.title')}</h2>
            <p className="mt-3 text-lg text-muted-foreground">{t('sectors.subtitle')}</p>
          </div>
          <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-5">
            {SECTORS_VISUAL.map((s) => (
              <Card key={s.k} className="group relative overflow-hidden transition-all duration-300 hover:-translate-y-1 hover:shadow-xl">
                <div className="relative h-32 overflow-hidden">
                  <Image
                    src={s.img}
                    alt={t(`sectors.${s.k}`)}
                    fill
                    sizes="(min-width: 1024px) 20vw, (min-width: 640px) 50vw, 100vw"
                    className="object-cover transition-transform duration-500 group-hover:scale-110"
                  />
                  <div className={`absolute inset-0 bg-gradient-to-t ${s.c} opacity-30`} />
                </div>
                <div className="p-4 text-center">
                  <div
                    className={`relative z-10 mx-auto -mt-8 mb-2 inline-flex h-12 w-12 items-center justify-center rounded-xl bg-gradient-to-br ${s.c} p-2 shadow-lg`}
                  >
                    <s.i className="h-6 w-6 text-white" />
                  </div>
                  <h3 className="text-sm font-bold">{t(`sectors.${s.k}`)}</h3>
                  <p className="mt-0.5 text-xs text-muted-foreground">{t(`sectors.${s.k}Desc`)}</p>
                </div>
              </Card>
            ))}
          </div>
        </div>
      </section>

      <section className="container py-16 md:py-24">
        <div className="relative overflow-hidden rounded-3xl bg-gradient-to-br from-primary to-indigo-600 p-10 text-center text-primary-foreground shadow-2xl shadow-primary/30 md:p-16">
          <div className="absolute -end-10 -top-10 h-40 w-40 rounded-full bg-white/10 blur-3xl" />
          <div className="absolute -bottom-10 -start-10 h-40 w-40 rounded-full bg-white/10 blur-3xl" />
          <div className="relative z-10">
            <h2 className="mb-4 text-3xl font-bold md:text-5xl">{t('cta.title')}</h2>
            <p className="mx-auto mb-8 max-w-lg text-lg opacity-90">{t('cta.subtitle')}</p>
            <Button asChild size="xl" variant="secondary" className="gap-2 shadow-xl">
              <Link href="/signup">
                {t('cta.button')}
                <ArrowRight className="h-5 w-5 rtl:-scale-x-100" />
              </Link>
            </Button>
          </div>
        </div>
      </section>

      <footer className="border-t py-8 text-center text-sm text-muted-foreground">
        <div className="container space-y-2">
          <div>{t('common.copyright', { year: new Date().getFullYear() })}</div>
          <LegalLinks />
        </div>
      </footer>
    </main>
  );
}

function BeforeAfterCard(props: { img: string; tint: string; badge: string; label: string; title: string; desc: string }) {
  return (
    <Card className="group overflow-hidden transition-all hover:shadow-xl">
      <div className="relative h-48 overflow-hidden">
        <Image src={props.img} alt={props.title} fill sizes="(min-width: 768px) 400px, 100vw" className="object-cover" />
        <div className={`absolute inset-0 ${props.tint}`} />
        <span className={`absolute start-3 top-3 rounded-full ${props.badge} px-3 py-1 text-xs font-bold text-white`}>{props.label}</span>
      </div>
      <div className="p-5">
        <h3 className="mb-2 text-lg font-bold">{props.title}</h3>
        <p className="text-sm text-muted-foreground">{props.desc}</p>
      </div>
    </Card>
  );
}
