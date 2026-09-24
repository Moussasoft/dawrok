// Informations légales affichées dans la politique de confidentialité et les conditions d'utilisation.
import { DEFAULT_RETENTION_DAYS } from './retention-rules';

/** Date de dernière mise à jour des textes (à changer à chaque modification). */
export const LEGAL_UPDATED_AT = '2026-09-24';

export function legalInfo() {
  return {
    company: process.env.LEGAL_COMPANY_NAME || 'Daourak',
    email: process.env.LEGAL_CONTACT_EMAIL || 'contact@daourak.app',
    address: process.env.LEGAL_ADDRESS || null,
    /** Numéro de déclaration / d'autorisation CNDP, affiché s'il est renseigné. */
    cndp: process.env.CNDP_DECLARATION || null,
    retention: DEFAULT_RETENTION_DAYS,
  };
}
