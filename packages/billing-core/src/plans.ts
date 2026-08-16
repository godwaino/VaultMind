import type { BillingTier, PricingPlan, Currency, BillingCycle } from './model.js';

export const DEFAULT_PLANS: PricingPlan[] = [
  {
    id: 'plan_free',
    tier: 'free',
    name: 'Free',
    description: 'For individuals just getting started',
    prices: new Map<Currency, { monthly: number; annual: number }>([
      ['NGN', { monthly: 0, annual: 0 }],
      ['USD', { monthly: 0, annual: 0 }],
    ]),
    limits: {
      maxDocuments: 50,
      maxStorageBytes: 5 * 1024 * 1024 * 1024, // 5GB
      maxExpiryTracked: 5,
      maxContractScansPerMonth: 2,
      maxTeamMembers: 0,
      maxWorkspaces: 1,
      apiAccess: false,
      ssoEnabled: false,
      customRetentionPolicies: false,
      prioritySupport: false,
      whiteLabel: false,
    },
    features: ['Basic document storage', 'Up to 5 expiry tracking dates', '2 contract scans per month'],
    isActive: true,
    sortOrder: 1,
  },
  {
    id: 'plan_personal',
    tier: 'personal',
    name: 'Personal',
    description: 'For power users needing more capacity',
    prices: new Map<Currency, { monthly: number; annual: number }>([
      ['NGN', { monthly: 1500, annual: 15000 }],
      ['USD', { monthly: 3, annual: 30 }],
    ]),
    limits: {
      maxDocuments: 500,
      maxStorageBytes: 50 * 1024 * 1024 * 1024, // 50GB
      maxExpiryTracked: -1, // unlimited
      maxContractScansPerMonth: 50,
      maxTeamMembers: 0,
      maxWorkspaces: 1,
      apiAccess: false,
      ssoEnabled: false,
      customRetentionPolicies: false,
      prioritySupport: false,
      whiteLabel: false,
    },
    features: ['500 documents', 'Unlimited expiry tracking', '50 contract scans per month'],
    isActive: true,
    sortOrder: 2,
  },
  {
    id: 'plan_professional',
    tier: 'professional',
    name: 'Professional',
    description: 'For small teams and professionals',
    prices: new Map<Currency, { monthly: number; annual: number }>([
      ['NGN', { monthly: 3500, annual: 35000 }],
      ['USD', { monthly: 7, annual: 70 }],
    ]),
    limits: {
      maxDocuments: -1,
      maxStorageBytes: 200 * 1024 * 1024 * 1024, // 200GB
      maxExpiryTracked: -1,
      maxContractScansPerMonth: -1,
      maxTeamMembers: 5,
      maxWorkspaces: 3,
      apiAccess: true,
      ssoEnabled: false,
      customRetentionPolicies: false,
      prioritySupport: true,
      whiteLabel: false,
    },
    features: ['Unlimited documents', 'API access', 'Up to 5 team members', 'Priority support'],
    isActive: true,
    sortOrder: 3,
  },
  {
    id: 'plan_enterprise',
    tier: 'enterprise',
    name: 'Enterprise',
    description: 'For large organizations',
    prices: new Map<Currency, { monthly: number; annual: number }>(), // Custom pricing
    limits: {
      maxDocuments: -1,
      maxStorageBytes: -1,
      maxExpiryTracked: -1,
      maxContractScansPerMonth: -1,
      maxTeamMembers: -1,
      maxWorkspaces: -1,
      apiAccess: true,
      ssoEnabled: true,
      customRetentionPolicies: true,
      prioritySupport: true,
      whiteLabel: true,
    },
    features: ['Custom retention policies', 'SSO', 'White-labeling', 'Dedicated account manager'],
    isActive: true,
    sortOrder: 4,
  },
];

/**
 * Retrieves a pricing plan by tier.
 */
export function getPlan(tier: BillingTier): PricingPlan {
  const plan = DEFAULT_PLANS.find(p => p.tier === tier);
  if (!plan) throw new Error(`Plan not found for tier: ${tier}`);
  return plan;
}

/**
 * Retrieves the price for a tier in a given currency and cycle.
 */
export function getPrice(tier: BillingTier, currency: Currency, cycle: BillingCycle): number {
  const plan = getPlan(tier);
  const price = plan.prices.get(currency);
  if (!price) {
    if (tier === 'enterprise') return 0; // Custom
    throw new Error(`Pricing not defined for currency: ${currency} on tier: ${tier}`);
  }
  return cycle === 'monthly' ? price.monthly : price.annual;
}

/**
 * Compares two tiers for ordering (e.g. upgrades/downgrades).
 * Returns < 0 if a < b, > 0 if a > b, 0 if equal.
 */
export function compareTiers(a: BillingTier, b: BillingTier): number {
  const planA = getPlan(a);
  const planB = getPlan(b);
  return planA.sortOrder - planB.sortOrder;
}
