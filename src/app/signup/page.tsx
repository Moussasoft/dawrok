'use client';
import { useState } from 'react';
import { useRouter } from 'next/navigation';
import Link from 'next/link';
import { Button } from '@/components/ui/button';
import { Input, Label } from '@/components/ui/input';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';

const SECTORS = [
  { value: 'hairdresser', label: '✂️ Coiffure / Barbier' },
  { value: 'doctor', label: '🩺 Médecin / Cabinet' },
  { value: 'vehicle_inspection', label: '🚗 Visite technique' },
  { value: 'bank', label: '🏦 Banque / Administration' },
  { value: 'restaurant', label: '🍽️ Restaurant' },
  { value: 'other', label: '📋 Autre service' },
];

export default function SignupPage() {
  const router = useRouter();
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [form, setForm] = useState({
    orgName: '',
    sector: 'hairdresser',
    name: '',
    email: '',
    password: '',
  });

  async function onSubmit(e: React.FormEvent) {
    e.preventDefault();
    setLoading(true);
    setError(null);
    const res = await fetch('/api/auth/signup', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(form),
    });
    const data = await res.json();
    setLoading(false);
    if (!res.ok) {
      setError(data.error || 'Erreur');
      return;
    }
    router.push('/dashboard');
  }

  return (
    <main className="min-h-screen gradient-mesh flex items-center justify-center p-4">
      <Card className="w-full max-w-md">
        <CardHeader>
          <Link href="/" className="text-sm text-muted-foreground hover:text-foreground mb-2">← Retour</Link>
          <CardTitle className="text-2xl">Créer un compte</CardTitle>
          <CardDescription>Démarrez votre file d'attente digitale en 30 secondes.</CardDescription>
        </CardHeader>
        <CardContent>
          <form onSubmit={onSubmit} className="space-y-4">
            <div className="space-y-1.5">
              <Label htmlFor="orgName">Nom du commerce</Label>
              <Input id="orgName" placeholder="Ex : Salon Karim" value={form.orgName}
                onChange={(e) => setForm({ ...form, orgName: e.target.value })} required />
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="sector">Secteur d'activité</Label>
              <select
                id="sector"
                className="flex h-11 w-full rounded-lg border border-input bg-background px-3 py-2 text-base shadow-sm"
                value={form.sector}
                onChange={(e) => setForm({ ...form, sector: e.target.value })}
              >
                {SECTORS.map((s) => <option key={s.value} value={s.value}>{s.label}</option>)}
              </select>
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="name">Votre nom</Label>
              <Input id="name" value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value })} required />
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="email">Email</Label>
              <Input id="email" type="email" value={form.email} onChange={(e) => setForm({ ...form, email: e.target.value })} required />
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="password">Mot de passe</Label>
              <Input id="password" type="password" minLength={8} value={form.password}
                onChange={(e) => setForm({ ...form, password: e.target.value })} required />
              <p className="text-xs text-muted-foreground">Minimum 8 caractères</p>
            </div>
            {error && <p className="text-sm text-destructive">{error}</p>}
            <Button type="submit" size="lg" className="w-full" disabled={loading}>
              {loading ? 'Création…' : 'Créer mon compte'}
            </Button>
            <p className="text-center text-sm text-muted-foreground">
              Déjà un compte ? <Link href="/login" className="text-primary hover:underline">Connexion</Link>
            </p>
          </form>
        </CardContent>
      </Card>
    </main>
  );
}
