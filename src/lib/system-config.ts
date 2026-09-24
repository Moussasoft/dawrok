import { prisma } from './db';

const NOTIFICATIONS_KEY = 'notifications';

export type NotificationsConfig = {
  newOrgSignup: boolean;
  orgSuspended: boolean;
  orgOverLimit: boolean;
  dailyReport: boolean;
  notifEmail: string;
};

export const DEFAULT_NOTIFICATIONS: NotificationsConfig = {
  newOrgSignup: true,
  orgSuspended: false,
  orgOverLimit: false,
  dailyReport: false,
  notifEmail: '',
};

export async function readNotificationsConfig(): Promise<NotificationsConfig> {
  const row = await prisma.systemConfig.findUnique({ where: { key: NOTIFICATIONS_KEY } });
  if (!row) return DEFAULT_NOTIFICATIONS;
  try {
    return { ...DEFAULT_NOTIFICATIONS, ...JSON.parse(row.value) };
  } catch {
    return DEFAULT_NOTIFICATIONS;
  }
}

export async function writeNotificationsConfig(patch: Partial<NotificationsConfig>): Promise<NotificationsConfig> {
  const merged = { ...(await readNotificationsConfig()), ...patch };
  await prisma.systemConfig.upsert({
    where: { key: NOTIFICATIONS_KEY },
    update: { value: JSON.stringify(merged) },
    create: { key: NOTIFICATIONS_KEY, value: JSON.stringify(merged) },
  });
  return merged;
}
