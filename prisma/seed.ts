// Demo seed for Daourak
import { PrismaClient } from '@prisma/client';
import bcrypt from 'bcryptjs';

const prisma = new PrismaClient();

async function main() {
  console.log('Seeding demo data...');

  // Create or reset superadmin
  const superHash = await bcrypt.hash('super1234', 10);
  await prisma.user.upsert({
    where: { email: 'super@daourak.app' },
    update: { passwordHash: superHash, isSuperadmin: true, orgId: null, name: 'Super Admin', role: 'owner' },
    create: {
      email: 'super@daourak.app',
      passwordHash: superHash,
      name: 'Super Admin',
      isSuperadmin: true,
      role: 'owner',
    },
  });

  // Reset demo org if exists
  const existing = await prisma.organization.findUnique({ where: { slug: 'salon-karim' } });
  if (existing) {
    await prisma.organization.delete({ where: { id: existing.id } });
  }

  const passwordHash = await bcrypt.hash('demo1234', 10);

  const org = await prisma.organization.create({
    data: {
      name: 'Salon Karim',
      slug: 'salon-karim',
      sector: 'hairdresser',
      plan: 'pro',
      brandColor: '#6366F1',
      users: {
        create: {
          email: 'demo@daourak.app',
          passwordHash,
          name: 'Karim',
          role: 'owner',
        },
      },
      branches: {
        create: {
          name: 'Salon Karim - Centre-ville',
          address: '12 rue Mohammed V, Casablanca',
          qrToken: 'demo-salon-karim',
          services: {
            create: [
              { name: 'Coupe homme', avgDurationMin: 25 },
              { name: 'Coupe + barbe', avgDurationMin: 40 },
              { name: 'Coloration', avgDurationMin: 60 },
            ],
          },
          employees: {
            create: [{ name: 'Karim' }, { name: 'Youssef' }],
          },
        },
      },
    },
    include: { branches: { include: { services: true } } },
  });

  // Create a second demo org for richer admin view
  const passwordHash2 = await bcrypt.hash('demo1234', 10);
  await prisma.organization.create({
    data: {
      name: 'Centre Visite Auto',
      slug: 'centre-visite-auto',
      sector: 'vehicle_inspection',
      plan: 'starter',
      users: {
        create: {
          email: 'auto@daourak.app',
          passwordHash: passwordHash2,
          name: 'Hassan',
          role: 'owner',
        },
      },
      branches: {
        create: {
          name: 'Centre principal',
          address: 'Zone industrielle Sidi Bernoussi',
          qrToken: 'demo-visite-auto',
          services: {
            create: [
              { name: 'Auto', avgDurationMin: 25 },
              { name: 'Moto', avgDurationMin: 15 },
              { name: 'Poids lourd', avgDurationMin: 45 },
            ],
          },
          employees: { create: [{ name: 'Hassan' }] },
        },
      },
    },
  });

  const branch = org.branches[0];
  const services = branch.services;

  // Historical tickets across last 30 days for analytics
  const now = new Date();
  let counter = 0;
  for (let day = 30; day >= 1; day--) {
    const date = new Date(now);
    date.setDate(date.getDate() - day);
    if (date.getDay() === 0) continue;
    const dailyCount = 8 + Math.floor(Math.random() * 12);
    for (let i = 0; i < dailyCount; i++) {
      counter++;
      const peakRand = Math.random();
      const hour =
        peakRand < 0.4
          ? 10 + Math.floor(Math.random() * 3)
          : peakRand < 0.75
            ? 17 + Math.floor(Math.random() * 3)
            : 9 + Math.floor(Math.random() * 11);
      const created = new Date(date);
      created.setHours(hour, Math.floor(Math.random() * 60), 0, 0);
      const service = services[Math.floor(Math.random() * services.length)];
      const dur = service.avgDurationMin + (Math.random() * 10 - 5);
      const started = new Date(created.getTime() + Math.random() * 10 * 60000);
      const completed = new Date(started.getTime() + dur * 60000);
      const r = Math.random();
      const status = r < 0.85 ? 'done' : r < 0.92 ? 'no_show' : 'cancelled';
      await prisma.ticket.create({
        data: {
          branchId: branch.id,
          number: i + 1,
          customerName: `Client ${counter}`,
          customerPhone: null,
          serviceId: service.id,
          status,
          createdAt: created,
          calledAt: status === 'done' ? new Date(created.getTime() + 5 * 60000) : null,
          startedAt: status === 'done' ? started : null,
          completedAt: completed,
        },
      });
    }
  }

  // Add a few live waiting tickets for today
  for (let i = 0; i < 4; i++) {
    await prisma.ticket.create({
      data: {
        branchId: branch.id,
        number: i + 1,
        customerName: ['Ahmed', 'Sara', 'Omar', 'Lina'][i],
        serviceId: services[i % services.length].id,
        status: 'waiting',
        createdAt: new Date(Date.now() - (3 - i) * 5 * 60000),
      },
    });
  }

  console.log('Seed termine.');
  console.log('');
  console.log('Superadmin:');
  console.log('  Email    : super@daourak.app');
  console.log('  Password : super1234');
  console.log('  URL      : http://localhost:3000/admin');
  console.log('');
  console.log('Connexion pro:');
  console.log('  Email    : demo@daourak.app');
  console.log('  Password : demo1234');
  console.log('');
  console.log('QR public client :  http://localhost:3000/q/demo-salon-karim');
  console.log('Dashboard pro    :  http://localhost:3000/dashboard');
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(() => prisma.$disconnect());
