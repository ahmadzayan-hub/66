import { describe, expect, it } from 'vitest';
import handler from '../../../api/intent.js';

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

describe('intent API (co-design understanding step)', () => {
  it('rejects non-POST methods', async () => {
    const { res, captured } = mockRes();
    await handler({ method: 'GET' }, res);
    expect(captured.code).toBe(405);
  });

  it('rejects empty and oversized text at the boundary', async () => {
    const a = mockRes();
    await handler({ method: 'POST', body: { text: '   ' } }, a.res);
    expect(a.captured.code).toBe(400);

    const b = mockRes();
    await handler({ method: 'POST', body: { text: 'x'.repeat(501) } }, b.res);
    expect(b.captured.code).toBe(400);

    const c = mockRes();
    await handler({ method: 'POST', body: {} }, c.res);
    expect(c.captured.code).toBe(400);
  });

  it('returns a structured brief for a natural Arabic request', async () => {
    const { res, captured } = mockRes();
    await handler({ method: 'POST', body: { text: 'عايزة إسورة فضة باسم خالد بالديواني بميزانية 250' } }, res);
    expect(captured.code).toBe(200);
    expect(captured.data.productType).toBe('bracelet');
    expect(captured.data.arabicText).toBe('خالد');
    expect(captured.data.calligraphyStyle).toBe('DIWANI');
    expect(captured.data.targetRetailPriceAed).toBe(250);
    expect(captured.headers['Cache-Control']).toBe('no-store');
  });
});
