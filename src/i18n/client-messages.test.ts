import { readdirSync, readFileSync, statSync } from 'node:fs';
import { join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { describe, expect, it } from 'vitest';
import { CLIENT_NAMESPACES } from './client-messages';

const SRC = fileURLToPath(new URL('..', import.meta.url));

function files(dir: string): string[] {
  return readdirSync(dir).flatMap((name) => {
    const path = join(dir, name);
    if (statSync(path).isDirectory()) return files(path);
    return /\.tsx?$/.test(name) && !name.endsWith('.test.ts') ? [path] : [];
  });
}

// Composants exécutés dans le navigateur : « use client », ou composants partagés de src/components
// (sans directive, ils deviennent client dès qu'un composant client les importe).
const clientFiles = files(SRC).filter((f) => /^['"]use client['"]/.test(readFileSync(f, 'utf8')) || f.includes('/components/'));

describe('messages envoyés au navigateur', () => {
  it('contiennent chaque espace de noms utilisé par un composant client', () => {
    const missing: string[] = [];
    for (const file of clientFiles) {
      const source = readFileSync(file, 'utf8');
      for (const [, ns] of source.matchAll(/useTranslations\(\s*['"]([^'"]+)['"]\s*\)/g)) {
        const root = ns.split('.')[0];
        if (!(CLIENT_NAMESPACES as readonly string[]).includes(root)) missing.push(`${file.replace(SRC, '')} → ${root}`);
      }
    }
    expect(missing).toEqual([]);
  });

  it('ne demandent jamais tous les messages (useTranslations sans espace de noms)', () => {
    const offenders = clientFiles.filter((f) => /useTranslations\(\s*\)/.test(readFileSync(f, 'utf8')));
    expect(offenders.map((f) => f.replace(SRC, ''))).toEqual([]);
  });
});
