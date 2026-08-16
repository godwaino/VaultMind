import type { LegalHold } from './model.js';
import type { LegalHoldRepo } from './ports.js';
import type { IdProvider, Clock } from '@vaultmind/vault-core';

export interface LegalHoldDeps {
  idProvider: IdProvider;
  clock: Clock;
  legalHoldRepo: LegalHoldRepo;
}

export async function createLegalHold(
  data: Omit<LegalHold, 'id' | 'isActive' | 'createdAt' | 'releasedAt'>, 
  deps: LegalHoldDeps
): Promise<LegalHold> {
  const hold: LegalHold = {
    ...data,
    id: deps.idProvider.newId(),
    isActive: true,
    createdAt: deps.clock.now().toISOString(),
  };

  await deps.legalHoldRepo.save(hold);
  return hold;
}

export async function releaseHold(holdId: string, deps: LegalHoldDeps): Promise<void> {
  const hold = await deps.legalHoldRepo.get(holdId);
  if (!hold) throw new Error(`Legal hold ${holdId} not found`);
  if (!hold.isActive) return;

  hold.isActive = false;
  hold.releasedAt = deps.clock.now().toISOString();
  await deps.legalHoldRepo.save(hold);
}

export async function getActiveHoldsForDocument(docId: string, deps: LegalHoldDeps): Promise<LegalHold[]> {
  // In a real implementation this would check if docId matches the hold scope.
  // Assuming the port method handles the exact logic (e.g. matching doc IDs or categories).
  return await deps.legalHoldRepo.findActiveForDoc(docId);
}

export async function isDocumentHeld(docId: string, deps: LegalHoldDeps): Promise<boolean> {
  const holds = await getActiveHoldsForDocument(docId, deps);
  return holds.length > 0;
}
