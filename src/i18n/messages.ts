// Messages chargés statiquement, pour les traductions hors React (push, export CSV).
import fr from '../../messages/fr.json';
import en from '../../messages/en.json';
import ar from '../../messages/ar.json';
import { routing } from './routing';

export const MESSAGES = { fr, en, ar } as const;
export type AppLocale = keyof typeof MESSAGES;

export function toAppLocale(value: string | null | undefined): AppLocale {
  return value && (routing.locales as readonly string[]).includes(value) ? (value as AppLocale) : routing.defaultLocale;
}
