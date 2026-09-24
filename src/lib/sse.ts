// Réponse Server-Sent Events avec heartbeat et nettoyage garanti à la déconnexion.
import type { NextRequest } from 'next/server';

type Send = (data: unknown) => void;
type Setup = (send: Send, close: () => void) => Promise<() => void> | (() => void);

export function sseResponse(req: NextRequest, setup: Setup): Response {
  const encoder = new TextEncoder();
  let closed = false;
  let teardown: (() => void) | null = null;
  let heartbeat: ReturnType<typeof setInterval> | null = null;
  let controllerRef: ReadableStreamDefaultController<Uint8Array> | null = null;

  function close() {
    if (closed) return;
    closed = true;
    if (heartbeat) clearInterval(heartbeat);
    teardown?.();
    try {
      controllerRef?.close();
    } catch {
      /* déjà fermé */
    }
  }

  function write(chunk: string) {
    if (closed || !controllerRef) return;
    try {
      controllerRef.enqueue(encoder.encode(chunk));
    } catch {
      close();
    }
  }

  const stream = new ReadableStream<Uint8Array>({
    async start(controller) {
      controllerRef = controller;
      req.signal.addEventListener('abort', close);
      write('retry: 3000\n\n');
      heartbeat = setInterval(() => write(': ping\n\n'), 25_000);
      try {
        const cleanup = await setup((data) => write(`data: ${JSON.stringify(data)}\n\n`), close);
        if (closed) cleanup();
        else teardown = cleanup;
      } catch (e) {
        console.error('[sse] initialisation échouée', e);
        close();
      }
    },
    cancel() {
      close();
    },
  });

  return new Response(stream, {
    headers: {
      'Content-Type': 'text/event-stream; charset=utf-8',
      'Cache-Control': 'no-cache, no-transform',
      Connection: 'keep-alive',
      'X-Accel-Buffering': 'no',
    },
  });
}
