'use client';
import Link from 'next/link';
import { useTranslations } from 'next-intl';
import { Button } from '@/components/ui/button';
import { Card } from '@/components/ui/card';
import {
  ArrowRight, QrCode, Smartphone, BarChart3, Bell, Users, CheckCircle2,
  Scissors, Stethoscope, Car, Building2, UtensilsCrossed, Zap, Clock, Star,
} from 'lucide-react';
import { LanguageSwitcher } from '@/components/language-switcher';
import { ThemeToggle } from '@/components/theme-toggle';

function PhoneMockup({ label }: { label: string }) {
  return (
    <div className="relative mx-auto w-56">
      <div className="relative rounded-[2rem] border-[3px] border-zinc-700 dark:border-zinc-500 bg-zinc-900 p-2.5 shadow-2xl">
        <div className="mx-auto mb-2.5 h-5 w-20 rounded-full bg-zinc-800" />
        <div className="overflow-hidden rounded-xl bg-gradient-to-br from-primary/10 to-card p-4 aspect-[9/16] flex flex-col items-center justify-center text-center">
          <div className="mb-3 rounded-xl bg-white p-2 shadow-lg">
            <svg viewBox="0 0 80 80" className="h-20 w-20">
              {[[5,5],[15,5],[5,15],[15,15],[30,5],[50,5],[65,5],[75,5],
                [5,30],[25,30],[55,30],[70,30],[10,45],[30,45],[60,45],
                [5,65],[20,65],[40,65],[60,65],[70,65],[75,65]].map(([x,y],i)=>(
                <rect key={i} x={x} y={y} width="4" height="4" fill="#6366F1"/>))}
            </svg>
          </div>
          <p className="text-[11px] font-medium text-white/80">{label}</p>
          <div className="mt-2 inline-flex items-center gap-1 rounded-full bg-primary/20 px-2.5 py-0.5 text-[10px] text-primary-foreground">
            <span className="h-1.5 w-1.5 rounded-full bg-emerald-400 animate-pulse" />Live
          </div>
        </div>
        <div className="mx-auto mt-2.5 h-1 w-16 rounded-full bg-zinc-700" />
      </div>
      <div className="absolute -inset-4 -z-10 rounded-[2rem] bg-gradient-to-br from-primary/20 via-transparent to-primary/10 blur-2xl" />
    </div>
  );
}

function DashboardMockup({ label }: { label: string }) {
  return (
    <div className="rounded-2xl border bg-card shadow-2xl overflow-hidden">
      <div className="flex items-center gap-2 border-b bg-muted/50 px-4 py-2.5">
        <div className="flex gap-1.5"><div className="h-2.5 w-2.5 rounded-full bg-red-400"/><div className="h-2.5 w-2.5 rounded-full bg-amber-400"/><div className="h-2.5 w-2.5 rounded-full bg-emerald-400"/></div>
        <span className="ms-3 text-xs text-muted-foreground">{label}</span>
      </div>
      <div className="p-4 space-y-3">
        <div className="grid grid-cols-3 gap-2">
          {[{c:'bg-amber-100 dark:bg-amber-900/30',t:'text-amber-700 dark:text-amber-300',l:'Wait',v:'12'},{c:'bg-blue-100 dark:bg-blue-900/30',t:'text-blue-700 dark:text-blue-300',l:'Active',v:'3'},{c:'bg-emerald-100 dark:bg-emerald-900/30',t:'text-emerald-700 dark:text-emerald-300',l:'Done',v:'47'}].map((s,i)=>(<div key={i} className={`rounded-lg ${s.c} p-2 text-center`}><div className={`text-lg font-bold ${s.t}`}>{s.v}</div><div className={`text-[10px] ${s.t}`}>{s.l}</div></div>))}
        </div>
        <div className="space-y-1.5">
          {[{n:'A012',nm:'Client 1',tm:'2 min',a:true},{n:'A013',nm:'Client 2',tm:'5 min',a:false},{n:'A014',nm:'Client 3',tm:'8 min',a:false}].map((x,i)=>(<div key={i} className={`flex items-center justify-between rounded-lg border px-3 py-2 text-xs ${x.a?'border-primary/40 bg-primary/5':''}`}><div className="flex items-center gap-2"><span className={`inline-flex h-5 w-5 items-center justify-center rounded text-[10px] font-bold ${x.a?'bg-primary text-primary-foreground':'bg-muted text-muted-foreground'}`}>{x.n}</span><span className="font-medium">{x.nm}</span></div><span className="text-muted-foreground">{x.tm}</span></div>))}
        </div>
      </div>
    </div>
  );
}

const SECTORS_VISUAL = [
  { k:'hairdresser',       i:Scissors,       c:'from-rose-500 to-pink-500' },
  { k:'doctor',             i:Stethoscope,     c:'from-sky-500 to-blue-500' },
  { k:'vehicleInspection', i:Car,              c:'from-amber-500 to-orange-500' },
  { k:'bank',              i:Building2,        c:'from-violet-500 to-purple-500' },
  { k:'restaurant',        i:UtensilsCrossed,  c:'from-emerald-500 to-teal-500' },
];

