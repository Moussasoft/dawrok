'use client';

import Link from 'next/link';
import { useTranslations } from 'next-intl';
import { Button } from '@/components/ui/button';
import { Card, CardContent } from '@/components/ui/card';
import {
  ArrowRight,
  QrCode,
  Smartphone,
  BarChart3,
  Bell,
  Users,
  Scissors,
  Stethoscope,
  Car,
  Building2,
  UtensilsCrossed,
  CheckCircle2,
} from 'lucide-react';
import { LanguageSwitcher } from '@/components/language-switcher';

export default function HomePage() {
  const t = useTranslations();
  return (
    <main className="min-h-screen gradient-mesh">
      {/* NAV */}
      <nav className="container flex h-16 items-center justify-between">
        <Link href="/" className="flex items-center gap-2 font-bold text-xl">
          <span className="inline-flex h-8 w-8 items-center justify-center rounded-lg bg-primary text-primary-foreground">D</span>
          Daourak
        </Link>
        <div className="flex items-center gap-2">
          <LanguageSwitcher />
          <Link href="/login"><Button variant="ghost">{t('nav.login')}</Button></Link>
          <Link href="/signup"><Button>{t('nav.signup')}</Button></Link>
        </div>
      </nav>

      {/* HERO */}
      <section className="container pt-12 pb-20 md:pt-24 md:pb-32 text-center">
        <div className="mx-auto max-w-3xl">
          <span className="inline-flex items-center gap-2 rounded-full border bg-card px-4 py-1.5 text-sm font-medium shadow-sm">
            <span className="h-2 w-2 rounded-full bg-success animate-pulse" />
            {t('hero.badge')}
          </span>
          <h1 className="mt-6 text-4xl md:text-6xl lg:text-7xl font-extrabold tracking-tight">
            {t('hero.titleStart')} <span className="text-primary">{t('hero.titleHighlight')}</span>
          </h1>
          <p className="mt-6 text-lg md:text-xl text-muted-foreground">
            {t('hero.description')}
          </p>
          <div className="mt-10 flex flex-col sm:flex-row gap-3 justify-center">
            <Link href="/signup">
              <Button size="xl" className="w-full sm:w-auto">
                {t('hero.cta')} <ArrowRight className="h-5 w-5" />
              </Button>
            </Link>
            <Link href="/login">
              <Button size="xl" variant="outline" className="w-full sm:w-auto">
                {t('hero.ctaAlt')}
              </Button>
            </Link>
          </div>
          <p className="mt-4 text-sm text-muted-foreground">{t('hero.noCard')}</p>
        </div>
      </section>

      {/* HOW IT WORKS */}
      <section className="container py-20">
        <h2 className="text-3xl md:text-4xl font-bold text-center mb-4">{t('howItWorks.title')}</h2>
        <p className="text-center text-muted-foreground mb-16 max-w-2xl mx-auto">
          {t('howItWorks.subtitle')}
        </p>
        <div className="grid md:grid-cols-3 gap-6">
          {[
            { icon: QrCode, title: t('howItWorks.step1Title'), desc: t('howItWorks.step1Desc') },
            { icon: Smartphone, title: t('howItWorks.step2Title'), desc: t('howItWorks.step2Desc') },
            { icon: BarChart3, title: t('howItWorks.step3Title'), desc: t('howItWorks.step3Desc') },
          ].map((step, i) => (
            <Card key={i} className="hover:shadow-lg transition-shadow">
              <CardContent className="p-6">
                <div className="h-14 w-14 rounded-xl bg-primary/10 text-primary flex items-center justify-center mb-4">
                  <step.icon className="h-7 w-7" />
                </div>
                <h3 className="text-xl font-semibold mb-2">{step.title}</h3>
                <p className="text-muted-foreground">{step.desc}</p>
              </CardContent>
            </Card>
          ))}
        </div>
      </section>

      {/* SECTORS */}
      <section className="container py-20 border-t">
        <h2 className="text-3xl md:text-4xl font-bold text-center mb-4">{t('sectors.title')}</h2>
        <p className="text-center text-muted-foreground mb-16">{t('sectors.subtitle')}</p>
        <div className="grid grid-cols-2 md:grid-cols-5 gap-4">
          {[
            { icon: Scissors, label: t('sectors.hairdresser') },
            { icon: Stethoscope, label: t('sectors.doctor') },
            { icon: Car, label: t('sectors.vehicleInspection') },
            { icon: Building2, label: t('sectors.bank') },
            { icon: UtensilsCrossed, label: t('sectors.restaurant') },
          ].map((s, i) => (
            <Card key={i} className="text-center p-6 hover:border-primary transition-colors">
              <s.icon className="h-12 w-12 mx-auto mb-3 text-primary" />
              <div className="font-medium">{s.label}</div>
            </Card>
          ))}
        </div>
      </section>

      {/* FEATURES */}
      <section className="container py-20 border-t">
        <h2 className="text-3xl md:text-4xl font-bold text-center mb-16">{t('features.title')}</h2>
        <div className="grid md:grid-cols-2 lg:grid-cols-4 gap-6">
          {[
            { icon: Bell, title: t('features.feature1Title'), desc: t('features.feature1Desc') },
            { icon: Users, title: t('features.feature2Title'), desc: t('features.feature2Desc') },
            { icon: BarChart3, title: t('features.feature3Title'), desc: t('features.feature3Desc') },
            { icon: CheckCircle2, title: t('features.feature4Title'), desc: t('features.feature4Desc') },
          ].map((f, i) => (
            <div key={i} className="p-6">
              <f.icon className="h-10 w-10 text-primary mb-3" />
              <h3 className="font-semibold mb-1">{f.title}</h3>
              <p className="text-sm text-muted-foreground">{f.desc}</p>
            </div>
          ))}
        </div>
      </section>

      {/* CTA */}
      <section className="container py-20">
        <div className="rounded-3xl bg-primary text-primary-foreground p-12 md:p-16 text-center">
          <h2 className="text-3xl md:text-5xl font-bold mb-4">{t('cta.title')}</h2>
          <p className="text-lg opacity-90 mb-8">{t('cta.subtitle')}</p>
          <Link href="/signup">
            <Button size="xl" variant="secondary">{t('cta.button')} <ArrowRight className="h-6 w-6" /></Button>
          </Link>
        </div>
      </section>

      <footer className="container py-10 text-center text-sm text-muted-foreground border-t">
        {t('common.copyright', { year: new Date().getFullYear() })}
      </footer>
    </main>
  );
}
