import type { DocumentLifecycleState, LifecycleEvent } from './model.js';
import type { LifecycleEventRepo } from './ports.js';
import type { IdProvider, Clock } from '@vaultmind/vault-core';

export const VALID_TRANSITIONS: Record<DocumentLifecycleState, DocumentLifecycleState[]> = {
  'draft': ['active', 'disposed'],
  'active': ['expiring', 'archived', 'legal_hold', 'disposed'],
  'expiring': ['active', 'archived', 'disposed'],
  'archived': ['active', 'legal_hold', 'disposed'],
  'legal_hold': ['active', 'archived', 'disposed'],
  'disposed': [] // terminal state
};

export interface LifecycleDeps {
  idProvider: IdProvider;
  clock: Clock;
  lifecycleEventRepo: LifecycleEventRepo;
}

export async function transitionState(
  docId: string, 
  fromState: DocumentLifecycleState, 
  toState: DocumentLifecycleState, 
  reason: string, 
  actorId: string, 
  deps: LifecycleDeps
): Promise<LifecycleEvent> {
  const allowed = VALID_TRANSITIONS[fromState] || [];
  if (!allowed.includes(toState)) {
    throw new Error(`Invalid transition from ${fromState} to ${toState}`);
  }

  const event: LifecycleEvent = {
    id: deps.idProvider.newId(),
    docId,
    fromState,
    toState,
    reason,
    actor: actorId,
    timestamp: deps.clock.now().toISOString()
  };

  await deps.lifecycleEventRepo.append(event);
  return event;
}

export async function getLifecycleHistory(docId: string, deps: LifecycleDeps): Promise<LifecycleEvent[]> {
  return await deps.lifecycleEventRepo.listByDoc(docId);
}
