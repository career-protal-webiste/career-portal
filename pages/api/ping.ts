import type { NextApiRequest, NextApiResponse } from 'next';

/**
 * Simple health‑check endpoint to verify API routes are enabled.
 * Visit /api/ping on your deployed site to see a JSON response.
 */
export default function handler(req: NextApiRequest, res: NextApiResponse) {
  res.status(200).json({ ok: true, time: new Date().toISOString() });
}
