import type { RetentionPolicy, RetentionAssignment, LegalHold, DispositionAction, LifecycleEvent } from './model.js';
import type { RetentionPolicyRepo, RetentionAssignmentRepo, LegalHoldRepo, LifecycleEventRepo, DispositionRepo } from './ports.js';

export class InMemoryRetentionPolicyRepo implements RetentionPolicyRepo {
  private map = new Map<string, RetentionPolicy>();
  async save(policy: RetentionPolicy): Promise<void> { this.map.set(policy.id, { ...policy }); }
  async get(id: string): Promise<RetentionPolicy | null> { const v = this.map.get(id); return v ? { ...v } : null; }
  async list(): Promise<RetentionPolicy[]> { return Array.from(this.map.values()); }
}

export class InMemoryRetentionAssignmentRepo implements RetentionAssignmentRepo {
  private map = new Map<string, RetentionAssignment>(); // docId as key
  async save(assignment: RetentionAssignment): Promise<void> { this.map.set(assignment.docId, { ...assignment }); }
  async getByDocId(docId: string): Promise<RetentionAssignment | null> { const v = this.map.get(docId); return v ? { ...v } : null; }
  async listByPolicyId(policyId: string): Promise<RetentionAssignment[]> { return Array.from(this.map.values()).filter(a => a.policyId === policyId); }
  async findDue(asOf: string): Promise<RetentionAssignment[]> {
    return Array.from(this.map.values()).filter(a => new Date(a.dispositionDueDate) <= new Date(asOf) && a.state !== 'disposed' && a.state !== 'archived');
  }
}

export class InMemoryLegalHoldRepo implements LegalHoldRepo {
  private map = new Map<string, LegalHold>();
  async save(hold: LegalHold): Promise<void> { this.map.set(hold.id, { ...hold }); }
  async get(id: string): Promise<LegalHold | null> { const v = this.map.get(id); return v ? { ...v } : null; }
  async findActiveForDoc(docId: string): Promise<LegalHold[]> {
    // simplified for tests: assuming scope is a comma-separated list of docIds or "*"
    return Array.from(this.map.values()).filter(h => h.isActive && (h.scope === '*' || h.scope.includes(docId)));
  }
  async findByMatter(matter: string): Promise<LegalHold[]> {
    return Array.from(this.map.values()).filter(h => h.matter === matter);
  }
}

export class InMemoryLifecycleEventRepo implements LifecycleEventRepo {
  private events: LifecycleEvent[] = [];
  async append(event: LifecycleEvent): Promise<void> { this.events.push({ ...event }); }
  async listByDoc(docId: string): Promise<LifecycleEvent[]> { return this.events.filter(e => e.docId === docId); }
}

export class InMemoryDispositionRepo implements DispositionRepo {
  private map = new Map<string, DispositionAction>();
  async save(action: DispositionAction): Promise<void> { this.map.set(action.id, { ...action }); }
  async findPending(): Promise<DispositionAction[]> { return Array.from(this.map.values()).filter(a => !a.executedAt); }
  async markExecuted(id: string, executedBy: string, executedAt: string): Promise<void> {
    const action = this.map.get(id);
    if (action) {
      action.executedBy = executedBy;
      action.executedAt = executedAt;
    }
  }
}
