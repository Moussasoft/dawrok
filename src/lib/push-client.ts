'use client';
// Abonnement Web Push côté navigateur + notifications locales de secours.
import { apiFetch } from './api-client';

const VAPID_PUBLIC_KEY = process.env.NEXT_PUBLIC_VAPID_PUBLIC_KEY ?? '';

export function notificationsSupported(): boolean {
  return typeof window !== 'undefined' && 'Notification' in window;
}

/** Push serveur possible (clé VAPID + service worker + PushManager). */
export function pushSupported(): boolean {
  return (
    notificationsSupported() && !!VAPID_PUBLIC_KEY && 'serviceWorker' in navigator && 'PushManager' in window
  );
}

/** iPhone hors application installée : ni push ni notifications (Safari iOS ≥ 16.4 exige l'ajout à l'écran d'accueil). */
export function isIosWithoutPwa(): boolean {
  if (typeof window === 'undefined') return false;
  const ios = /iPad|iPhone|iPod/.test(navigator.userAgent);
  const standalone = window.matchMedia?.('(display-mode: standalone)').matches;
  return ios && !standalone;
}

function base64UrlToUint8Array(base64: string): Uint8Array {
  const padding = '='.repeat((4 - (base64.length % 4)) % 4);
  const raw = atob((base64 + padding).replace(/-/g, '+').replace(/_/g, '/'));
  return Uint8Array.from(raw, (c) => c.charCodeAt(0));
}

async function registerWorker(): Promise<ServiceWorkerRegistration | null> {
  if (!('serviceWorker' in navigator)) return null;
  try {
    await navigator.serviceWorker.register('/sw.js');
    return await navigator.serviceWorker.ready;
  } catch {
    return null;
  }
}

export type EnableResult = 'push' | 'local' | 'denied' | 'unsupported';

/**
 * Demande l'autorisation puis abonne le navigateur aux notifications du ticket.
 * « push » : le client est prévenu même écran verrouillé ; « local » : seulement page ouverte.
 */
export async function enableTicketNotifications(publicCode: string, locale: string): Promise<EnableResult> {
  if (!notificationsSupported()) return 'unsupported';
  const permission = await Notification.requestPermission();
  if (permission !== 'granted') return 'denied';
  const registration = await registerWorker();
  if (!registration || !pushSupported()) return 'local';
  try {
    const subscription =
      (await registration.pushManager.getSubscription()) ??
      (await registration.pushManager.subscribe({
        userVisibleOnly: true,
        applicationServerKey: base64UrlToUint8Array(VAPID_PUBLIC_KEY) as BufferSource,
      }));
    const res = await apiFetch('/api/push/subscribe', {
      method: 'POST',
      json: { publicCode, subscription: subscription.toJSON(), locale },
    });
    return res.ok ? 'push' : 'local';
  } catch {
    return 'local';
  }
}

/**
 * Navigateur déjà abonné (visite précédente) : l'abonnement serveur de l'ancien ticket a été
 * supprimé, il faut le rattacher au ticket courant avant d'afficher « notifications activées ».
 */
export async function syncExistingSubscription(publicCode: string, locale: string): Promise<'push' | 'local'> {
  try {
    const registration = await navigator.serviceWorker?.getRegistration();
    const subscription = await registration?.pushManager.getSubscription();
    if (!subscription || !pushSupported()) return 'local';
    const res = await apiFetch('/api/push/subscribe', {
      method: 'POST',
      json: { publicCode, subscription: subscription.toJSON(), locale },
    });
    return res.ok ? 'push' : 'local';
  } catch {
    return 'local';
  }
}

/** Notification locale (page ouverte en arrière-plan). Android exige de passer par le service worker. */
export async function showLocalNotification(title: string, body: string, tag: string) {
  if (!notificationsSupported() || Notification.permission !== 'granted') return;
  try {
    const registration = await navigator.serviceWorker?.getRegistration();
    if (registration) {
      await registration.showNotification(title, { body, tag, icon: '/icons/icon-192.png', badge: '/icons/badge-72.png' });
      return;
    }
  } catch {
    /* on tente l'API directe */
  }
  try {
    new Notification(title, { body, tag });
  } catch {
    /* non supporté dans ce contexte */
  }
}
