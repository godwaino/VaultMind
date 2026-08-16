/**
 * Billing data models for the VaultMind SaaS transformation.
 * Pure domain representations of tiers, limits, subscriptions, and usage.
 */

export type BillingTier = 'free' | 'personal' | 'professional' | 'enterprise';
export type BillingCycle = 'monthly' | 'annual';
export type Currency = 'NGN' | 'USD' | 'GBP' | 'EUR' | 'KES' | 'GHS' | 'ZAR';

export interface TierLimits {
  /** Maximum number of documents. -1 for unlimited. */
  maxDocuments: number;
  /** Maximum storage in bytes. */
  maxStorageBytes: number;
  /** Maximum expiry dates tracked. -1 for unlimited. */
  maxExpiryTracked: number;
  /** Maximum contract scans per month. */
  maxContractScansPerMonth: number;
  /** Maximum team members allowed. 0 for individual tiers. */
  maxTeamMembers: number;
  /** Maximum workspaces allowed. */
  maxWorkspaces: number;
  /** Whether API access is permitted. */
  apiAccess: boolean;
  /** Whether SSO is enabled. */
  ssoEnabled: boolean;
  /** Whether custom retention policies can be configured. */
  customRetentionPolicies: boolean;
  /** Priority support access. */
  prioritySupport: boolean;
  /** White-labeling support. */
  whiteLabel: boolean;
}

export interface PricingPlan {
  id: string;
  tier: BillingTier;
  name: string;
  description: string;
  prices: Map<Currency, { monthly: number; annual: number }>;
  limits: TierLimits;
  features: string[];
  isActive: boolean;
  sortOrder: number;
}

export type SubscriptionStatus = 'active' | 'past_due' | 'canceled' | 'trialing' | 'paused';
export type PaymentProvider = 'paystack' | 'stripe';

export interface Subscription {
  id: string;
  userId: string;
  orgId?: string;
  planId: string;
  tier: BillingTier;
  cycle: BillingCycle;
  status: SubscriptionStatus;
  currentPeriodStart: Date;
  currentPeriodEnd: Date;
  trialEnd?: Date;
  paymentProvider: PaymentProvider;
  externalSubscriptionId: string;
  externalCustomerId: string;
  createdAt: Date;
  canceledAt?: Date;
}

export type UsageMetric = 'documents' | 'storage_bytes' | 'expiry_tracked' | 'contract_scans' | 'api_calls' | 'team_members';

export interface UsageRecord {
  userId: string;
  orgId?: string;
  metric: UsageMetric;
  /** ISO date string for month bucket (e.g., "2026-08-01") */
  period: string;
  count: number;
}

export type InvoiceStatus = 'draft' | 'open' | 'paid' | 'void' | 'uncollectible';

export interface Invoice {
  id: string;
  userId: string;
  orgId?: string;
  subscriptionId: string;
  amount: number;
  currency: Currency;
  status: InvoiceStatus;
  periodStart: Date;
  periodEnd: Date;
  paidAt?: Date;
  externalInvoiceId?: string;
}
