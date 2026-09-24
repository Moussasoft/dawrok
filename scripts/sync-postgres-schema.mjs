#!/usr/bin/env node
// Génère prisma/postgres/schema.prisma à partir de prisma/schema.prisma (SQLite, développement) :
// Prisma ne permet pas de choisir le fournisseur par variable d'environnement.
// À relancer après chaque modification du schéma (`npm run db:pg:sync`), puis créer la migration.
import { readFileSync, writeFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';

const HEADER = '// ⚠️ Fichier généré par scripts/sync-postgres-schema.mjs depuis prisma/schema.prisma — ne pas modifier.\n';

export function toPostgresSchema(source) {
  const datasource = /datasource\s+db\s*\{[^}]*\}/;
  const block = source.match(datasource)?.[0];
  if (!block || !/provider\s*=\s*"sqlite"/.test(block)) throw new Error('Bloc datasource SQLite introuvable dans prisma/schema.prisma');
  return HEADER + source.replace(datasource, block.replace(/provider\s*=\s*"sqlite"/, 'provider = "postgresql"'));
}

if (process.argv[1] === fileURLToPath(import.meta.url)) {
  const root = new URL('..', import.meta.url);
  const source = readFileSync(new URL('prisma/schema.prisma', root), 'utf8');
  writeFileSync(new URL('prisma/postgres/schema.prisma', root), toPostgresSchema(source));
  console.log('prisma/postgres/schema.prisma à jour');
}
