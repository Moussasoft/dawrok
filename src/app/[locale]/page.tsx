'use client';
import Link from 'next/link';
import { useTranslations, useLocale } from 'next-intl';
import { Button } from '@/components/ui/button';
import { Card } from '@/components/ui/card';
import {
  ArrowRight, QrCode, Smartphone, BarChart3, Bell, Users, CheckCircle2,
  Scissors, Stethoscope, Car, Building2, UtensilsCrossed, Zap, Clock, Star,
} from 'lucide-react';
import { LanguageSwitcher } from '@/components/language-switcher';
import { ThemeToggle } from '@/components/theme-toggle';

/* ═══════════ SVG ILLUSTRATIONS ═══════════ */

function ScanIllustration() {
  return (
    <svg viewBox="0 0 400 240" className="w-full max-w-md mx-auto" fill="none">
      <circle cx="150" cy="75" r="28" className="fill-muted-foreground/20"/>
      <path d="M110 145c0-15 18-28 40-28s40 13 40 28" className="stroke-muted-foreground/30" strokeWidth="6" strokeLinecap="round"/>
      <rect x="195" y="85" width="50" height="80" rx="8" className="fill-card stroke-border" strokeWidth="2"/>
      <rect x="203" y="97" width="34" height="34" rx="4" className="fill-primary/20"/>
      {[[215,103],[222,103],[215,110],[222,110],[222,117]].map(([x,y],i)=>(<rect key={i} x={x} y={y} width="3" height="3" rx="0.5" className="fill-primary"/>))}
      <path d="M198 135c-8 0-14 6-14 14v10" className="stroke-muted-foreground/40" strokeWidth="5" strokeLinecap="round"/>
      <rect x="250" y="125" width="55" height="55" rx="6" className="fill-card stroke-primary/30" strokeWidth="1.5"/>
      {[[262,135],[269,135],[262,142],[269,142],[276,135],[290,135],[262,155],[276,155],[290,155],[262,165],[269,165],[283,165]].map(([x,y],i)=>(<rect key={i} x={x} y={y} width="3" height="3" rx="0.5" fill="#6366F1"/>))}
      <path d="M225 115c5-8 13-10 13-10" className="stroke-primary/50" strokeWidth="1.5" strokeDasharray="4 3"/>
    </svg>
  );
}

function QueueComparison() {
  return (
    <svg viewBox="0 0 500 190" className="w-full max-w-lg mx-auto" fill="none">
      <text x="80" y="18" textAnchor="middle" className="fill-muted-foreground text-[10px] font-bold">AVANT</text>
      <rect x="15" y="28" width="130" height="140" rx="10" className="fill-rose-50 dark:fill-rose-950/20 stroke-rose-200 dark:stroke-rose-800" strokeWidth="1"/>
      {[45,70,95,120,143].map((y,i)=>(<g key={i}><circle cx={55+(i*12)} cy={y} r="9" className="fill-muted-foreground/20"/><path d={`M${47+(i*12)} ${y+18}c0-7 8-13 16-13s16 6 16 13`} className="stroke-muted-foreground/30" strokeWidth="3" strokeLinecap="round"/></g>))}
      <text x="80" y="182" textAnchor="middle" className="fill-rose-500 text-[8px]">😤 Longue attente</text>
      <text x="330" y="18" textAnchor="middle" className="fill-muted-foreground text-[10px] font-bold">APRÈS</text>
      <rect x="265" y="28" width="130" height="140" rx="10" className="fill-emerald-50 dark:fill-emerald-950/20 stroke-emerald-200 dark:stroke-emerald-800" strokeWidth="1"/>
      <circle cx="300" cy="80" r="22" className="fill-muted-foreground/20"/>
      <rect x="295" y="47" width="35" height="50" rx="5" className="fill-card stroke-primary/30" strokeWidth="1.5"/>
      <rect x="301" y="55" width="23" height="18" rx="3" className="fill-primary/20"/>
      {[[310,59],[315,59],[310,65]].map(([x,y],i)=>(<rect key={i} x={x} y={y} width="2" height="2" rx="0.5" fill="#6366F1"/>))}
      <circle cx="370" cy="80" r="22" className="fill-muted-foreground/20"/>
      <text x="370" y="85" textAnchor="middle" className="fill-muted-foreground text-[20px]">☕</text>
      <text x="330" y="182" textAnchor="middle" className="fill-emerald-500 text-[8px]">😊 Libre</text>
      <path d="M210 95h45" className="stroke-primary/40" strokeWidth="2"/>
    </svg>
  );
}

