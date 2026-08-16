import type { RetentionPolicy, RetentionAssignment, LegalHold, DispositionAction, LifecycleEvent } from './model.js';

export interface RetentionPolicyRepo {
  save(policy: RetentionPolicy): Promise<void>;
  get(id: string): Promise<RetentionPolicy | null>;
  list(): Promise<RetentionPolicy[]>;
}

export interface RetentionAssignmentRepo {
  save(assignment: RetentionAssignment): Promise<void>;
  getByDocId(docId: string): Promise<RetentionAssignment | null>;
  listByPolicyId(policyId: string): Promise<RetentionAssignment[]>;
  findDue(asOf: string): Promise<RetentionAssignment[]>;
}

export interface LegalHoldRepo {
  save(hold: LegalHold): Promise<void>;
  get(id: string): Promise<LegalHold | null>;
  findActiveForDoc(docId: string): Promise<LegalHold[]>;
  findByMatter(matter: string): Promise<LegalHold[]>;
}

export interface LifecycleEventRepo {
  append(event: LifecycleEvent): Promise<void>;
  listByDoc(docId: string): Promise<LifecycleEvent[]>;
}

export interface DispositionRepo {
  save(action: DispositionAction): Promise<void>;
  findPending(): Promise<DispositionAction[]>;
  markExecuted(id: string, executedBy: string, executedAt: string): Promise<void>;
}
