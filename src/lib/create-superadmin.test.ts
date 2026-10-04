import { describe, expect, it } from 'vitest';
import { z } from 'zod';
import { decideAction, generatePassword, isValidEmail, loginUrl, normalizeEmail, showInvisibles } from '../../scripts/create-superadmin.mjs';

describe('e-mail du superadmin', () => {
  it('retire les espaces et passe en minuscules', () => {
    expect(normalizeEmail('  Admin@Example.TEST \n')).toBe('admin@example.test');
  });
  it('accepte un e-mail usuel, jusqu’à 200 caractères', () => {
    expect(isValidEmail('admin@example.test')).toBe(true);
    expect(isValidEmail(`${'a'.repeat(187)}@example.test`)).toBe(true);
    expect(isValidEmail(`${'a'.repeat(188)}@example.test`)).toBe(false);
  });
  it('refuse un accent à moitié effacé dans un terminal (U+FFFD) et les caractères invisibles', () => {
    expect(isValidEmail('contact�@example.test')).toBe(false);
    expect(isValidEmail('contact​@example.test')).toBe(false);
    expect(isValidEmail('contacté@example.test')).toBe(false);
    expect(isValidEmail('contact\u001B[D@example.test')).toBe(false);
  });
  it('applique la même règle que les routes (zod), sinon la connexion refuserait le compte créé', () => {
    const schema = z.string().email().max(200);
    const samples = [
      'admin@example.test',
      'prenom.nom+alias@sous.domaine.example.test',
      'o’neil@example.test',
      "o'neil_99@example-site.test",
      '',
      'admin',
      'admin@example',
      'admin@@example.test',
      '.admin@example.test',
      'ad..min@example.test',
      'admin.@example.test',
      'ad min@example.test',
      'ad%min@example.test',
      'admin@-example.test',
      'admin@example.t',
      'àdmin@example.test',
      'contact�@example.test',
      'admin@example.test\n',
      `${'a'.repeat(188)}@example.test`,
    ];
    for (const sample of samples) expect(isValidEmail(sample), sample).toBe(schema.safeParse(sample).success);
  });
  it('rend visibles les caractères refusés dans le message d’erreur', () => {
    expect(showInvisibles('contact�@example.test')).toBe('contact\\ufffd@example.test');
    expect(showInvisibles('contact​\u001B@example.test')).toBe('contact\\u200b\\u001b@example.test');
    expect(showInvisibles('admin@example.test')).toBe('admin@example.test');
  });
});

describe('generatePassword', () => {
  it('produit 20 caractères alphanumériques, différents à chaque appel', () => {
    const password = generatePassword();
    expect(password).toMatch(/^[A-Za-z0-9]{20}$/);
    expect(generatePassword()).not.toBe(password);
  });
  it('utilise tout l’alphabet, sans les caractères qui se confondent (0 O o, 1 l I)', () => {
    const seen = new Set(Array.from({ length: 300 }, () => generatePassword()).join(''));
    expect([...seen].sort().join('')).toBe('23456789ABCDEFGHJKLMNPQRSTUVWXYZabcdefghijkmnpqrstuvwxyz');
  });
});

describe('decideAction', () => {
  const superadmin = { isSuperadmin: true };
  const pro = { isSuperadmin: false };
  it('crée le compte quand l’e-mail est libre', () => {
    expect(decideAction([])).toBe('create');
  });
  it('réinitialise le mot de passe d’un superadmin existant', () => {
    expect(decideAction([superadmin])).toBe('reset');
  });
  it('ne touche pas à un compte qui n’est pas superadmin', () => {
    expect(decideAction([pro])).toBe('refuse');
  });
  it('ne choisit pas entre plusieurs comptes homonymes à la casse près', () => {
    expect(decideAction([superadmin, superadmin])).toBe('refuse');
    expect(decideAction([superadmin, pro])).toBe('refuse');
  });
});

describe('loginUrl', () => {
  it('pointe vers la page de connexion en français', () => {
    expect(loginUrl('https://app.example.test')).toBe('https://app.example.test/fr/login');
    expect(loginUrl('https://app.example.test/')).toBe('https://app.example.test/fr/login');
  });
  it('se replie sur le serveur local sans NEXT_PUBLIC_APP_URL', () => {
    expect(loginUrl(undefined)).toBe('http://localhost:3000/fr/login');
    expect(loginUrl('')).toBe('http://localhost:3000/fr/login');
  });
});
