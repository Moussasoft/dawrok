// Plans d'abonnement : valeurs par défaut, lecture de la configuration superadmin
// et application des limites (jusqu'ici configurées mais jamais appliquées).
import { prisma } from './db';
import { ApiError } from './api';

export const PLANS = ['free', 'starter', 'pro', 'business'] as const;
export type Plan = (typeof PLANS)[number];

export type PlanLimits = {
  plan: string;
  price: number;
  maxBranches: number;
  maxEmployees: number;
  maxServices: number;
  allowBooking: boolean;
  allowAnalytics: boolean;
  allowCustomBrand: boolean;
  /** SMS / WhatsApp inclus par mois (0 = non inclus). */
  smsQuota: number;
};

export const PLAN_DEFAULTS: PlanLimits[] = [
  { plan: 'free', price: 0, maxBranches: 1, maxEmployees: 3, maxServices: 5, allowBooking: false, allowAnalytics: false, allowCustomBrand: false, smsQuota: 0 },
  { plan: 'starter', price: 19, maxBranches: 2, maxEmployees: 10, maxServices: 15, allowBooking: true, allowAnalytics: false, allowCustomBrand: false, smsQuota: 0 },
  { plan: 'pro', price: 49, maxBranches: 5, maxEmployees: 30, maxServices: 50, allowBooking: true, allowAnalytics: true, allowCustomBrand: false, smsQuota: 100 },
  { plan: 'business', price: 129, maxBranches: 20, maxEmployees: 200, maxServices: 200, allowBooking: true, allowAnalytics: true, allowCustomBrand: true, smsQuota: 500 },
];

/** Devise d'affichage des prix des plans. */
export const CURRENCY = '€';

export const DEFAULT_BRAND_COLOR = '#6366F1';

export function isPlan(value: string): value is Plan {
  return (PLANS as readonly string[]).includes(value);
}

let seeded = false;

/** Crée les lignes de configuration manquantes (sans écraser les valeurs éditées). */
export async function ensurePlanConfigs(): Promise<void> {
  if (seeded) return;
  for (const d of PLAN_DEFAULTS) {
    await prisma.planConfig.upsert({ where: { plan: d.plan }, update: {}, create: d });
  }
  seeded = true;
}

export async function getAllPlanLimits(): Promise<PlanLimits[]> {
  await ensurePlanConfigs();
  const rows = await prisma.planConfig.findMany();
  return PLANS.map((p) => rows.find((r) => r.plan === p) ?? PLAN_DEFAULTS.find((d) => d.plan === p)!);
}

export async function getPlanLimits(plan: string): Promise<PlanLimits> {
  await ensurePlanConfigs();
  const row = await prisma.planConfig.findUnique({ where: { plan } });
  return row ?? PLAN_DEFAULTS.find((d) => d.plan === plan) ?? PLAN_DEFAULTS[0];
}

export async function getOrgLimits(orgId: string): Promise<PlanLimits> {
  const org = await prisma.organization.findUnique({ where: { id: orgId }, select: { plan: true } });
  return getPlanLimits(org?.plan ?? 'free');
}

type Resource = 'branches' | 'employees' | 'services';

/**
 * Ressources ACTIVES de l'organisation : un employé ou une prestation archivé (désactivé
 * parce qu'il a un historique) ne doit pas bloquer son remplacement.
 */
export async function countOrgResources(orgId: string): Promise<Record<Resource, number>> {
  const [branches, employees, services] = await Promise.all([
    prisma.branch.count({ where: { orgId, active: true } }),
    prisma.employee.count({ where: { active: true, branch: { orgId } } }),
    prisma.service.count({ where: { active: true, branch: { orgId } } }),
  ]);
  return { branches, employees, services };
}

const LIMIT_KEY: Record<Resource, 'maxBranches' | 'maxEmployees' | 'maxServices'> = {
  branches: 'maxBranches',
  employees: 'maxEmployees',
  services: 'maxServices',
};

/** Refuse la création (ou la réactivation) si l'organisation a atteint la limite de son offre. */
export async function assertCanAdd(orgId: string, resource: Resource): Promise<void> {
  const [limits, counts] = await Promise.all([getOrgLimits(orgId), countOrgResources(orgId)]);
  const max = limits[LIMIT_KEY[resource]];
  if (counts[resource] >= max) {
    throw new ApiError(403, `plan_limit_${resource}`, { limit: max, plan: limits.plan });
  }
}

type Feature = 'allowBooking' | 'allowAnalytics' | 'allowCustomBrand';

export async function assertFeature(orgId: string, feature: Feature): Promise<void> {
  const limits = await getOrgLimits(orgId);
  if (!limits[feature]) throw new ApiError(403, `plan_feature_${feature.replace('allow', '').toLowerCase()}`, { plan: limits.plan });
}
