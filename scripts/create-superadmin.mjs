#!/usr/bin/env node
// Crée le premier superadmin en production, ou réinitialise le mot de passe d'un superadmin existant :
// `npm run admin:create` (demande l'e-mail) ou `npm run admin:create -- vous@exemple.com`, dans le terminal du serveur.
// `npm run db:seed` ne doit jamais y tourner (comptes de démonstration aux mots de passe publics) et l'invitation
// depuis la console exige déjà un superadmin. Node seul : @prisma/client et bcryptjs, ni tsx ni TypeScript.
// L'image Docker ne contient pas tout node_modules : un import de plus doit y être copié (Dockerfile, étape runner).
import { randomInt } from 'node:crypto';
import { realpathSync } from 'node:fs';
import { createInterface } from 'node:readline';
import { fileURLToPath } from 'node:url';
import { PrismaClient } from '@prisma/client';
import bcrypt from 'bcryptjs';

const USAGE = 'Usage : npm run admin:create -- [e-mail]';
// Même règle que les routes (`z.string().email().max(200)`) : un e-mail accepté ici doit l'être à la connexion.
const EMAIL = /^(?!\.)(?!.*\.\.)([A-Z0-9_'+\-.]*)[A-Z0-9_+-]@([A-Z0-9][A-Z0-9-]*\.)+[A-Z]{2,}$/i;
// Sans les caractères qui se confondent à la lecture : 0 O o, 1 l I.
const PASSWORD_ALPHABET = 'ABCDEFGHJKLMNPQRSTUVWXYZabcdefghijkmnpqrstuvwxyz23456789';

export function normalizeEmail(raw) {
  return raw.trim().toLowerCase();
}

export function isValidEmail(email) {
  return email.length <= 200 && EMAIL.test(email);
}

/** Échappe ce qu'un terminal peut glisser dans une saisie sans que cela se voie : accent tronqué, caractère invisible. */
export function showInvisibles(text) {
  return text.replace(/[^\x20-\x7e]/g, (c) => `\\u${c.charCodeAt(0).toString(16).padStart(4, '0')}`);
}

export function generatePassword(length = 20) {
  return Array.from({ length }, () => PASSWORD_ALPHABET[randomInt(PASSWORD_ALPHABET.length)]).join('');
}

/**
 * Que faire des comptes déjà enregistrés sous cet e-mail (à la casse près) ? Dans le doute, rien :
 * on ne transforme jamais un compte d'organisation et on ne choisit pas entre deux homonymes.
 */
export function decideAction(matches) {
  if (matches.length === 0) return 'create';
  return matches.length === 1 && matches[0].isSuperadmin ? 'reset' : 'refuse';
}

/** Page de connexion en français, sur la même base que `appBaseUrl()` (src/lib/urls.ts). */
export function loginUrl(appUrl) {
  return `${(appUrl || 'http://localhost:3000').replace(/\/$/, '')}/fr/login`;
}

const errorMessage = (e) => (e instanceof Error ? e.message.trim() : String(e));

// Entrée fermée sans réponse (Ctrl+C, Ctrl+D, pas de terminal) : chaîne vide plutôt qu'une attente sans fin.
// Événement « line » plutôt que rl.question(), qui ignore une dernière ligne sans retour chariot.
function ask(question) {
  const rl = createInterface({ input: process.stdin, output: process.stdout });
  return new Promise((resolve) => {
    rl.once('close', () => resolve(''));
    rl.once('line', (answer) => {
      resolve(answer);
      rl.close();
    });
    rl.setPrompt(question);
    rl.prompt();
  });
}

async function main(args) {
  if (args.length > 1) {
    console.error(USAGE);
    return 1;
  }
  const email = normalizeEmail(args[0] ?? (await ask('E-mail du superadmin : ')));
  if (!isValidEmail(email)) {
    const reason = email
      ? `E-mail invalide, rien n'a été modifié : « ${showInvisibles(email)} ».\nAttendu : nom@domaine, sans accent ni espace (lettres, chiffres et . _ + - ' uniquement).`
      : 'Aucun e-mail saisi.';
    console.error(`${reason}\n${USAGE}`);
    return 1;
  }

  const prisma = new PrismaClient({ errorFormat: 'minimal' });
  try {
    // Comparaison en JavaScript : SQLite et PostgreSQL ne traitent pas la casse de la même façon,
    // et la table User (comptes des pros, pas leurs clients) reste petite.
    const users = await prisma.user.findMany({ select: { id: true, email: true, isSuperadmin: true } });
    const matches = users.filter((u) => u.email.toLowerCase() === email);
    const action = decideAction(matches);
    if (action === 'refuse') {
      const reason =
        matches.length > 1
          ? `plusieurs comptes correspondent à cet e-mail (${matches.map((u) => u.email).join(', ')})`
          : `${matches[0].email} appartient déjà à un compte qui n'est pas superadmin`;
      console.error(`Rien n'a été modifié : ${reason}.\nRelancez la commande avec un autre e-mail.`);
      return 1;
    }

    const password = generatePassword();
    // Même coût que hashPassword() (src/lib/passwords.ts).
    const passwordHash = await bcrypt.hash(password, 12);
    let user = matches[0];
    if (action === 'create') {
      // Mêmes champs que l'invitation depuis la console (api/admin/settings/superadmins) ;
      // le nom se change ensuite dans Réglages → Profil.
      user = await prisma.user.create({
        data: { name: 'Super Admin', email, passwordHash, role: 'owner', isSuperadmin: true },
        select: { id: true, email: true },
      });
    } else {
      // passwordChangedAt révoque les sessions existantes ; le filtre isSuperadmin protège un compte révoqué entre-temps.
      const { count } = await prisma.user.updateMany({
        where: { id: user.id, isSuperadmin: true },
        data: { passwordHash, passwordChangedAt: new Date() },
      });
      if (count === 0) throw new Error(`${user.email} n'est plus superadmin, rien n'a été modifié.`);
    }

    // Même ligne que audit() (src/lib/audit.ts), sans acteur connecté.
    try {
      await prisma.auditLog.create({
        data: {
          action: action === 'create' ? 'superadmin.invite' : 'superadmin.password',
          actorName: 'Terminal serveur',
          targetType: 'user',
          targetId: user.id,
          metadata: JSON.stringify({ email: user.email }),
        },
      });
    } catch (e) {
      // Un échec d'audit ne doit jamais casser l'action principale
      console.error('[audit] échec :', errorMessage(e));
    }

    // Seul endroit où le mot de passe apparaît : ni journal, ni audit.
    console.log(
      [
        action === 'create' ? 'Superadmin créé.' : 'Mot de passe réinitialisé : les sessions ouvertes de ce superadmin sont révoquées.',
        '',
        // La connexion compare l'e-mail tel qu'il est enregistré : un ancien compte peut contenir des majuscules.
        `  E-mail       : ${user.email}${user.email === email ? '' : '  (à saisir tel quel, majuscules comprises)'}`,
        `  Mot de passe : ${password}`,
        `  Connexion    : ${loginUrl(process.env.NEXT_PUBLIC_APP_URL)}`,
        '',
        'Ce mot de passe ne sera plus affiché : conservez-le maintenant.',
      ].join('\n'),
    );
    return 0;
  } finally {
    await prisma.$disconnect();
  }
}

// realpath : le chemin d'appel peut passer par un lien symbolique, pas l'URL du module.
if (process.argv[1] && realpathSync(process.argv[1]) === fileURLToPath(import.meta.url)) {
  main(process.argv.slice(2)).then(
    (code) => {
      process.exitCode = code;
    },
    (e) => {
      console.error(`Échec : ${errorMessage(e)}`);
      process.exitCode = 1;
    },
  );
}
