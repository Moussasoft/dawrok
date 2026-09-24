import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { describe, expect, it } from 'vitest';

// Cohérence des traductions : mêmes clés dans les trois langues, mêmes placeholders ICU.
const LOCALES = ['fr', 'en', 'ar'] as const;
type Locale = (typeof LOCALES)[number];
type MessageTree = { [key: string]: unknown };

function load(locale: Locale): MessageTree {
  const file = fileURLToPath(new URL(`../../messages/${locale}.json`, import.meta.url));
  return JSON.parse(readFileSync(file, 'utf8')) as MessageTree;
}

/** Aplatit l'arbre de messages : { a: { b: 'x' } } → { 'a.b': 'x' }. */
function flatten(tree: MessageTree, prefix = '', out: Record<string, unknown> = {}): Record<string, unknown> {
  for (const [key, value] of Object.entries(tree)) {
    const path = prefix ? `${prefix}.${key}` : key;
    if (value && typeof value === 'object' && !Array.isArray(value)) flatten(value as MessageTree, path, out);
    else out[path] = value;
  }
  return out;
}

type IcuInfo = {
  /** Nom de l'argument → type (« simple », « plural », « select », « number »…). */
  args: Map<string, string>;
  /** Arguments plural / select sans branche `other` (obligatoire en ICU). */
  missingOther: string[];
};

/**
 * Extracteur ICU minimal : arguments `{name}`, `{n, number}`, `{count, plural, …}` et
 * `{x, select, …}`, y compris imbriqués dans les branches. Gère l'échappement par
 * apostrophe (`'{…}'` littéral, `''` = apostrophe). Lève une erreur si les accolades
 * sont mal formées.
 */
function parseIcu(message: string): IcuInfo {
  const args = new Map<string, string>();
  const missingOther: string[] = [];
  let i = 0;

  const readMessage = (nested: boolean): void => {
    while (i < message.length) {
      const c = message[i];
      if (c === "'") {
        const next = message[i + 1];
        if (next === "'") {
          i += 2;
        } else if (next === '{' || next === '}' || (nested && next === '#')) {
          const end = message.indexOf("'", i + 1);
          i = end === -1 ? message.length : end + 1;
        } else {
          i++;
        }
      } else if (c === '{') {
        i++;
        readArgument();
      } else if (c === '}') {
        if (nested) return; // accolade fermante consommée par l'appelant
        throw new Error(`accolade fermante inattendue (position ${i})`);
      } else {
        i++;
      }
    }
    if (nested) throw new Error('accolade non fermée');
  };

  const readArgument = (): void => {
    const header = /^\s*([^\s,{}]+)\s*(?:,\s*(\w+)\s*)?/.exec(message.slice(i));
    if (!header) throw new Error(`argument invalide (position ${i})`);
    i += header[0].length;
    const [, name, type = 'simple'] = header;
    args.set(name, type);
    if (type !== 'plural' && type !== 'select' && type !== 'selectordinal') {
      const end = message.indexOf('}', i);
      if (end === -1) throw new Error(`argument « ${name} » non fermé`);
      i = end + 1;
      return;
    }
    if (message[i] !== ',') throw new Error(`options attendues pour « ${name} »`);
    i++;
    const selectors: string[] = [];
    for (;;) {
      i += /^\s*/.exec(message.slice(i))![0].length;
      if (message[i] === '}') {
        i++;
        break;
      }
      const selector = /^(offset:\s*\d+|[^\s{}]+)\s*/.exec(message.slice(i));
      if (!selector) throw new Error(`sélecteur attendu pour « ${name} » (position ${i})`);
      i += selector[0].length;
      if (selector[1].startsWith('offset:')) continue;
      if (message[i] !== '{') throw new Error(`« { » attendue après « ${selector[1]} »`);
      i++;
      readMessage(true);
      i++; // « } » de la branche
      selectors.push(selector[1]);
    }
    if (!selectors.includes('other')) missingOther.push(name);
  };

  readMessage(false);
  return { args, missingOther };
}

const messages = Object.fromEntries(LOCALES.map((l) => [l, flatten(load(l))])) as Record<Locale, Record<string, unknown>>;

describe('extracteur ICU (outil du test)', () => {
  it('reconnaît arguments simples, pluriels imbriqués et apostrophes', () => {
    const info = parseIcu('{count, plural, =0 {Aucun} one {# pour {name}} other {# pour {name}}} — {branch}');
    expect([...info.args]).toEqual([
      ['count', 'plural'],
      ['name', 'simple'],
      ['branch', 'simple'],
    ]);
    expect([...parseIcu("L''agence '{pas un argument}' ouvre à {time}").args]).toEqual([['time', 'simple']]);
    expect(parseIcu('{n, plural, one {#}}').missingOther).toEqual(['n']);
    expect(() => parseIcu('Bonjour {name')).toThrow();
  });
});

describe('messages fr / en / ar', () => {
  it('les trois fichiers ont exactement les mêmes clés', () => {
    const reference = Object.keys(messages.fr);
    expect(reference.length).toBeGreaterThan(0);
    for (const locale of ['en', 'ar'] as const) {
      const missing = reference.filter((k) => !(k in messages[locale]));
      const extra = Object.keys(messages[locale]).filter((k) => !(k in messages.fr));
      expect({ missing, extra }, `${locale}.json diffère de fr.json`).toEqual({ missing: [], extra: [] });
    }
  });

  it('chaque traduction est une chaîne non vide', () => {
    for (const locale of LOCALES) {
      const invalid = Object.entries(messages[locale])
        .filter(([, v]) => typeof v !== 'string' || v.trim() === '')
        .map(([k]) => k);
      expect(invalid, `${locale}.json : valeurs vides ou non textuelles`).toEqual([]);
    }
  });

  it('chaque message est un ICU bien formé, dont les pluriels ont une branche other', () => {
    const problems: string[] = [];
    for (const locale of LOCALES) {
      for (const [key, value] of Object.entries(messages[locale])) {
        try {
          const { missingOther } = parseIcu(String(value));
          for (const name of missingOther) problems.push(`${locale}:${key} → {${name}} sans branche other`);
        } catch (e) {
          problems.push(`${locale}:${key} → ${(e as Error).message}`);
        }
      }
    }
    expect(problems).toEqual([]);
  });

  it('les placeholders de fr existent, avec le même type, dans en et ar (et inversement)', () => {
    const problems: string[] = [];
    for (const [key, frValue] of Object.entries(messages.fr)) {
      if (typeof frValue !== 'string') continue;
      const frArgs = parseIcu(frValue).args;
      for (const locale of ['en', 'ar'] as const) {
        const value = messages[locale][key];
        if (typeof value !== 'string') continue; // déjà signalé par le test des clés
        const args = parseIcu(value).args;
        for (const [name, type] of frArgs) {
          if (!args.has(name)) problems.push(`${locale}:${key} → {${name}} manquant`);
          else if (args.get(name) !== type) problems.push(`${locale}:${key} → {${name}} de type ${args.get(name)} au lieu de ${type}`);
        }
        for (const name of args.keys()) {
          if (!frArgs.has(name)) problems.push(`${locale}:${key} → {${name}} absent de fr`);
        }
      }
    }
    expect(problems).toEqual([]);
  });
});
