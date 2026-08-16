import type { UsageMetric } from './model.js';
import type { UsageRepo, Clock, SubscriptionRepo } from './ports.js';
import { getPlan } from './plans.js';

export interface MeteringDependencies {
  usageRepo: UsageRepo;
  clock: Clock;
  subscriptionRepo: SubscriptionRepo;
}

/**
 * Increments the usage counter for a given metric.
 */
export async function recordUsage(
  userId: string,
  metric: UsageMetric,
  count: number,
  deps: MeteringDependencies
): Promise<void> {
  const period = getCurrentPeriod(deps.clock);
  await deps.usageRepo.increment(userId, metric, period, count);
}

/**
 * Gets the current usage for a specific metric.
 */
export async function getUsage(
  userId: string,
  metric: UsageMetric,
  period: string,
  deps: { usageRepo: UsageRepo }
): Promise<number> {
  return await deps.usageRepo.get(userId, metric, period);
}

/**
 * Returns a summary of all usage for a given period.
 */
export async function getUsageSummary(
  userId: string,
  period: string,
  deps: { usageRepo: UsageRepo }
): Promise<Record<UsageMetric, number>> {
  const records = await deps.usageRepo.getForPeriod(userId, period);
  const summary: Record<UsageMetric, number> = {
    documents: 0,
    storage_bytes: 0,
    expiry_tracked: 0,
    contract_scans: 0,
    api_calls: 0,
    team_members: 0,
  };
  
  for (const record of records) {
    if (summary[record.metric] !== undefined) {
      summary[record.metric] = record.count;
    }
  }
  
  return summary;
}

/**
 * Checks if the user's current usage is strictly within limits.
 */
export async function isWithinLimit(
  userId: string,
  metric: UsageMetric,
  deps: MeteringDependencies
): Promise<boolean> {
  const tier = await getUserTier(userId, deps);
  const plan = getPlan(tier);
  const period = getCurrentPeriod(deps.clock);
  
  let limit: number;
  switch (metric) {
    case 'documents': limit = plan.limits.maxDocuments; break;
    case 'storage_bytes': limit = plan.limits.maxStorageBytes; break;
    case 'expiry_tracked': limit = plan.limits.maxExpiryTracked; break;
    case 'contract_scans': limit = plan.limits.maxContractScansPerMonth; break;
    case 'team_members': limit = plan.limits.maxTeamMembers; break;
    case 'api_calls': limit = plan.limits.apiAccess ? -1 : 0; break;
    default: return false;
  }

  if (limit === -1) return true;

  const current = await getUsage(userId, metric, period, deps);
  return current < limit;
}

export async function getUtilization(
  userId: string,
  deps: MeteringDependencies
): Promise<Record<UsageMetric, { used: number; limit: number; percentage: number }>> {
  const tier = await getUserTier(userId, deps);
  const plan = getPlan(tier);
  const period = getCurrentPeriod(deps.clock);
  const summary = await getUsageSummary(userId, period, deps);
  
  const limits: Record<UsageMetric, number> = {
    documents: plan.limits.maxDocuments,
    storage_bytes: plan.limits.maxStorageBytes,
    expiry_tracked: plan.limits.maxExpiryTracked,
    contract_scans: plan.limits.maxContractScansPerMonth,
    team_members: plan.limits.maxTeamMembers,
    api_calls: plan.limits.apiAccess ? -1 : 0,
  };
  
  const utilization = {} as Record<UsageMetric, { used: number; limit: number; percentage: number }>;
  
  for (const [key, used] of Object.entries(summary)) {
    const metric = key as UsageMetric;
    const limit = limits[metric];
    
    let percentage = 0;
    if (limit === -1) {
      percentage = 0;
    } else if (limit === 0) {
      percentage = used > 0 ? 100 : 0;
    } else {
      percentage = Math.min(100, (used / limit) * 100);
    }
    
    utilization[metric] = { used, limit, percentage };
  }
  
  return utilization;
}

function getCurrentPeriod(clock: Clock): string {
  const now = clock.now();
  return `${now.getUTCFullYear()}-${String(now.getUTCMonth() + 1).padStart(2, '0')}-01`;
}

async function getUserTier(userId: string, deps: Pick<MeteringDependencies, 'subscriptionRepo'>): Promise<import('./model.js').BillingTier> {
  const sub = await deps.subscriptionRepo.findByUser(userId);
  if (!sub || sub.status !== 'active' && sub.status !== 'trialing') {
    return 'free';
  }
  return sub.tier;
}
