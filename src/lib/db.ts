import { PrismaClient } from '@prisma/client';

const globalForPrisma = globalThis as unknown as { prisma?: PrismaClient };

function makePrisma() {
  const client = new PrismaClient({
    log: process.env.NODE_ENV === 'development' ? ['warn', 'error'] : ['error'],
  });
  // SQLite : attendre jusqu'à 10 s si la base est verrouillée plutôt que d'échouer immédiatement.
  // Utiliser le mode WAL pour permettre les lectures concurrentes pendant les écritures.
  // $queryRawUnsafe est nécessaire car ces PRAGMAs retournent des lignes de résultat.
  void client.$queryRawUnsafe('PRAGMA busy_timeout = 10000').catch(() => {});
  void client.$queryRawUnsafe('PRAGMA journal_mode = WAL').catch(() => {});
  return client;
}

export const prisma = globalForPrisma.prisma ?? makePrisma();

if (process.env.NODE_ENV !== 'production') globalForPrisma.prisma = prisma;
