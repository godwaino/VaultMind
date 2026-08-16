import type { Subscription, UsageRecord, Invoice, PricingPlan, BillingTier, UsageMetric } from './model.js';
import type { SubscriptionRepo, UsageRepo, InvoiceRepo, PlanRepo, Clock } from './ports.js';
import { DEFAULT_PLANS } from './plans.js';

export class TestClock implements Clock {
  constructor(public currentTime: Date = new Date()) {}
  now(): Date {
    return this.currentTime;
  }
}

export class InMemorySubscriptionRepo implements SubscriptionRepo {
  private subscriptions: Map<string, Subscription> = new Map();

  async create(subscription: Subscription): Promise<void> {
    this.subscriptions.set(subscription.id, { ...subscription });
  }
  async update(subscription: Subscription): Promise<void> {
    this.subscriptions.set(subscription.id, { ...subscription });
  }
  async getById(id: string): Promise<Subscription | null> {
    return this.subscriptions.get(id) || null;
  }
  async findByUser(userId: string): Promise<Subscription | null> {
    for (const sub of this.subscriptions.values()) {
      if (sub.userId === userId) return sub;
    }
    return null;
  }
  async findByOrg(orgId: string): Promise<Subscription | null> {
    for (const sub of this.subscriptions.values()) {
      if (sub.orgId === orgId) return sub;
    }
    return null;
  }
}

export class InMemoryUsageRepo implements UsageRepo {
  // key: `${userId}:${metric}:${period}`
  private usages: Map<string, UsageRecord> = new Map();

  private getKey(userId: string, metric: string, period: string): string {
    return `${userId}:${metric}:${period}`;
  }

  async increment(userId: string, metric: UsageMetric, period: string, amount: number): Promise<void> {
    const key = this.getKey(userId, metric, period);
    const existing = this.usages.get(key);
    if (existing) {
      existing.count += amount;
    } else {
      this.usages.set(key, { userId, metric, period, count: amount });
    }
  }

  async get(userId: string, metric: UsageMetric, period: string): Promise<number> {
    const key = this.getKey(userId, metric, period);
    return this.usages.get(key)?.count || 0;
  }

  async getForPeriod(userId: string, period: string): Promise<UsageRecord[]> {
    const results: UsageRecord[] = [];
    for (const record of this.usages.values()) {
      if (record.userId === userId && record.period === period) {
        results.push(record);
      }
    }
    return results;
  }

  async reset(userId: string, metric: UsageMetric, period: string): Promise<void> {
    const key = this.getKey(userId, metric, period);
    const existing = this.usages.get(key);
    if (existing) {
      existing.count = 0;
    }
  }
}

export class InMemoryInvoiceRepo implements InvoiceRepo {
  private invoices: Map<string, Invoice> = new Map();

  async create(invoice: Invoice): Promise<void> {
    this.invoices.set(invoice.id, { ...invoice });
  }
  async update(invoice: Invoice): Promise<void> {
    this.invoices.set(invoice.id, { ...invoice });
  }
  async getById(id: string): Promise<Invoice | null> {
    return this.invoices.get(id) || null;
  }
  async findByUser(userId: string): Promise<Invoice[]> {
    return Array.from(this.invoices.values()).filter(inv => inv.userId === userId);
  }
  async findBySubscription(subscriptionId: string): Promise<Invoice[]> {
    return Array.from(this.invoices.values()).filter(inv => inv.subscriptionId === subscriptionId);
  }
}

export class InMemoryPlanRepo implements PlanRepo {
  async getAll(): Promise<PricingPlan[]> {
    return DEFAULT_PLANS;
  }
  async getByTier(tier: BillingTier): Promise<PricingPlan | null> {
    return DEFAULT_PLANS.find(p => p.tier === tier) || null;
  }
  async getById(id: string): Promise<PricingPlan | null> {
    return DEFAULT_PLANS.find(p => p.id === id) || null;
  }
}
