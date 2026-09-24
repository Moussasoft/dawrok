'use client';
import { useEffect, useRef, useState } from 'react';

type Options = {
  /**
   * Couper la connexion quand l'onglet est masqué (économise une connexion HTTP/1.1).
   * À désactiver sur la page ticket : un onglet en arrière-plan doit continuer à recevoir
   * les mises à jour pour pouvoir notifier le client.
   */
  pauseWhenHidden?: boolean;
};

export function useEventSource<T>(url: string | null, { pauseWhenHidden = true }: Options = {}) {
  const [data, setData] = useState<T | null>(null);
  const [connected, setConnected] = useState(false);
  /** Le serveur a refusé la connexion (session expirée, ressource supprimée…). */
  const [failed, setFailed] = useState(false);
  const ref = useRef<EventSource | null>(null);

  useEffect(() => {
    if (!url) return;

    function connect() {
      ref.current?.close();
      const es = new EventSource(url!);
      ref.current = es;
      es.onopen = () => {
        setConnected(true);
        setFailed(false);
      };
      es.onerror = () => {
        setConnected(false);
        // CLOSED = le navigateur abandonne (réponse non-SSE, ex. 401/404) ; sinon il se reconnecte seul.
        if (es.readyState === EventSource.CLOSED) setFailed(true);
      };
      es.onmessage = (e) => {
        try {
          setData(JSON.parse(e.data) as T);
        } catch {
          /* message invalide ignoré */
        }
      };
    }

    function disconnect() {
      ref.current?.close();
      ref.current = null;
      setConnected(false);
    }

    function onVisibility() {
      if (document.hidden) {
        if (pauseWhenHidden) disconnect();
      } else if (!ref.current || ref.current.readyState === EventSource.CLOSED) {
        connect();
      }
    }

    connect();
    document.addEventListener('visibilitychange', onVisibility);
    return () => {
      document.removeEventListener('visibilitychange', onVisibility);
      disconnect();
    };
  }, [url, pauseWhenHidden]);

  return { data, connected, failed };
}
