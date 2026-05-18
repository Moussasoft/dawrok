import { redirect } from 'next/navigation';
import Link from 'next/link';
import { getSession } from '@/lib/auth';
import { prisma } from '@/lib/db';
import { LogOut, Shield, Building2, BarChart3, ArrowLeft, Activity, Settings } from 'lucide-react';

export const dynamic = 'force-dynamic';

export default async function AdminLayout({ children }: { children: React.ReactNode }) {
  const session = await getSession();
  if (!session) redirect('/login');
  if (!session.isSuperadmin) redirect('/dashboard');

  // If currently impersonating, show banner with exit button
  const impersonating = !!session.impersonatedFromUserId;
  let currentOrgName: string | null = null;
  if (impersonating && session.orgId) {
    const o = await prisma.organization.findUnique({ where: { id: session.orgId } });
    currentOrgName = o?.name ?? null;
  }

  return (
    <div className="min-h-screen bg-background">
      {impersonating && (
        <div className="bg-amber-500 text-amber-950 px-4 py-2 text-sm flex items-center justify-between gap-3">
          <div className="flex items-center gap-2 font-medium">
            <Shield className="h-4 w-4" />
            Mode imitation actif — connecté en tant que <strong>{currentOrgName ?? 'organisation'}</strong>
          </div>
          <form action="/api/admin/impersonate/stop" method="POST">
            <button type="submit" className="inline-flex items-center gap-1 rounded-md bg-amber-950 text-amber-50 px-3 py-1 text-xs font-medium hover:bg-amber-900">
              <ArrowLeft className="h-3 w-3" /> Quitter l'imitation
            </button>
          </form>
        </div>
      )}
      <header className="sticky top-0 z-30 border-b bg-card/95 backdrop-blur">
        <div className="container flex h-14 items-center justify-between">
          <Link href="/admin" className="flex items-center gap-2 font-bold">
            <span className="inline-flex h-7 w-7 items-center justify-center rounded-md bg-rose-600 text-white text-sm">
              <Shield className="h-4 w-4" />
            </span>
            <span>Daourak Admin</span>
            <span className="text-xs text-muted-foreground font-normal hidden sm:inline">· superadmin</span>
          </Link>
          <nav className="flex items-center gap-1">
            <Link href="/admin" className="px-3 py-1.5 rounded-md text-sm hover:bg-accent inline-flex items-center gap-1.5">
              <BarChart3 className="h-4 w-4" /><span className="hidden sm:inline">Vue globale</span>
            </Link>
            <Link href="/admin/orgs" className="px-3 py-1.5 rounded-md text-sm hover:bg-accent inline-flex items-center gap-1.5">
              <Building2 className="h-4 w-4" /><span className="hidden sm:inline">Organisations</span>
            </Link>
            <Link href="/admin/audit" className="px-3 py-1.5 rounded-md text-sm hover:bg-accent inline-flex items-center gap-1.5">
              <Activity className="h-4 w-4" /><span className="hidden sm:inline">Audit</span>
            </Link>
            <Link href="/admin/settings" className="px-3 py-1.5 rounded-md text-sm hover:bg-accent inline-flex items-center gap-1.5">
              <Settings className="h-4 w-4" /><span className="hidden sm:inline">Réglages</span>
            </Link>
            <form action="/api/auth/logout" method="POST">
              <button type="submit" className="px-3 py-1.5 rounded-md text-sm hover:bg-accent inline-flex items-center gap-1.5 text-muted-foreground">
                <LogOut className="h-4 w-4" />
              </button>
            </form>
          </nav>
        </div>
      </header>
      <main>{children}</main>
    </div>
  );
}
