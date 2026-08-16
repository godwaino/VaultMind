import { describe, it, expect, beforeEach } from 'vitest';
import { assignRetentionPolicy, checkDispositions, executeDisposition } from './retention.js';
import { createLegalHold, releaseHold } from './legalHold.js';
import { transitionState, getLifecycleHistory } from './lifecycle.js';
import { flattenTaxonomy, findNode, isDescendantOf, ENTERPRISE_TAXONOMY } from './taxonomy.js';
import {
  InMemoryRetentionPolicyRepo,
  InMemoryRetentionAssignmentRepo,
  InMemoryLegalHoldRepo,
  InMemoryLifecycleEventRepo,
  InMemoryDispositionRepo,
} from './adapters.js';
import { sequentialIdProvider, fixedClock } from '@vaultmind/vault-core';

describe('Records Management', () => {
  let deps: any;

  beforeEach(() => {
    deps = {
      retentionPolicyRepo: new InMemoryRetentionPolicyRepo(),
      retentionAssignmentRepo: new InMemoryRetentionAssignmentRepo(),
      legalHoldRepo: new InMemoryLegalHoldRepo(),
      lifecycleEventRepo: new InMemoryLifecycleEventRepo(),
      dispositionRepo: new InMemoryDispositionRepo(),
      idProvider: sequentialIdProvider,
      clock: fixedClock(),
    };
  });

  describe('Retention', () => {
    it('computes correct due dates when assigning policy', async () => {
      await deps.retentionPolicyRepo.save({
        id: 'p1',
        name: 'Test Policy',
        description: 'Test',
        categoryPattern: '*',
        retentionPeriodDays: 30,
        dispositionAction: 'delete',
        isActive: true,
        createdAt: '2026-01-01T00:00:00.000Z',
        updatedAt: '2026-01-01T00:00:00.000Z',
      });

      const assignment = await assignRetentionPolicy('doc1', 'p1', '2026-01-01T00:00:00.000Z', deps);
      expect(assignment.dispositionDueDate).toBe('2026-01-31T00:00:00.000Z');
    });

    it('blocks disposition when document is under legal hold', async () => {
      await deps.retentionPolicyRepo.save({
        id: 'p1',
        retentionPeriodDays: 0,
        dispositionAction: 'delete',
      });
      await assignRetentionPolicy('doc1', 'p1', '2026-01-01T00:00:00.000Z', deps);

      await createLegalHold({ name: 'Hold 1', matter: 'Matter 1', scope: 'doc1', holdType: 'litigation', createdBy: 'user1' }, deps);

      const actions = await checkDispositions('2026-01-02T00:00:00.000Z', deps);
      expect(actions.length).toBe(0);

      // Now create a dummy action to see if executeDisposition is blocked
      const dummyAction = { id: 'a1', docId: 'doc1', policyId: 'p1', actionType: 'delete' as const, scheduledAt: '2026-01-02T00:00:00.000Z' };
      await expect(executeDisposition(dummyAction, 'user1', deps)).rejects.toThrow('Cannot execute disposition');
    });
  });

  describe('Lifecycle', () => {
    it('allows valid transitions and throws on invalid', async () => {
      const event = await transitionState('doc1', 'draft', 'active', 'Activated', 'user1', deps);
      expect(event.toState).toBe('active');

      await expect(transitionState('doc1', 'draft', 'archived', 'Archive', 'user1', deps)).rejects.toThrow('Invalid transition');
    });

    it('records lifecycle history correctly', async () => {
      await transitionState('doc1', 'draft', 'active', 'Activated', 'user1', deps);
      await transitionState('doc1', 'active', 'archived', 'Archived', 'user1', deps);
      const history = await getLifecycleHistory('doc1', deps);
      expect(history.length).toBe(2);
      expect(history[0]?.toState).toBe('active');
      expect(history[1]?.toState).toBe('archived');
    });
  });

  describe('Legal Hold', () => {
    it('creates and releases holds correctly', async () => {
      const hold = await createLegalHold({ name: 'Hold 1', matter: 'M1', scope: 'doc1', holdType: 'investigation', createdBy: 'user1' }, deps);
      let active = await deps.legalHoldRepo.findActiveForDoc('doc1');
      expect(active.length).toBe(1);

      await releaseHold(hold.id, deps);
      active = await deps.legalHoldRepo.findActiveForDoc('doc1');
      expect(active.length).toBe(0);
    });
  });

  describe('Taxonomy', () => {
    it('flattens taxonomy correctly', () => {
      const flat = flattenTaxonomy(ENTERPRISE_TAXONOMY);
      expect(flat.some(n => n.code === 'Contracts.Vendor')).toBe(true);
    });

    it('finds node correctly', () => {
      const node = findNode(ENTERPRISE_TAXONOMY, 'HR.OfferLetter');
      expect(node?.label).toBe('Offer Letter');
    });

    it('checks descendants correctly', () => {
      expect(isDescendantOf(ENTERPRISE_TAXONOMY, 'HR.OfferLetter', 'HR')).toBe(true);
      expect(isDescendantOf(ENTERPRISE_TAXONOMY, 'HR.OfferLetter', 'Contracts')).toBe(false);
    });
  });
});
