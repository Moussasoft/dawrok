import { getRequestConfig } from 'next-intl/server';
import { hasLocale } from 'next-intl';
import { routing } from './routing';
import { DEFAULT_TIMEZONE } from '@/lib/time';

export default getRequestConfig(async ({ requestLocale }) => {
  const requested = await requestLocale;
  const locale = hasLocale(routing.locales, requested) ? requested : routing.defaultLocale;

  return {
    locale,
    // Fuseau par défaut explicite : sinon serveur (UTC) et navigateur divergent à l'hydratation.
    timeZone: DEFAULT_TIMEZONE,
    messages: (await import(`../../messages/${locale}.json`)).default,
  };
});
