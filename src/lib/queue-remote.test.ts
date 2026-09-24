import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import RedisMock from 'ioredis-mock';
import type Redis from 'ioredis';
import { QueueHub, attachRemote, broadcastSnapshot } from './queue';
import { setRedisClientsForTesting } from './redis';
import type { DashboardSnapshot } from './queue-types';

function snapshot(branchId: string, updatedAt: string): DashboardSnapshot {
  return {
    branchId,
    branchName: 'Agence',
    orgName: 'Org',
    brandColor: '#6366F1',
    logoUrl: null,
    timezone: 'Africa/Casablanca',
    closedUntil: null,
    closureReason: null,
    isPaused: false,
    isOpenNow: true,
    nextOpening: null,
    updatedAt,
    activeEmployees: 1,
    tickets: [],
    stats: { total: 0, done: 0, noShow: 0, cancelled: 0, avgWaitMin: 0, avgServiceMin: 0 },
  };
}

const flush = () => new Promise((r) => setTimeout(r, 20));

describe('diffusion entre instances (Redis)', () => {
  const unsubs: (() => void)[] = [];
  beforeEach(() => setRedisClientsForTesting(null)); // hubs sans abonnement automatique
  afterEach(() => unsubs.splice(0).forEach((u) => u()));

  it('ignore une agence que personne ne suit sur cette instance', () => {
    const hub = new QueueHub();
    const listener = vi.fn();
    hub.receive(snapshot('b-none', '2026-09-24T10:00:00.000Z'));
    unsubs.push(hub.subscribe('b-other', listener));
    expect(listener).not.toHaveBeenCalled();
  });

  it('transmet un instantané plus récent aux connexions locales, ignore les plus anciens', () => {
    const hub = new QueueHub();
    const listener = vi.fn();
    unsubs.push(hub.subscribe('b1', listener));
    hub.receive(snapshot('b1', '2026-09-24T10:00:01.000Z'));
    hub.receive(snapshot('b1', '2026-09-24T10:00:00.000Z')); // plus ancien : ignoré
    hub.receive(snapshot('b1', '2026-09-24T10:00:01.000Z')); // identique : ignoré
    expect(listener).toHaveBeenCalledTimes(1);
  });

  it('un instantané publié par l’instance A arrive aux connexions de l’instance B', async () => {
    const cmd = new RedisMock() as unknown as Redis;
    const dup = () => (cmd as unknown as { duplicate(): Redis }).duplicate();
    const hubB = new QueueHub();
    attachRemote(hubB, { cmd: dup(), sub: dup() }, 'instance-B');
    const listener = vi.fn();
    unsubs.push(hubB.subscribe('b2', listener));
    await flush();

    broadcastSnapshot(snapshot('b2', '2026-09-24T11:00:00.000Z'), { cmd, sub: dup() }, 'instance-A');
    await flush();
    expect(listener).toHaveBeenCalledTimes(1);
    expect((listener.mock.calls[0][0] as DashboardSnapshot).updatedAt).toBe('2026-09-24T11:00:00.000Z');

    // Ses propres messages sont ignorés.
    broadcastSnapshot(snapshot('b2', '2026-09-24T12:00:00.000Z'), { cmd, sub: dup() }, 'instance-B');
    await flush();
    expect(listener).toHaveBeenCalledTimes(1);
  });
});
