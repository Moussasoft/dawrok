// Seuls les espaces de noms utilisés par des composants client sont envoyés au navigateur :
// les textes longs ou serveur (pages légales, e-mails, SMS, landing, analytics…) restent côté serveur.
// Le test client-messages.test.ts vérifie que chaque `useTranslations` client y figure.
import type { AbstractIntlMessages } from 'next-intl';

export const CLIENT_NAMESPACES = [
  'common',
  'nav',
  'language',
  'theme',
  'errors',
  'status',
  'legal',
  'login',
  'signup',
  'forgot',
  'reset',
  'invite',
  'account',
  'userMenu',
  'roles',
  'team',
  'dashboard',
  'settings',
  'sectors',
  'plans',
  'customers',
  'publicQueue',
  'ticket',
  'tv',
  'admin',
] as const;

export function pickClientMessages(messages: AbstractIntlMessages): AbstractIntlMessages {
  return Object.fromEntries(CLIENT_NAMESPACES.filter((ns) => ns in messages).map((ns) => [ns, messages[ns]]));
}
