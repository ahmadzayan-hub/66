import { describe, expect, it } from 'vitest';
import handler, { runPipelineRequest, validateBody } from '../../../api/pipeline.js';

interface CapturedResponse {
  code?: number;
  data?: any;
  headers: Record<string, string>;
}

function mockRes(): { res: any; captured: CapturedResponse } {
  const captured: CapturedResponse = { headers: {} };
  const res = {
    setHeader: (k: string, v: string) => { captured.headers[k] = v; },
    status: (code: number) => ({ json: (data: unknown) => { captured.code = code; captured.data = data; } }),
  };
  return { res, captured };
}

describe('pipeline API (§39 input validation, live gate chain)', () => {
  it('rejects non-POST methods', async () => {
    const { res, captured } = mockRes();
    await handler({ method: 'GET' }, res);
    expect(captured.code).toBe(405);
  });

  it('validates inputs strictly at the boundary', () => {
    expect(validateBody({ targetRetailPriceAed: 10 })).toContain('targetRetailPriceAed');
    expect(validateBody({ requiredGrossMarginPct: 99 })).toContain('requiredGrossMarginPct');
    expect(validateBody({ family: 'PIRATES' as any })).toContain('family');
    expect(validateBody({ arabicText: 'خ'.repeat(61) })).toContain('60 characters');
    expect(validateBody({ calligraphyStyle: 'COMIC_SANS' as any })).toContain('calligraphyStyle');
    expect(validateBody({})).toBeNull();
  });

  it('returns 400 for invalid bodies without running the pipeline', async () => {
    const { res, captured } = mockRes();
    await handler({ method: 'POST', body: { targetRetailPriceAed: 1 } }, res);
    expect(captured.code).toBe(400);
  });

  it('runs the full chain and returns production files for a valid brief', async () => {
    const { res, captured } = mockRes();
    await handler({ method: 'POST', body: { arabicText: 'خالد', approveArabic: true } }, res);
    expect(captured.code).toBe(200);
    const d = captured.data;
    expect(d.blocked).toBe(false);
    expect(d.scores.readiness).toBeGreaterThanOrEqual(85);
    expect(d.production.svg).toContain('id="ENGRAVE"');
    expect(d.production.dxf).toContain('LWPOLYLINE');
    expect(d.currentState).toBe('PROTOTYPE_REQUESTED');
    expect(captured.headers['Cache-Control']).toBe('no-store');
  });

  it('blocks and returns no production files when the Arabic human gate is withheld', async () => {
    const data = await runPipelineRequest({ arabicText: 'خالد', approveArabic: false });
    expect(data.blocked).toBe(true);
    expect(data.production).toBeNull();
    expect(data.blockReasons.join(' ')).toContain('human approval');
  });

  it('blocks unsafe child configurations via the live API', async () => {
    const data = await runPipelineRequest({
      arabicText: 'خالد',
      family: 'BABIES_CHILDREN',
      isChildProduct: true,
      conceptName: 'Falaj Braid',
    });
    expect(data.blocked).toBe(true);
    expect(data.gates.safety.verdict).toBe('FAIL');
    expect(data.issues.some((i) => i.type === 'UNSAFE_BABY_PRODUCT')).toBe(true);
  });
});
