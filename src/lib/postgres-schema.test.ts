import { readFileSync } from 'node:fs';
import { describe, expect, it } from 'vitest';
import { toPostgresSchema } from '../../scripts/sync-postgres-schema.mjs';

const read = (path: string) => readFileSync(new URL(`../../${path}`, import.meta.url), 'utf8');

describe('schéma PostgreSQL', () => {
  it('est à jour avec prisma/schema.prisma (sinon : npm run db:pg:sync puis nouvelle migration)', () => {
    expect(read('prisma/postgres/schema.prisma')).toBe(toPostgresSchema(read('prisma/schema.prisma')));
  });

  it('ne change que le fournisseur', () => {
    const pg = toPostgresSchema('datasource db {\n  provider = "sqlite"\n  url = env("DATABASE_URL")\n}\nmodel A { id String @id }\n') as string;
    expect(pg).toContain('provider = "postgresql"');
    expect(pg).toContain('model A { id String @id }');
    expect(pg).not.toContain('sqlite');
  });
});