export default function PreviewPage() {
  const t = useTranslations();
  return (
    <main className="min-h-screen overflow-x-hidden">
      {/* NAV — glassmorphism */}
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

      {/* HERO — two columns */}
      <section className="relative overflow-hidden">
        <div className="absolute inset-0 -z-10">
          <div className="absolute -top-40 -end-40 h-96 w-96 rounded-full bg-primary/10 blur-3xl" />
          <div className="absolute -bottom-20 -start-20 h-72 w-72 rounded-full bg-indigo-500/10 blur-3xl" />
          <div className="absolute inset-0 bg-[linear-gradient(rgba(99,102,241,0.03)_1px,transparent_1px),linear-gradient(90deg,rgba(99,102,241,0.03)_1px,transparent_1px)] bg-[size:64px_64px]" />
        </div>
        <div className="container pt-12 pb-16 md:pt-20 md:pb-28">
          <div className="grid lg:grid-cols-2 gap-12 items-center">
            <div className="text-center lg:text-start">
              <span className="inline-flex items-center gap-2 rounded-full border bg-card px-4 py-1.5 text-sm font-medium shadow-sm">
                <Zap className="h-3.5 w-3.5 text-primary" />{t('hero.badge')}
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
            <div className="hidden lg:flex justify-center"><PhoneMockup label={t('home.phonePreview')}/></div>
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

      {/* HOW IT WORKS — visuel connecté */}
      <section className="container py-20 md:py-28">
        <div className="text-center mb-16">
          <h2 className="text-3xl md:text-5xl font-bold">{t('howItWorks.title')}</h2>
          <p className="mt-3 text-muted-foreground text-lg max-w-xl mx-auto">{t('howItWorks.subtitle')}</p>
        </div>
        <div className="grid md:grid-cols-3 gap-8 max-w-5xl mx-auto">
          {[{icon:QrCode,t:t('howItWorks.step1Title'),d:t('howItWorks.step1Desc'),c:'from-indigo-500 to-blue-500'},
            {icon:Smartphone,t:t('howItWorks.step2Title'),d:t('howItWorks.step2Desc'),c:'from-violet-500 to-purple-500'},
            {icon:BarChart3,t:t('howItWorks.step3Title'),d:t('howItWorks.step3Desc'),c:'from-emerald-500 to-teal-500'}]
            .map((s,i)=>(
            <div key={i} className="relative text-center group">
              <div className="absolute -top-3 start-1/2 -translate-x-1/2 z-10 inline-flex h-8 w-8 items-center justify-center rounded-full border-2 border-background bg-primary text-xs font-bold text-primary-foreground shadow-md">{i+1}</div>
              <Card className="pt-10 pb-6 px-5 h-full group-hover:border-primary/50 group-hover:shadow-xl transition-all duration-300">
                <div className={`mx-auto mb-4 inline-flex h-16 w-16 items-center justify-center rounded-2xl bg-gradient-to-br ${s.c} p-3 shadow-lg`}><s.icon className="h-8 w-8 text-white"/></div>
                <h3 className="text-xl font-bold mb-2">{s.t}</h3>
                <p className="text-sm text-muted-foreground leading-relaxed">{s.d}</p>
              </Card>
            </div>))}
        </div>
      </section>

      {/* DASHBOARD PREVIEW */}
      <section className="bg-muted/30 border-y py-20 md:py-28">
        <div className="container grid lg:grid-cols-2 gap-12 items-center">
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

      {/* SECTORS — cartes interactives */}
      <section className="container py-20 md:py-28">
        <div className="text-center mb-16"><h2 className="text-3xl md:text-5xl font-bold">{t('sectors.title')}</h2><p className="mt-3 text-muted-foreground text-lg">{t('sectors.subtitle')}</p></div>
        <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-5 gap-4">
          {SECTORS_VISUAL.map((s,i)=>(
            <Card key={i} className="group relative overflow-hidden p-6 text-center cursor-default hover:shadow-xl transition-all duration-300 hover:-translate-y-1">
              <div className={`absolute top-0 start-0 end-0 h-1 bg-gradient-to-r ${s.c} opacity-0 group-hover:opacity-100 transition-opacity`}/>
              <div className={`mx-auto mb-4 inline-flex h-14 w-14 items-center justify-center rounded-2xl bg-gradient-to-br ${s.c} p-2.5 shadow-lg group-hover:scale-110 transition-transform`}><s.i className="h-7 w-7 text-white"/></div>
              <h3 className="font-bold text-sm mb-1">{t(`sectors.${s.k}`)}</h3>
              <p className="text-xs text-muted-foreground">{t(`sectors.${s.k}Desc`)}</p>
            </Card>))}
        </div>
      </section>

      {/* CTA */}
      <section className="container py-20 md:py-28">
        <div className="relative overflow-hidden rounded-3xl bg-gradient-to-br from-primary to-indigo-600 p-10 md:p-16 text-center text-primary-foreground shadow-2xl shadow-primary/30">
          <div className="absolute -top-10 -end-10 h-40 w-40 rounded-full bg-white/10 blur-3xl"/><div className="absolute -bottom-10 -start-10 h-40 w-40 rounded-full bg-white/10 blur-3xl"/>
          <div className="relative z-10"><h2 className="text-3xl md:text-5xl font-bold mb-4">{t('cta.title')}</h2><p className="text-lg opacity-90 mb-8 max-w-lg mx-auto">{t('cta.subtitle')}</p>
            <Link href="/signup"><Button size="xl" variant="secondary" className="shadow-xl gap-2">{t('cta.button')}<ArrowRight className="h-5 w-5"/></Button></Link>
          </div>
        </div>
      </section>

      {/* FOOTER */}
      <footer className="border-t py-8 text-center text-sm text-muted-foreground"><div className="container">{t('common.copyright',{year:new Date().getFullYear()})}</div></footer>
    </main>
  );
}
