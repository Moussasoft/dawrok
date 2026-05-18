'use client';
import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { Button } from '@/components/ui/button';
import { Input, Label } from '@/components/ui/input';

type Service = { id: string; name: string; durationMin: number };

export function TakeTicketForm({ qrToken, services }: { qrToken: string; services: Service[] }) {
  const router = useRouter();
  const [name, setName] = useState('');
  const [phone, setPhone] = useState('');
  const [serviceId, setServiceId] = useState<string | null>(services[0]?.id ?? null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function onSubmit(e: React.FormEvent) {
    e.preventDefault();
    setLoading(true);
    setError(null);
    const res = await fetch('/api/tickets', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ qrToken, customerName: name, customerPhone: phone || null, serviceId }),
    });
    const data = await res.json();
    setLoading(false);
    if (!res.ok) { setError(data.error || 'Erreur'); return; }
    router.push(`/t/${data.publicCode}`);
  }

  return (
    <form onSubmit={onSubmit} className="space-y-4 rounded-2xl bg-card border p-6 shadow-sm">
      <h2 className="text-xl font-semibold">Prendre mon ticket</h2>
      <div className="space-y-1.5">
        <Label htmlFor="name">Votre prénom *</Label>
        <Input id="name" value={name} onChange={(e) => setName(e.target.value)} required maxLength={80} />
      </div>
      <div className="space-y-1.5">
        <Label htmlFor="phone">Téléphone (pour SMS, optionnel)</Label>
        <Input id="phone" type="tel" value={phone} onChange={(e) => setPhone(e.target.value)} maxLength={30} />
      </div>
      {services.length > 1 && (
        <div className="space-y-1.5">
          <Label>Prestation</Label>
          <div className="grid grid-cols-1 gap-2">
            {services.map((s) => (
              <button
                key={s.id}
                type="button"
                onClick={() => setServiceId(s.id)}
                className={`text-left rounded-lg border p-3 transition-colors ${
                  serviceId === s.id ? 'border-primary bg-primary/5' : 'hover:bg-accent'
                }`}
              >
                <div className="font-medium">{s.name}</div>
                <div className="text-xs text-muted-foreground">~{s.durationMin} min</div>
              </button>
            ))}
          </div>
        </div>
      )}
      {error && <p className="text-sm text-destructive">{error}</p>}
      <Button type="submit" size="xl" className="w-full" disabled={loading}>
        {loading ? 'Création…' : 'Prendre mon ticket'}
      </Button>
    </form>
  );
}
