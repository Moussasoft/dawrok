import Link from 'next/link';
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

export default function HomePage() {
  return (
    <main className="min-h-screen gradient-mesh">
      {/* NAV */}
      <nav className="container flex h-16 items-center justify-between">
        <Link href="/" className="flex items-center gap-2 font-bold text-xl">
          <span className="inline-flex h-8 w-8 items-center justify-center rounded-lg bg-primary text-primary-foreground">D</span>
          Daourak
        </Link>
        <div className="flex items-center gap-2">
          <Link href="/login"><Button variant="ghost">Connexion</Button></Link>
          <Link href="/signup"><Button>Essai gratuit</Button></Link>
        </div>
      </nav>

      {/* HERO */}
      <section className="container pt-12 pb-20 md:pt-24 md:pb-32 text-center">
        <div className="mx-auto max-w-3xl">
          <span className="inline-flex items-center gap-2 rounded-full border bg-card px-4 py-1.5 text-sm font-medium shadow-sm">
            <span className="h-2 w-2 rounded-full bg-success animate-pulse" />
            File d'attente intelligente — temps réel
          </span>
          <h1 className="mt-6 text-4xl md:text-6xl lg:text-7xl font-extrabold tracking-tight">
            Vos clients <span className="text-primary">attendent où ils veulent.</span>
          </h1>
          <p className="mt-6 text-lg md:text-xl text-muted-foreground">
            Coiffeurs, médecins, visites techniques, banques… Digitalisez votre file d'attente en 2 minutes.
            Le client scanne un QR code, suit son tour sur son mobile, et vous gérez tout depuis un tableau de bord.
          </p>
          <div className="mt-10 flex flex-col sm:flex-row gap-3 justify-center">
            <Link href="/signup">
              <Button size="xl" className="w-full sm:w-auto">
                Démarrer gratuitement <ArrowRight className="h-5 w-5" />
              </Button>
            </Link>
            <Link href="/login">
              <Button size="xl" variant="outline" className="w-full sm:w-auto">
                J'ai déjà un compte
              </Button>
            </Link>
          </div>
          <p className="mt-4 text-sm text-muted-foreground">Sans carte bancaire. Configuration en 2 minutes.</p>
        </div>
      </section>

      {/* HOW IT WORKS */}
      <section className="container py-20">
        <h2 className="text-3xl md:text-4xl font-bold text-center mb-4">Comment ça marche ?</h2>
        <p className="text-center text-muted-foreground mb-16 max-w-2xl mx-auto">
          Trois étapes pour transformer l'expérience d'attente.
        </p>
        <div className="grid md:grid-cols-3 gap-6">
          {[
            { icon: QrCode, title: '1. Le client scanne', desc: 'Un QR code à l\'entrée — pas d\'app à installer. Il prend son ticket en 5 secondes.' },
            { icon: Smartphone, title: '2. Il suit son tour', desc: 'Position, temps estimé, notification quand son tour approche. Il peut sortir.' },
            { icon: BarChart3, title: '3. Vous pilotez', desc: 'Tableau de bord temps réel + analytics : pic d\'affluence, durée moyenne, fidélité.' },
          ].map((step, i) => (
            <Card key={i} className="hover:shadow-lg transition-shadow">
              <CardContent className="p-6">
                <div className="h-12 w-12 rounded-xl bg-primary/10 text-primary flex items-center justify-center mb-4">
                  <step.icon className="h-6 w-6" />
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
        <h2 className="text-3xl md:text-4xl font-bold text-center mb-4">Pour tous les services</h2>
        <p className="text-center text-muted-foreground mb-16">Templates prêts à l'emploi — adaptez en 1 clic.</p>
        <div className="grid grid-cols-2 md:grid-cols-5 gap-4">
          {[
            { icon: Scissors, label: 'Coiffure' },
            { icon: Stethoscope, label: 'Médecin' },
            { icon: Car, label: 'Visite technique' },
            { icon: Building2, label: 'Banque / Admin' },
            { icon: UtensilsCrossed, label: 'Restaurant' },
          ].map((s, i) => (
            <Card key={i} className="text-center p-6 hover:border-primary transition-colors">
              <s.icon className="h-10 w-10 mx-auto mb-3 text-primary" />
              <div className="font-medium">{s.label}</div>
            </Card>
          ))}
        </div>
      </section>

      {/* FEATURES */}
      <section className="container py-20 border-t">
        <h2 className="text-3xl md:text-4xl font-bold text-center mb-16">Tout ce qu'il vous faut</h2>
        <div className="grid md:grid-cols-2 lg:grid-cols-4 gap-6">
          {[
            { icon: Bell, title: 'Notifications intelligentes', desc: 'Le client est prévenu quand son tour approche.' },
            { icon: Users, title: 'Multi-employés', desc: 'Assignez les clients à un coiffeur, conseiller, médecin…' },
            { icon: BarChart3, title: 'Analytics métier', desc: 'Pics d\'affluence, durée moyenne, taux de no-show.' },
            { icon: CheckCircle2, title: '100% web', desc: 'Aucune installation. Fonctionne sur tout mobile.' },
          ].map((f, i) => (
            <div key={i} className="p-6">
              <f.icon className="h-8 w-8 text-primary mb-3" />
              <h3 className="font-semibold mb-1">{f.title}</h3>
              <p className="text-sm text-muted-foreground">{f.desc}</p>
            </div>
          ))}
        </div>
      </section>

      {/* CTA */}
      <section className="container py-20">
        <div className="rounded-3xl bg-primary text-primary-foreground p-12 md:p-16 text-center">
          <h2 className="text-3xl md:text-5xl font-bold mb-4">Prêt à digitaliser votre file ?</h2>
          <p className="text-lg opacity-90 mb-8">Créez votre compte en 30 secondes. Vos clients vous remercieront.</p>
          <Link href="/signup">
            <Button size="xl" variant="secondary">Commencer maintenant <ArrowRight className="h-5 w-5" /></Button>
          </Link>
        </div>
      </section>

      <footer className="container py-10 text-center text-sm text-muted-foreground border-t">
        © {new Date().getFullYear()} Daourak — Made with ❤️
      </footer>
    </main>
  );
}
