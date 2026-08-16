import { describe, it, expect, beforeEach } from 'vitest';
import { 
  InMemorySubscriptionRepo, 
  InMemoryUsageRepo, 
  TestClock 
} from './adapters.js';
import { 
  createSubscription, 
  cancelSubscription, 
  changeSubscriptionPlan 
} from './subscription.js';
import { 
  canUploadDocument, 
  canAccessApi, 
  getUpgradePrompt 
} from './entitlements.js';
import { 
  recordUsage, 
  getUtilization,
  isWithinLimit
} from './metering.js';
import { getPrice } from './plans.js';

describe('VaultMind Billing Core', () => {
  let clock: TestClock;
  let subscriptionRepo: InMemorySubscriptionRepo;
  let usageRepo: InMemoryUsageRepo;
  let deps: any;

  beforeEach(() => {
    clock = new TestClock(new Date('2026-08-16T12:00:00Z'));
    subscriptionRepo = new InMemorySubscriptionRepo();
    usageRepo = new InMemoryUsageRepo();
    deps = { clock, subscriptionRepo, usageRepo };
  });

  describe('Feature Gating & Limits', () => {
    it('Free tier correctly caps at 50 documents', async () => {
      // Default state with no subscription is free tier
      let check = await canUploadDocument('user1', deps);
      expect(check.allowed).toBe(true);
      expect(check.limit).toBe(50);
      
      // Simulate 50 docs used
      await recordUsage('user1', 'documents', 50, deps);
      
      check = await canUploadDocument('user1', deps);
      expect(check.allowed).toBe(false);
      expect(check.reason).toContain('Limit reached');
      
      const withinLimit = await isWithinLimit('user1', 'documents', deps);
      expect(withinLimit).toBe(false);
    });

    it('Upgrade from free to personal raises limits', async () => {
      // 50 documents used
      await recordUsage('user1', 'documents', 50, deps);
      
      // Upgrade to personal
      await createSubscription({
        id: 'sub_123',
        userId: 'user1',
        tier: 'personal',
        cycle: 'monthly',
        paymentProvider: 'paystack',
        externalSubscriptionId: 'ext_sub_123',
        externalCustomerId: 'ext_cus_123'
      }, deps);

      // Now limits are raised
      const check = await canUploadDocument('user1', deps);
      expect(check.allowed).toBe(true);
      expect(check.limit).toBe(500);
      
      const withinLimit = await isWithinLimit('user1', 'documents', deps);
      expect(withinLimit).toBe(true);
    });

    it('Feature gating blocks enterprise features on free tier', async () => {
      const check = await canAccessApi('user1', deps);
      expect(check.allowed).toBe(false);
      expect(check.reason).toBeDefined();
    });
  });

  describe('Usage Metering', () => {
    it('Usage metering increments and checks limits correctly', async () => {
      await recordUsage('user2', 'contract_scans', 1, deps);
      await recordUsage('user2', 'contract_scans', 1, deps);
      
      // Free limit is 2
      let check = await isWithinLimit('user2', 'contract_scans', deps);
      expect(check).toBe(false);
    });

    it('Utilization percentage calculations', async () => {
      await recordUsage('user3', 'documents', 25, deps);
      
      const utilization = await getUtilization('user3', deps);
      
      expect(utilization.documents.used).toBe(25);
      expect(utilization.documents.limit).toBe(50); // Free plan
      expect(utilization.documents.percentage).toBe(50);
      
      // Limits with 0 allowed
      expect(utilization.team_members.limit).toBe(0);
      expect(utilization.team_members.percentage).toBe(0);
    });
  });

  describe('Subscription Lifecycle', () => {
    it('Subscription lifecycle (create, activate, cancel)', async () => {
      const sub = await createSubscription({
        id: 'sub_456',
        userId: 'user4',
        tier: 'professional',
        cycle: 'annual',
        paymentProvider: 'stripe',
        externalSubscriptionId: 'ext_456',
        externalCustomerId: 'cus_456'
      }, deps);

      expect(sub.status).toBe('active');
      expect(sub.tier).toBe('professional');

      // Cancel
      const canceled = await cancelSubscription('sub_456', deps);
      expect(canceled.status).toBe('canceled');
      expect(canceled.canceledAt).toBeDefined();

      // Change Plan
      const newSub = await createSubscription({
        id: 'sub_789',
        userId: 'user4',
        tier: 'personal',
        cycle: 'monthly',
        paymentProvider: 'stripe',
        externalSubscriptionId: 'ext_789',
        externalCustomerId: 'cus_456'
      }, deps);
      
      const upgraded = await changeSubscriptionPlan('sub_789', 'professional', deps);
      expect(upgraded.tier).toBe('professional');
    });
  });

  describe('Pricing Calculations', () => {
    it('Pricing calculations for different currencies and cycles', () => {
      expect(getPrice('personal', 'NGN', 'monthly')).toBe(1500);
      expect(getPrice('personal', 'USD', 'annual')).toBe(30);
      expect(getPrice('professional', 'NGN', 'annual')).toBe(35000);
      expect(getPrice('enterprise', 'USD', 'monthly')).toBe(0); // Custom pricing
    });
  });

  describe('Upgrade Prompts', () => {
    it('Upgrade prompt suggestions', () => {
      const promptFree = getUpgradePrompt('apiAccess', 'free');
      expect(promptFree.suggestedTier).toBe('personal');
      
      const promptPersonal = getUpgradePrompt('apiAccess', 'personal');
      expect(promptPersonal.suggestedTier).toBe('professional');
    });
  });
});
