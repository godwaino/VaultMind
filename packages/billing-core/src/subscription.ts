import type { Subscription, BillingTier, BillingCycle, PaymentProvider } from './model.js';
import type { SubscriptionRepo, Clock } from './ports.js';
import { getPlan } from './plans.js';

export interface SubscriptionDependencies {
  subscriptionRepo: SubscriptionRepo;
  clock: Clock;
}

export interface CreateSubscriptionInput {
  id: string;
  userId: string;
  orgId?: string;
  tier: BillingTier;
  cycle: BillingCycle;
  paymentProvider: PaymentProvider;
  externalSubscriptionId: string;
  externalCustomerId: string;
  trialDays?: number;
}

/**
 * Creates a new subscription.
 */
export async function createSubscription(
  input: CreateSubscriptionInput,
  deps: SubscriptionDependencies
): Promise<Subscription> {
  const plan = getPlan(input.tier);
  const now = deps.clock.now();
  
  let currentPeriodEnd = new Date(now);
  if (input.cycle === 'monthly') {
    currentPeriodEnd.setUTCMonth(currentPeriodEnd.getUTCMonth() + 1);
  } else {
    currentPeriodEnd.setUTCFullYear(currentPeriodEnd.getUTCFullYear() + 1);
  }

  let trialEnd: Date | undefined;
  let status: Subscription['status'] = 'active';

  if (input.trialDays && input.trialDays > 0) {
    trialEnd = new Date(now);
    trialEnd.setUTCDate(trialEnd.getUTCDate() + input.trialDays);
    currentPeriodEnd = new Date(trialEnd); // Delay billing until trial ends
    status = 'trialing';
  }

  const subscription: Subscription = {
    id: input.id,
    userId: input.userId,
    ...(input.orgId ? { orgId: input.orgId } : {}),
    planId: plan.id,
    tier: input.tier,
    cycle: input.cycle,
    status,
    currentPeriodStart: now,
    currentPeriodEnd,
    ...(trialEnd ? { trialEnd } : {}),
    paymentProvider: input.paymentProvider,
    externalSubscriptionId: input.externalSubscriptionId,
    externalCustomerId: input.externalCustomerId,
    createdAt: now,
  };

  await deps.subscriptionRepo.create(subscription);
  return subscription;
}

/**
 * Cancels a subscription immediately or sets it to not renew.
 */
export async function cancelSubscription(
  subscriptionId: string,
  deps: SubscriptionDependencies
): Promise<Subscription> {
  const sub = await deps.subscriptionRepo.getById(subscriptionId);
  if (!sub) throw new Error('Subscription not found');

  sub.status = 'canceled';
  sub.canceledAt = deps.clock.now();
  
  await deps.subscriptionRepo.update(sub);
  return sub;
}

/**
 * Changes a subscription to a new plan tier.
 */
export async function changeSubscriptionPlan(
  subscriptionId: string,
  newTier: BillingTier,
  deps: SubscriptionDependencies
): Promise<Subscription> {
  const sub = await deps.subscriptionRepo.getById(subscriptionId);
  if (!sub) throw new Error('Subscription not found');

  const newPlan = getPlan(newTier);
  sub.planId = newPlan.id;
  sub.tier = newTier;
  
  await deps.subscriptionRepo.update(sub);
  return sub;
}

/**
 * Checks if a subscription is active.
 */
export function isSubscriptionActive(sub: Subscription): boolean {
  return sub.status === 'active' || sub.status === 'trialing';
}

/**
 * Checks if a subscription is currently in a trial period.
 */
export function isTrialing(sub: Subscription): boolean {
  return sub.status === 'trialing';
}

/**
 * Calculates days until renewal. Returns 0 if already expired.
 */
export function daysUntilRenewal(sub: Subscription, now: Date): number {
  if (sub.status === 'canceled') return 0;
  
  const diffTime = sub.currentPeriodEnd.getTime() - now.getTime();
  if (diffTime <= 0) return 0;
  
  return Math.ceil(diffTime / (1000 * 60 * 60 * 24));
}