function PhoneMockup({ label }: { label: string }) {
  return (
    <div className="relative mx-auto w-52 md:w-60">
      <div className="relative rounded-[2.5rem] border-[3px] border-zinc-700 dark:border-zinc-400 bg-zinc-900 p-2.5 shadow-2xl">
        <div className="mx-auto mb-2.5 h-5 w-20 rounded-full bg-zinc-800"/>
        <div className="overflow-hidden rounded-2xl aspect-[9/16]">
          <img src="/images/dawrok.jpg" alt={label} className="h-full w-full object-cover" />
        </div>
        <div className="mx-auto mt-2.5 h-1 w-16 rounded-full bg-zinc-700"/>
      </div>
      <div className="absolute -inset-4 -z-10 rounded-[3rem] bg-gradient-to-br from-primary/20 via-transparent to-violet-500/10 blur-2xl"/>
    </div>
  );
}

function DashboardMockup({ label }: { label: string }) {
  return (
    <div className="rounded-2xl border bg-card shadow-2xl overflow-hidden max-w-sm mx-auto">
      <div className="flex items-center gap-2 border-b bg-muted/50 px-4 py-2.5">
        <div className="flex gap-1.5"><div className="h-2.5 w-2.5 rounded-full bg-red-400"/><div className="h-2.5 w-2.5 rounded-full bg-amber-400"/><div className="h-2.5 w-2.5 rounded-full bg-emerald-400"/></div>
        <span className="ms-3 text-xs text-muted-foreground truncate">{label}</span>
      </div>
      <div className="p-4 space-y-3">
        <div className="grid grid-cols-3 gap-2">
          {[{c:'bg-amber-100 dark:bg-amber-900/30',tc:'text-amber-700 dark:text-amber-300',l:'Wait',v:'12'},{c:'bg-blue-100 dark:bg-blue-900/30',tc:'text-blue-700 dark:text-blue-300',l:'Active',v:'3'},{c:'bg-emerald-100 dark:bg-emerald-900/30',tc:'text-emerald-700 dark:text-emerald-300',l:'Done',v:'47'}].map((s,i)=>(<div key={i} className={`rounded-lg ${s.c} p-2 text-center`}><div className={`text-lg font-bold ${s.tc}`}>{s.v}</div><div className={`text-[10px] ${s.tc}`}>{s.l}</div></div>))}
        </div>
        <div className="space-y-1.5">
          {[{n:'A012',nm:'M. Dupont',tm:'2 min',a:true},{n:'A013',nm:'Mme Martin',tm:'5 min',a:false},{n:'A014',nm:'M. Karim',tm:'8 min',a:false}].map((x,i)=>(<div key={i} className={`flex items-center justify-between rounded-lg border px-3 py-2 text-xs ${x.a?'border-primary/40 bg-primary/5':''}`}><div className="flex items-center gap-2"><span className={`inline-flex h-5 w-5 items-center justify-center rounded text-[10px] font-bold ${x.a?'bg-primary text-primary-foreground':'bg-muted text-muted-foreground'}`}>{x.n}</span><span className="font-medium">{x.nm}</span></div><span className="text-muted-foreground">{x.tm}</span></div>))}
        </div>
      </div>
    </div>
  );
}

const SECTORS_VISUAL = [
  { k:'hairdresser',       i:Scissors,       c:'from-rose-500 to-pink-500',   img:'/images/salon-coiffure.jpg' },
  { k:'doctor',             i:Stethoscope,     c:'from-sky-500 to-blue-500',    img:'/images/cabinet-medical.jpg' },
  { k:'vehicleInspection', i:Car,              c:'from-amber-500 to-orange-500', img:'/images/garage-auto.jpg' },
  { k:'bank',              i:Building2,        c:'from-violet-500 to-purple-500',img:'/images/banque-admin.jpg' },
  { k:'restaurant',        i:UtensilsCrossed,  c:'from-emerald-500 to-teal-500', img:'/images/restaurant.jpg' },
];

