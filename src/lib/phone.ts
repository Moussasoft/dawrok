// Numéros de téléphone : normalisation E.164 (formats marocains courants) pour l'envoi de SMS.
// Ce fichier ne doit importer aucun module serveur (il est aussi utilisé côté client).

/** Normalise en E.164 (+212612345678), ou null si le numéro n'est pas reconnu. */
export function toE164(raw: string | null | undefined): string | null {
  if (!raw) return null;
  let s = raw.trim().replace(/[\s.\-()/]/g, '');
  if (s.startsWith('00')) s = `+${s.slice(2)}`;
  if (s.startsWith('+')) {
    // « +212 0612… » : le 0 national en trop après l'indicatif.
    if (/^\+2120[5-7]\d{8}$/.test(s)) return `+212${s.slice(5)}`;
    return /^\+[1-9]\d{7,14}$/.test(s) ? s : null;
  }
  if (/^212[5-7]\d{8}$/.test(s)) return `+${s}`;
  if (/^0[5-7]\d{8}$/.test(s)) return `+212${s.slice(1)}`;
  if (/^[67]\d{8}$/.test(s)) return `+212${s}`;
  return null;
}

/** Peut recevoir un SMS : mobile marocain (06 / 07) ou numéro international. */
export function isTextable(e164: string | null): e164 is string {
  if (!e164) return false;
  if (e164.startsWith('+212')) return /^\+212[67]\d{8}$/.test(e164);
  return /^\+[1-9]\d{7,14}$/.test(e164);
}

/** Masque un numéro pour les journaux : +2126•••••78. */
export function maskPhone(e164: string): string {
  return e164.length > 6 ? `${e164.slice(0, 5)}${'•'.repeat(e164.length - 7)}${e164.slice(-2)}` : '•••';
}
