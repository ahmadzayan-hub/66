import { describe, expect, it } from 'vitest';
import { assertIndependentEvaluator, makeArtifact, SeparationOfDutiesError } from '../kernel.js';
import { hasPermission, requirePermission, AccessDenied, Principal } from '../security/rbac.js';
import { ApprovalService, SelfApprovalError } from '../../features/approvals/approval-service.js';
import { AuditLog } from '../audit/audit-log.js';
import { ModelGateway, StubProvider, GatewayUnavailable, redactForProvider } from '../model-gateway/gateway.js';
import { MaterialRepository, seedMaterials, assertClaimAllowed, filterClaims, UnsupportedClaimError } from '../../features/materials/materials.js';

describe('separation of duties (rule 52.8)', () => {
  it('an agent can never evaluate an artifact it generated', () => {
    const artifact = makeArtifact('concept', ['agent-13-qa'], {});
    const qa = { agentId: 'agent-13-qa', capability: 'evaluate' as const };
    expect(() => assertIndependentEvaluator(qa, artifact)).toThrow(SeparationOfDutiesError);
    const other = { agentId: 'agent-02-brand-dna', capability: 'evaluate' as const };
    expect(() => assertIndependentEvaluator(other, artifact)).not.toThrow();
  });
});

describe('RBAC and approvals (§39, §42, §45)', () => {
  const designer: Principal = { userId: 'u-designer', roles: ['JEWELLERY_DESIGNER'], mfaEnrolled: false };
  const director: Principal = { userId: 'u-director', roles: ['DESIGN_DIRECTOR'], mfaEnrolled: true };
  const directorNoMfa: Principal = { userId: 'u-director2', roles: ['DESIGN_DIRECTOR'], mfaEnrolled: false };

  it('role permissions are least-privilege', () => {
    expect(hasPermission(designer, 'design.create')).toBe(true);
    expect(hasPermission(designer, 'design.approve')).toBe(false);
    expect(hasPermission(designer, 'production.release')).toBe(false);
    expect(() => requirePermission(designer, 'rules.engineering.change')).toThrow(AccessDenied);
  });

  it('privileged roles require MFA', () => {
    expect(hasPermission(director, 'design.approve')).toBe(true);
    expect(hasPermission(directorNoMfa, 'design.approve')).toBe(false);
  });

  it('submitter can never approve their own item', () => {
    const approvals = new ApprovalService(new AuditLog());
    expect(() =>
      approvals.decide('FINAL_DESIGN', 'ver_x', director.userId, director, 'APPROVED'),
    ).toThrow(SelfApprovalError);
  });

  it('non-approval decisions require a comment', () => {
    const approvals = new ApprovalService(new AuditLog());
    expect(() => approvals.decide('FINAL_DESIGN', 'ver_x', 'system', director, 'REJECTED')).toThrow(/comment/);
    const rec = approvals.decide('FINAL_DESIGN', 'ver_x', 'system', director, 'REJECTED', 'weak brand fit');
    expect(rec.decision).toBe('REJECTED');
  });
});

describe('model gateway (§36, §41, retry/fallback)', () => {
  it('redacts PII before anything leaves the boundary', () => {
    const redacted = redactForProvider('Customer khalid@example.com phone +971501234567 order_id:9912');
    expect(redacted).not.toContain('khalid@example.com');
    expect(redacted).not.toContain('+971501234567');
    expect(redacted).toContain('[REDACTED_EMAIL]');
  });

  it('never sends RESTRICTED_PRODUCTION data to providers', async () => {
    const gateway = new ModelGateway([new StubProvider()], new AuditLog());
    await expect(
      gateway.run({ task: 'reasoning', payloadClass: 'RESTRICTED_PRODUCTION', input: 'workshop params' }),
    ).rejects.toThrow(GatewayUnavailable);
  });

  it('fails over between providers and degrades to a typed failure (fail-safe §46)', async () => {
    const down = new StubProvider();
    down.setHealthy(false);
    const up = new StubProvider();
    up.name = 'stub-backup';
    const gateway = new ModelGateway([down, up], new AuditLog());
    const response = await gateway.run({ task: 'reasoning', payloadClass: 'INTERNAL', input: 'x' });
    expect(response.provider).toBe('stub-backup');

    up.setHealthy(false);
    await expect(gateway.run({ task: 'reasoning', payloadClass: 'INTERNAL', input: 'x' })).rejects.toThrow(
      GatewayUnavailable,
    );
  });
});

describe('material claim guard (§4, rule 52.6)', () => {
  it('rejects restricted claims without certification evidence', () => {
    const repo = new MaterialRepository();
    seedMaterials(repo);
    const silver = repo.get('MAT-925');
    expect(() => assertClaimAllowed(silver, 'hypoallergenic')).toThrow(UnsupportedClaimError);
    expect(() => assertClaimAllowed(silver, 'nickel-free finish')).toThrow(UnsupportedClaimError);
    expect(() => assertClaimAllowed(silver, '925 sterling silver')).not.toThrow();
  });

  it('allows restricted claims only with evidence, and filters copy accordingly', () => {
    const repo = new MaterialRepository();
    seedMaterials(repo);
    const silver = repo.get('MAT-925');
    silver.certificationEvidence['hypoallergenic'] = 'cert-asset-001';
    expect(() => assertClaimAllowed(silver, 'hypoallergenic')).not.toThrow();
    expect(filterClaims(silver, ['hypoallergenic', 'medical grade', 'handcrafted'])).toEqual([
      'hypoallergenic',
      'handcrafted',
    ]);
  });
});
