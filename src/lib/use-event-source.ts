'use client';
import { useEffect, useRef, useState } from 'react';

export function useEventSource<T>(url: string | null) {
  const [data, setData] = useState<T | null>(null);
  const [connected, setConnected] = useState(false);
  const ref = useRef<EventSource | null>(null);

  useEffect(() => {
    if (!url) return;

    function connect() {
      ref.current?.close();
      const es = new EventSource(url!);
      ref.current = es;
      es.onopen = () => setConnected(true);
      es.onerror = () => setConnected(false);
      es.onmessage = (e) => {
        try {
          setData(JSON.parse(e.data) as T);
        } catch {
          /* ignore */
        }
      };
    }

    function disconnect() {
      ref.current?.close();
      ref.current = null;
      setConnected(false);
    }

    connect();

    // Libère la connexion SSE quand l'onglet est caché (limite HTTP/1.1 = 6 conn/domaine)
    // et la rétablit quand l'onglet redevient visible.
    function onVisibility() {
      if (document.hidden) {
        disconnect();
      } else {
        connect();
      }
    }

    document.addEventListener('visibilitychange', onVisibility);

    return () => {
      disconnect();
      document.removeEventListener('visibilitychange', onVisibility);
    };
  }, [url]);

  return { data, connected };
}
