'use client';
import { useState } from 'react';
import { useRouter } from 'next/navigation';
import Link from 'next/link';
import { Button } from '@/components/ui/button';
import { Input, Label } from '@/components/ui/input';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';

export default function LoginPage() {
  const router = useRouter();
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');

  async function onSubmit(e: React.FormEvent) {
    e.preventDefault();
    setLoading(true);
    setError(null);
    const res = await fetch('/api/auth/login', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ email, password }),
    });
    const data = await res.json();
    setLoading(false);
    if (!res.ok) { setError(data.error || 'Erreur'); return; }
    router.push(data.isSuperadmin ? '/admin' : '/dashboard');
  }

  return (
    <main className="min-h-screen gradient-mesh flex items-center justify-center p-4">
      <Card className="w-full max-w-md">
        <CardHeader>
          <Link href="/" className="text-sm text-muted-foreground hover:text-foreground mb-2">← Retour</Link>
          <CardTitle className="text-2xl">Connexion</CardTitle>
          <CardDescription>Connectez-vous à votre tableau de bord.</CardDescription>
        </CardHeader>
        <CardContent>
          <form onSubmit={onSubmit} className="space-y-4">
            <div className="space-y-1.5">
              <Label htmlFor="email">Email</Label>
              <Input id="email" type="email" value={email} onChange={(e) => setEmail(e.target.value)} required />
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="password">Mot de passe</Label>
              <Input id="password" type="password" value={password} onChange={(e) => setPassword(e.target.value)} required />
            </div>
            {error && <p className="text-sm text-destructive">{error}</p>}
            <Button type="submit" size="lg" className="w-full" disabled={loading}>
              {loading ? 'Connexion…' : 'Se connecter'}
            </Button>
            <p className="text-center text-sm text-muted-foreground">
              Pas de compte ? <Link href="/signup" className="text-primary hover:underline">Créer un compte</Link>
            </p>
          </form>
        </CardContent>
      </Card>
    </main>
  );
}
