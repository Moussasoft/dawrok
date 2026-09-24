import { PrismaClient, type Prisma } from '@prisma/client';

const globalForPrisma = globalThis as unknown as { prisma?: PrismaClient };

/**
 * SQLite : délai d'attente du verrou (`socket_timeout`, en secondes) appliqué à TOUTES les
 * connexions du pool — un PRAGMA exécuté une seule fois ne concernait qu'une connexion.
 */
function datasourceUrl(): string | undefined {
  const url = process.env.DATABASE_URL;
  if (!url?.startsWith('file:') || url.includes('socket_timeout')) return undefined;
  return `${url}${url.includes('?') ? '&' : '?'}socket_timeout=15`;
}

function makePrisma() {
  const client = new PrismaClient({
    datasourceUrl: datasourceUrl(),
    log: process.env.NODE_ENV === 'development' ? ['warn', 'error'] : ['error'],
  });
  // Mode WAL (persistant au niveau du fichier) : lectures concurrentes pendant les écritures.
  if (process.env.DATABASE_URL?.startsWith('file:')) {
    void client.$queryRawUnsafe('PRAGMA journal_mode = WAL').catch(() => {});
  }
  return client;
}

export const prisma = globalForPrisma.prisma ?? makePrisma();

/** Base PostgreSQL (production) plutôt que SQLite (développement). */
export const isPostgres = /^postgres(ql)?:\/\//.test(process.env.DATABASE_URL ?? '');

/**
 * « Contient », sans tenir compte de la casse dans les deux bases : SQLite (LIKE) l'ignore déjà,
 * PostgreSQL demande `mode: 'insensitive'` (option absente des types générés pour SQLite).
 */
export function containsText(value: string): Prisma.StringFilter {
  return (isPostgres ? { contains: value, mode: 'insensitive' } : { contains: value }) as Prisma.StringFilter;
}

if (process.env.NODE_ENV !== 'production') globalForPrisma.prisma = prisma;