export default function HomePage() {
  const t = useTranslations();
  const locale = useLocale();
  return (
    <main className="min-h-screen overflow-x-hidden">
      {/* NAV */}
      <nav className="sticky top-0 z-50 border-b bg-background/80 backdrop-blur-xl">
        <div className="container flex h-16 items-center justify-between">
          <Link href="/" className="flex items-center gap-2.5 font-bold text-xl">
            <span className="inline-flex h-9 w-9 items-center justify-center rounded-xl bg-gradient-to-br from-primary to-indigo-500 text-primary-foreground shadow-lg shadow-primary/25">D</span>Daourak
          </Link>
          <div className="flex items-center gap-2">
            <ThemeToggle /><LanguageSwitcher />
            <Link href="/login"><Button variant="ghost" size="sm">{t('nav.login')}</Button></Link>
            <Link href="/signup"><Button size="sm" className="shadow-lg shadow-primary/25">{t('nav.signup')}</Button></Link>
          </div>
        </div>
      </nav>

      {/* HERO */}
      <section className="relative overflow-hidden">
        <div className="absolute inset-0 -z-10">
          <div className="absolute -top-40 -end-40 h-96 w-96 rounded-full bg-primary/10 blur-3xl"/>
          <div className="absolute -bottom-20 -start-20 h-72 w-72 rounded-full bg-indigo-500/10 blur-3xl"/>
          <div className="absolute inset-0 bg-[linear-gradient(rgba(99,102,241,0.03)_1px,transparent_1px),linear-gradient(90deg,rgba(99,102,241,0.03)_1px,transparent_1px)] bg-[size:64px_64px]"/>
        </div>
        <div className="container pt-12 pb-16 md:pt-24 md:pb-32">
          <div className="grid lg:grid-cols-2 gap-12 items-center">
            <div className="text-center lg:text-start">
              <span className="inline-flex items-center gap-2 rounded-full border bg-card px-4 py-1.5 text-sm font-medium shadow-sm">
                <Zap className="h-3.5 w-3.5 text-primary"/>{t('hero.badge')}
              </span>
              <h1 className="mt-6 text-4xl leading-tight md:text-5xl lg:text-6xl font-extrabold tracking-tight">
                {t('hero.titleStart')}{' '}
                <span className="bg-gradient-to-r from-primary to-indigo-500 bg-clip-text text-transparent">{t('hero.titleHighlight')}</span>
              </h1>
              <p className="mt-6 text-lg md:text-xl text-muted-foreground leading-relaxed max-w-xl mx-auto lg:mx-0">{t('hero.description')}</p>
              <div className="mt-8 flex flex-col sm:flex-row gap-3 justify-center lg:justify-start">
                <Link href="/signup"><Button size="xl" className="w-full sm:w-auto shadow-xl shadow-primary/25 gap-2">{t('hero.cta')}<ArrowRight className="h-5 w-5"/></Button></Link>
                <Link href="/login"><Button size="xl" variant="outline" className="w-full sm:w-auto">{t('hero.ctaAlt')}</Button></Link>
              </div>
              <p className="mt-4 text-sm text-muted-foreground flex items-center justify-center lg:justify-start gap-1.5"><CheckCircle2 className="h-4 w-4 text-emerald-500"/>{t('hero.noCard')}</p>
            </div>
            <div className="flex flex-col items-center gap-6">
              <img src={`/images/dawrok-${locale}.jpg`} alt={t('home.phonePreview')} className="w-60 md:w-72 rounded-2xl shadow-2xl" />
            </div>
          </div>
        </div>
      </section>

      {/* STATS */}
      <section className="border-y bg-muted/30 py-10">
        <div className="container grid grid-cols-3 gap-4 text-center">
          {[{i:Star,l:t('home.statsClients')},{i:QrCode,l:t('home.statsTickets')},{i:Clock,l:t('home.statsTime')}].map((s,i)=>(
            <div key={i} className="flex flex-col items-center gap-1"><s.i className="h-5 w-5 text-primary mb-1"/><span className="text-2xl md:text-3xl font-extrabold">{s.l}</span></div>))}
        </div>
      </section>

      {/* COMPARAISON AVANT/APRÈS — avec vraies images */}
      <section className="container py-16 md:py-24">
        <div className="text-center mb-12">
          <h2 className="text-3xl md:text-5xl font-bold">{t('howItWorks.title')}</h2>
          <p className="mt-3 text-muted-foreground text-lg">{t('howItWorks.subtitle')}</p>
        </div>
        <div className="grid md:grid-cols-2 gap-8 max-w-4xl mx-auto">
          <Card className="overflow-hidden group hover:shadow-xl transition-all">
            <div className="relative h-48 overflow-hidden">
              <img src="/images/fille-attente.jpg" alt={t('howItWorks.beforeTitle')} className="h-full w-full object-cover"/>
              <div className="absolute inset-0 bg-rose-500/30"/>
              <span className="absolute top-3 start-3 rounded-full bg-rose-500 px-3 py-1 text-xs font-bold text-white">{t('howItWorks.beforeLabel')}</span>
            </div>
            <div className="p-5">
              <h3 className="font-bold text-lg mb-2">{t('howItWorks.beforeTitle')}</h3>
              <p className="text-sm text-muted-foreground">{t('howItWorks.beforeDesc')}</p>
            </div>
          </Card>
          <Card className="overflow-hidden group hover:shadow-xl transition-all">
            <div className="relative h-48 overflow-hidden">
              <img src="/images/solution-fille-attente.jpg" alt={t('howItWorks.afterTitle')} className="h-full w-full object-cover"/>
              <div className="absolute inset-0 bg-emerald-500/30"/>
              <span className="absolute top-3 start-3 rounded-full bg-emerald-500 px-3 py-1 text-xs font-bold text-white">{t('howItWorks.afterLabel')}</span>
            </div>
            <div className="p-5">
              <h3 className="font-bold text-lg mb-2">{t('howItWorks.afterTitle')}</h3>
              <p className="text-sm text-muted-foreground">{t('howItWorks.afterDesc')}</p>
            </div>
          </Card>
        </div>
        <div className="flex justify-center mt-6">
          <span className="text-3xl text-muted-foreground/30">→</span>
        </div>
      </section>

      {/* ÉTAPES */}
      <section className="bg-muted/30 border-y py-16 md:py-24">
        <div className="container">
          <div className="grid md:grid-cols-3 gap-8 max-w-5xl mx-auto">
            {[{icon:QrCode,t:t('howItWorks.step1Title'),d:t('howItWorks.step1Desc'),c:'from-indigo-500 to-blue-500'},
              {icon:Smartphone,t:t('howItWorks.step2Title'),d:t('howItWorks.step2Desc'),c:'from-violet-500 to-purple-500'},
              {icon:BarChart3,t:t('howItWorks.step3Title'),d:t('howItWorks.step3Desc'),c:'from-emerald-500 to-teal-500'}]
              .map((s,i)=>(
              <Card key={i} className="relative pt-10 pb-6 px-5 text-center group hover:shadow-xl transition-all duration-300 hover:-translate-y-1">
                <div className="absolute -top-4 start-1/2 -translate-x-1/2 z-10 inline-flex h-10 w-10 items-center justify-center rounded-full border-4 border-background bg-primary text-sm font-bold text-primary-foreground shadow-md">{i+1}</div>
                <div className={`mx-auto mb-4 inline-flex h-16 w-16 items-center justify-center rounded-2xl bg-gradient-to-br ${s.c} p-3 shadow-lg`}><s.icon className="h-8 w-8 text-white"/></div>
                <h3 className="text-xl font-bold mb-2">{s.t}</h3>
                <p className="text-sm text-muted-foreground leading-relaxed">{s.d}</p>
              </Card>))}
          </div>
          <div className="mt-10 flex justify-center">
            <div className="rounded-2xl overflow-hidden shadow-xl max-w-md">
              <img src="/images/scan-qr.jpg" alt="Scan QR code" className="w-full h-56 object-cover"/>
            </div>
          </div>
        </div>
      </section>

      {/* DASHBOARD + FEATURES */}
      <section className="container py-16 md:py-24">
        <div className="grid lg:grid-cols-2 gap-12 items-center">
          <div className="order-2 lg:order-1"><DashboardMockup label={t('home.preview')}/></div>
          <div className="order-1 lg:order-2 text-center lg:text-start">
            <h2 className="text-3xl md:text-5xl font-bold">{t('features.title')}</h2>
            <div className="mt-8 grid sm:grid-cols-2 gap-4">
              {[{i:Bell,t:t('features.feature1Title'),d:t('features.feature1Desc')},{i:Users,t:t('features.feature2Title'),d:t('features.feature2Desc')},{i:BarChart3,t:t('features.feature3Title'),d:t('features.feature3Desc')},{i:CheckCircle2,t:t('features.feature4Title'),d:t('features.feature4Desc')}].map((f,i)=>(
                <div key={i} className="flex gap-3 text-start p-3 rounded-xl hover:bg-muted/50 transition-colors">
                  <div className="flex-shrink-0 mt-0.5 h-9 w-9 rounded-lg bg-primary/10 flex items-center justify-center"><f.i className="h-4.5 w-4.5 text-primary"/></div>
                  <div><h4 className="font-semibold text-sm">{f.t}</h4><p className="text-xs text-muted-foreground mt-0.5">{f.d}</p></div>
                </div>))}
            </div>
          </div>
        </div>
      </section>

      {/* SECTORS — avec images réelles */}
      <section className="bg-muted/30 border-y py-16 md:py-24">
        <div className="container">
          <div className="text-center mb-12">
            <h2 className="text-3xl md:text-5xl font-bold">{t('sectors.title')}</h2>
            <p className="mt-3 text-muted-foreground text-lg">{t('sectors.subtitle')}</p>
          </div>
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-5 gap-4">
            {SECTORS_VISUAL.map((s,i)=>(
              <Card key={i} className="group relative overflow-hidden hover:shadow-xl transition-all duration-300 hover:-translate-y-1">
                <div className="h-32 overflow-hidden">
                  <img src={s.img} alt={t(`sectors.${s.k}`)} className="h-full w-full object-cover group-hover:scale-110 transition-transform duration-500"/>
                  <div className={`absolute inset-0 bg-gradient-to-t ${s.c} opacity-30`}/>
                </div>
                <div className="p-4 text-center">
                  <div className={`mx-auto -mt-8 relative z-10 mb-2 inline-flex h-12 w-12 items-center justify-center rounded-xl bg-gradient-to-br ${s.c} p-2 shadow-lg`}><s.i className="h-6 w-6 text-white"/></div>
                  <h3 className="font-bold text-sm">{t(`sectors.${s.k}`)}</h3>
                  <p className="text-xs text-muted-foreground mt-0.5">{t(`sectors.${s.k}Desc`)}</p>
                </div>
              </Card>))}
          </div>
        </div>
      </section>

      {/* CTA */}
      <section className="container py-16 md:py-24">
        <div className="relative overflow-hidden rounded-3xl bg-gradient-to-br from-primary to-indigo-600 p-10 md:p-16 text-center text-primary-foreground shadow-2xl shadow-primary/30">
          <div className="absolute -top-10 -end-10 h-40 w-40 rounded-full bg-white/10 blur-3xl"/><div className="absolute -bottom-10 -start-10 h-40 w-40 rounded-full bg-white/10 blur-3xl"/>
          <div className="relative z-10"><h2 className="text-3xl md:text-5xl font-bold mb-4">{t('cta.title')}</h2><p className="text-lg opacity-90 mb-8 max-w-lg mx-auto">{t('cta.subtitle')}</p>
            <Link href="/signup"><Button size="xl" variant="secondary" className="shadow-xl gap-2">{t('cta.button')}<ArrowRight className="h-5 w-5"/></Button></Link>
          </div>
        </div>
      </section>

      <footer className="border-t py-8 text-center text-sm text-muted-foreground"><div className="container">{t('common.copyright',{year:new Date().getFullYear()})}</div></footer>
    </main>
  );
}