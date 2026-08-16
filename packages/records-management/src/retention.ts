import type { RetentionAssignment, DispositionAction } from './model.js';
import type { RetentionPolicyRepo, RetentionAssignmentRepo, DispositionRepo } from './ports.js';
import { isDocumentHeld, type LegalHoldDeps } from './legalHold.js';
import { transitionState, type LifecycleDeps } from './lifecycle.js';

export interface RetentionDeps extends LegalHoldDeps, LifecycleDeps {
  retentionPolicyRepo: RetentionPolicyRepo;
  retentionAssignmentRepo: RetentionAssignmentRepo;
  dispositionRepo: DispositionRepo;
}

export async function assignRetentionPolicy(
  docId: string,
  policyId: string,
  effectiveDate: string,
  deps: RetentionDeps
): Promise<RetentionAssignment> {
  const policy = await deps.retentionPolicyRepo.get(policyId);
  if (!policy) throw new Error(`Policy ${policyId} not found`);

  const effectDate = new Date(effectiveDate);
  const dueDate = new Date(effectDate.getTime() + policy.retentionPeriodDays * 24 * 60 * 60 * 1000);

  const assignment: RetentionAssignment = {
    docId,
    policyId,
    effectiveDate,
    dispositionDueDate: dueDate.toISOString(),
    state: 'active'
  };

  await deps.retentionAssignmentRepo.save(assignment);
  return assignment;
}

export async function checkDispositions(now: string, deps: RetentionDeps): Promise<DispositionAction[]> {
  const dueAssignments = await deps.retentionAssignmentRepo.findDue(now);
  const actions: DispositionAction[] = [];

  for (const assignment of dueAssignments) {
    const isHeld = await isDocumentHeld(assignment.docId, deps);
    if (isHeld) continue; // blocked by legal hold

    const policy = await deps.retentionPolicyRepo.get(assignment.policyId);
    if (!policy) continue;

    const action: DispositionAction = {
      id: deps.idProvider.newId(),
      docId: assignment.docId,
      policyId: assignment.policyId,
      actionType: policy.dispositionAction,
      scheduledAt: now,
    };
    
    await deps.dispositionRepo.save(action);
    actions.push(action);
  }

  return actions;
}

export async function executeDisposition(
  action: DispositionAction,
  actorId: string,
  deps: RetentionDeps
): Promise<void> {
  const isHeld = await isDocumentHeld(action.docId, deps);
  if (isHeld) throw new Error(`Cannot execute disposition: Document ${action.docId} is under legal hold`);

  let toState: 'archived' | 'disposed' = 'archived';
  if (action.actionType === 'delete') toState = 'disposed';
  
  const assignment = await deps.retentionAssignmentRepo.getByDocId(action.docId);
  const fromState = assignment ? assignment.state : 'active';

  if (action.actionType === 'delete' || action.actionType === 'archive') {
      await transitionState(action.docId, fromState, toState, `Disposition execution: ${action.actionType}`, actorId, deps);
  }

  if (assignment) {
      assignment.state = toState;
      await deps.retentionAssignmentRepo.save(assignment);
  }

  await deps.dispositionRepo.markExecuted(action.id, actorId, deps.clock.now().toISOString());
}
