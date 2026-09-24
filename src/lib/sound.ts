'use client';
// Carillon partagé : un seul AudioContext pour toute la page (les navigateurs en limitent
// le nombre) ; il doit être « débloqué » par un geste de l'utilisateur (politique autoplay).

let ctx: AudioContext | null = null;

function getContext(): AudioContext | null {
  if (typeof window === 'undefined') return null;
  if (!ctx) {
    const Ctor =
      window.AudioContext ?? (window as unknown as { webkitAudioContext?: typeof AudioContext }).webkitAudioContext;
    if (!Ctor) return null;
    ctx = new Ctor();
  }
  return ctx;
}

/** À appeler dans un gestionnaire de clic/toucher. Renvoie true si le son est autorisé. */
export async function unlockAudio(): Promise<boolean> {
  const c = getContext();
  if (!c) return false;
  if (c.state === 'suspended') {
    try {
      await c.resume();
    } catch {
      return false;
    }
  }
  return c.state === 'running';
}

export function isAudioUnlocked(): boolean {
  return ctx?.state === 'running';
}

export function playChime({ volume = 0.3, repeats = 3, gap = 0.2 } = {}) {
  const c = getContext();
  if (!c || c.state !== 'running') return;
  const now = c.currentTime;
  for (let i = 0; i < repeats; i++) {
    const t = now + i * gap;
    const osc = c.createOscillator();
    const gain = c.createGain();
    osc.frequency.setValueAtTime(880, t);
    osc.frequency.exponentialRampToValueAtTime(1320, t + 0.14);
    gain.gain.setValueAtTime(0, t);
    gain.gain.linearRampToValueAtTime(volume, t + 0.03);
    gain.gain.exponentialRampToValueAtTime(0.001, t + 0.2);
    osc.connect(gain).connect(c.destination);
    osc.start(t);
    osc.stop(t + 0.22);
  }
}

export function vibrate(pattern: number[]) {
  try {
    navigator.vibrate?.(pattern);
  } catch {
    /* non supporté */
  }
}
