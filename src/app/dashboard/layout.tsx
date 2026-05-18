import { redirect } from 'next/navigation';
import Link from 'next/link';
import { getSession } from '@/lib/auth';
import { prisma } from '@/lib/db';
import { LogOut, LayoutDashboard, BarChart3, QrCode, Settings, Users } from 'lucide-react';
import { ThemeToggle } from '@/components/theme-toggle';

export const dynamic = 'force-dynamic';

export default async function DashboardLayout({ children }: { children: React.ReactNode }) {
  const session = await getSession();
  if (!session) redirect('/login');
  if (session.isSuperadmin && !session.orgId) redirect('/admin');
  if (!session.orgId) redirect('/login');
  const org = await prisma.organization.findUnique({
    where: { id: session.orgId },
    include: { branches: { take: 1 } },
  });
  if (!org) redirect('/login');
  const branch = org.branches[0];

  return (
    <div className="min-h-screen bg-background">
      <header className="sticky top-0 z-30 border-b bg-card/95 backdrop-blur">
        <div className="container flex h-14 items-center justify-between">
          <div className="flex items-center gap-3">
            <Link href="/dashboard" className="flex items-center gap-2 font-bold">
              <span className="inline-flex h-7 w-7 items-center justify-center rounded-md bg-primary text-primary-foreground text-sm">D</span>
              <span className="hidden sm:inline">{org.name}</span>
            </Link>
          </div>
          <nav className="flex items-center gap-1">
            <Link href="/dashboard" className="px-3 py-1.5 rounded-md text-sm hover:bg-accent inline-flex items-center gap-1.5">
              <LayoutDashboard className="h-4 w-4" /><span className="hidden sm:inline">File</span>
            </Link>
            <Link href="/dashboard/analytics" className="px-3 py-1.5 rounded-md text-sm hover:bg-accent inline-flex items-center gap-1.5">
              <BarChart3 className="h-4 w-4" /><span className="hidden sm:inline">Analytics</span>
            </Link>
            <Link href="/dashboard/customers" className="px-3 py-1.5 rounded-md text-sm hover:bg-accent inline-flex items-center gap-1.5">
              <Users className="h-4 w-4" /><span className="hidden sm:inline">Clients</span>
            </Link>
            {branch && (
              <Link href="/dashboard/qr" className="px-3 py-1.5 rounded-md text-sm hover:bg-accent inline-flex items-center gap-1.5">
                <QrCode className="h-4 w-4" /><span className="hidden sm:inline">QR Code</span>
              </Link>
            )}
            <Link href="/dashboard/settings" className="px-3 py-1.5 rounded-md text-sm hover:bg-accent inline-flex items-center gap-1.5">
              <Settings className="h-4 w-4" /><span className="hidden sm:inline">Réglages</span>
            </Link>
            <ThemeToggle className="ml-1 hidden md:inline-flex" />
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
