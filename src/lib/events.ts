// Bus pub/sub en mémoire pour le SSE — une seule instance.
// En production multi-instance, remplacer par Redis pub/sub (Upstash).
type Listener = (data: unknown) => void;

class EventBus {
  private channels = new Map<string, Set<Listener>>();

  subscribe(channel: string, listener: Listener): () => void {
    let set = this.channels.get(channel);
    if (!set) {
      set = new Set();
      this.channels.set(channel, set);
    }
    set.add(listener);
    return () => {
      set!.delete(listener);
      if (set!.size === 0) this.channels.delete(channel);
    };
  }

  publish(channel: string, data: unknown) {
    const set = this.channels.get(channel);
    if (!set) return;
    for (const listener of set) {
      try {
        listener(data);
      } catch {
        /* un abonné défaillant ne doit pas bloquer les autres */
      }
    }
  }
}

const globalForBus = globalThis as unknown as { __bus?: EventBus };
export const bus: EventBus = globalForBus.__bus ?? (globalForBus.__bus = new EventBus());

export const channels = {
  branch: (branchId: string) => `branch:${branchId}`,
};
