/**
 * Vercel serverless function: POST /api/intent
 * The "understand" step of the Co-Design Studio: free text in (Arabic /
 * English / mixed), structured design brief out. Deterministic parser —
 * see src/features/design-studio/intent-parser.ts.
 */
import { parseDesignIntent } from '../src/features/design-studio/intent-parser.js';

export default async function handler(req: { method?: string; body?: unknown }, res: {
  status: (code: number) => { json: (data: unknown) => void };
  setHeader: (k: string, v: string) => void;
}) {
  res.setHeader('Cache-Control', 'no-store');
  if (req.method !== 'POST') {
    res.status(405).json({ error: 'Method not allowed; POST { text }' });
    return;
  }
  const body = (typeof req.body === 'object' && req.body !== null ? req.body : {}) as { text?: unknown };
  if (typeof body.text !== 'string' || body.text.trim().length === 0) {
    res.status(400).json({ error: 'text must be a non-empty string' });
    return;
  }
  if (body.text.length > 500) {
    res.status(400).json({ error: 'text must be 500 characters or fewer' });
    return;
  }
  res.status(200).json(parseDesignIntent(body.text));
}
