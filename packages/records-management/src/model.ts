/**
 * Core data models for enterprise records management.
 */

export type DocumentLifecycleState = 'draft' | 'active' | 'expiring' | 'archived' | 'disposed' | 'legal_hold';

export interface RetentionPolicy {
  id: string;
  name: string;
  description: string;
  categoryPattern: string; // which document categories it applies to
  retentionPeriodDays: number;
  dispositionAction: 'archive' | 'delete' | 'review';
  isActive: boolean;
  createdAt: string;
  updatedAt: string;
}

export interface RetentionAssignment {
  docId: string;
  policyId: string;
  effectiveDate: string;
  dispositionDueDate: string;
  state: DocumentLifecycleState;
}

export interface LegalHold {
  id: string;
  name: string;
  matter: string; // case reference
  scope: string; // document IDs or category filter
  holdType: 'litigation' | 'regulatory' | 'investigation';
  isActive: boolean;
  createdBy: string;
  createdAt: string;
  releasedAt?: string;
}

export interface DispositionAction {
  id: string;
  docId: string;
  policyId: string;
  actionType: 'archive' | 'delete' | 'review';
  scheduledAt: string;
  executedAt?: string;
  executedBy?: string;
  overrideReason?: string;
}

export interface LifecycleEvent {
  id: string;
  docId: string;
  fromState: DocumentLifecycleState | null;
  toState: DocumentLifecycleState;
  reason: string;
  actor: string;
  timestamp: string;
}

export interface ClassificationScheme {
  id: string;
  name: string;
  description: string;
  categories: any; // hierarchical tree structure for enterprise (defined in taxonomy.ts)
  isDefault: boolean;
}
