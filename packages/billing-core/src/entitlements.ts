import type { BillingTier, TierLimits } from './model.js';
import { getPlan } from './plans.js';
import { getUsage } from './metering.js';
import type { SubscriptionRepo, UsageRepo, Clock } from './ports.js';

export interface EntitlementDependencies {
  subscriptionRepo: SubscriptionRepo;
  usageRepo: UsageRepo;
  clock: Clock;
}

export interface EntitlementCheck {
  allowed: boolean;
  reason?: string;
  limit?: number;
  current?: number;
}

function getCurrentPeriod(clock: Clock): string {
  const now = clock.now();
  return `${now.getUTCFullYear()}-${String(now.getUTCMonth() + 1).padStart(2, '0')}-01`;
}

/**
 * Retrieves the user's active tier, falling back to 'free'.
 */
async function getUserTier(userId: string, deps: EntitlementDependencies): Promise<BillingTier> {
  const sub = await deps.subscriptionRepo.findByUser(userId);
  if (!sub || sub.status !== 'active' && sub.status !== 'trialing') {
    return 'free';
  }
  return sub.tier;
}

/**
 * Generic check for an entitlement based on a limit key.
 */
export async function checkEntitlement(
  userId: string,
  feature: keyof TierLimits,
  metric: 'documents' | 'storage_bytes' | 'expiry_tracked' | 'contract_scans' | 'api_calls' | 'team_members' | 'workspaces' | 'none',
  deps: EntitlementDependencies
): Promise<EntitlementCheck> {
  const tier = await getUserTier(userId, deps);
  const plan = getPlan(tier);
  const limitValue = plan.limits[feature];
  
  if (typeof limitValue === 'boolean') {
    return limitValue
      ? { allowed: true }
      : { allowed: false, reason: `Feature ${feature} is not available on the ${tier} plan.` };
  }
  
  // Unlimited (-1)
  if (limitValue === -1) {
    return { allowed: true, limit: -1 };
  }
  
  if (metric === 'none') {
    return { allowed: true, limit: limitValue as number };
  }

  // Need to check current usage
  const period = getCurrentPeriod(deps.clock);
  const currentUsage = await getUsage(userId, metric as any, period, deps);

  const allowed = currentUsage < (limitValue as number);
  return allowed
    ? { allowed: true, limit: limitValue as number, current: currentUsage }
    : {
        allowed: false,
        limit: limitValue as number,
        current: currentUsage,
        reason: `Limit reached for ${feature} (${currentUsage}/${limitValue}) on the ${tier} plan.`,
      };
}

export async function canUploadDocument(userId: string, deps: EntitlementDependencies): Promise<EntitlementCheck> {
  return checkEntitlement(userId, 'maxDocuments', 'documents', deps);
}

export async function canTrackExpiry(userId: string, deps: EntitlementDependencies): Promise<EntitlementCheck> {
  return checkEntitlement(userId, 'maxExpiryTracked', 'expiry_tracked', deps);
}

export async function canRunContractScan(userId: string, deps: EntitlementDependencies): Promise<EntitlementCheck> {
  return checkEntitlement(userId, 'maxContractScansPerMonth', 'contract_scans', deps);
}

export async function canInviteTeamMember(userId: string, deps: EntitlementDependencies): Promise<EntitlementCheck> {
  return checkEntitlement(userId, 'maxTeamMembers', 'team_members', deps);
}

export async function canAccessApi(userId: string, deps: EntitlementDependencies): Promise<EntitlementCheck> {
  return checkEntitlement(userId, 'apiAccess', 'none', deps);
}

/**
 * Returns a prompt and suggested tier if a user tries to access a feature beyond their limits.
 */
export function getUpgradePrompt(feature: keyof TierLimits, currentTier: BillingTier): { suggestedTier: BillingTier; message: string } {
  // Simple heuristic for upgrade suggestions
  if (currentTier === 'free') {
    return {
      suggestedTier: 'personal',
      message: 'Upgrade to Personal for higher limits and more features.',
    };
  } else if (currentTier === 'personal') {
    return {
      suggestedTier: 'professional',
      message: 'Upgrade to Professional for team access and unlimited capacity.',
    };
  }
  
  return {
    suggestedTier: 'enterprise',
    message: 'Contact us for Enterprise options to unlock custom capabilities.',
  };
}
