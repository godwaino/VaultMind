/**
 * Ports for the billing pipeline, enabling in-memory testing and isolated domain logic.
 */
import type { Subscription, UsageRecord, Invoice, PricingPlan, BillingTier, UsageMetric } from './model.js';

export interface Clock {
  now(): Date;
}

export interface SubscriptionRepo {
  create(subscription: Subscription): Promise<void>;
  update(subscription: Subscription): Promise<void>;
  getById(id: string): Promise<Subscription | null>;
  findByUser(userId: string): Promise<Subscription | null>;
  findByOrg(orgId: string): Promise<Subscription | null>;
}

export interface UsageRepo {
  increment(userId: string, metric: UsageMetric, period: string, amount: number): Promise<void>;
  get(userId: string, metric: UsageMetric, period: string): Promise<number>;
  getForPeriod(userId: string, period: string): Promise<UsageRecord[]>;
  reset(userId: string, metric: UsageMetric, period: string): Promise<void>;
}

export interface InvoiceRepo {
  create(invoice: Invoice): Promise<void>;
  update(invoice: Invoice): Promise<void>;
  getById(id: string): Promise<Invoice | null>;
  findByUser(userId: string): Promise<Invoice[]>;
  findBySubscription(subscriptionId: string): Promise<Invoice[]>;
}

export interface PlanRepo {
  getAll(): Promise<PricingPlan[]>;
  getByTier(tier: BillingTier): Promise<PricingPlan | null>;
  getById(id: string): Promise<PricingPlan | null>;
}
