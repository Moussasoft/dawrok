// URLs absolues localisées (e-mails, notifications, QR) : l'arabe, langue par défaut, n'a pas de préfixe.
import { routing } from '@/i18n/routing';

export function appBaseUrl(): string {
  return (process.env.NEXT_PUBLIC_APP_URL || 'http://localhost:3000').replace(/\/$/, '');
}

export function localizedPath(path: string, locale: string): string {
  const prefix = locale === routing.defaultLocale || !(routing.locales as readonly string[]).includes(locale) ? '' : `/${locale}`;
  return `${prefix}${path.startsWith('/') ? path : `/${path}`}`;
}

export function localizedUrl(path: string, locale: string): string {
  return `${appBaseUrl()}${localizedPath(path, locale)}`;
}
