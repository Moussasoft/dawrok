import { getLocale } from 'next-intl/server';
import { redirect } from './routing';

/** Redirection serveur qui conserve la langue courante (next/navigation la perdait). */
export async function redirectTo(href: string): Promise<never> {
  const locale = await getLocale();
  return redirect({ href, locale });
}
