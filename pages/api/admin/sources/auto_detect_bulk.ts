// pages/api/admin/sources/auto_detect_bulk.ts
import type { NextApiRequest, NextApiResponse } from 'next';

// ⬇️ Keep these import paths the same as in your project.
// If your repo uses different paths, just swap them to your originals.
import { detect } from '@/lib/ats/detect';          // returns { type, token } for a given URL
import { addSource } from '@/lib/db/sources';       // inserts/updates a single ATS source { type, token, company_name }

// ---------- Types ----------
type InRow = {
  url: string;
  company_name?: string;
};

type OkResult = {
  url: string;
  company_name: string;
  ok: true;
  type: string;
  token: string;
};

type ErrResult = {
  url: string;
  company_name: string;
  ok: false;
  error: string;
};

type OutResult = OkResult | ErrResult;

// ---------- Helpers ----------
function inferCompanyName(u: string): string {
  try {
    const host = new URL(u).hostname.replace(/^www\./, '');
    // take the first label (e.g. "stripe" from "stripe.com")
    return host.split('.')[0] || host;
  } catch {
    return 'Unknown';
  }
}

function normalizeBody(body: unknown): InRow[] {
  if (Array.isArray(body)) return body as InRow[];
  if (typeof body === 'object' && body !== null) return [body as InRow];
  // handle raw JSON string bodies if any
  if (typeof body === 'string') {
    try {
      const parsed = JSON.parse(body);
      return normalizeBody(parsed);
    } catch {
      return [];
    }
  }
  return [];
}

// ---------- Handler ----------
export default async function handler(req: NextApiRequest, res: NextApiResponse) {
  if (req.method !== 'POST') {
    res.setHeader('Allow', 'POST');
    return res.status(405).json({ ok: false, error: 'Method Not Allowed' });
  }

  // Optional simple admin key gate (keeps your existing pattern; safe if not set)
  const ADMIN_KEY = process.env.ADMIN_KEY || process.env.CRON_SECRET || '';
  const providedKey = String(req.query.key ?? req.headers['x-admin-key'] ?? '');
  if (ADMIN_KEY && providedKey !== ADMIN_KEY) {
    return res.status(401).json({ ok: false, error: 'Unauthorized: bad or missing key' });
  }

  const rows = normalizeBody(req.body);
  if (!rows.length) {
    return res.status(400).json({ ok: false, error: 'Body must be a JSON array or object with { url, company_name? }' });
  }

  const out: OutResult[] = [];

  for (const row of rows) {
    const url = String(row?.url ?? '').trim();
    const company_name = (row?.company_name ?? inferCompanyName(url)).trim();

    if (!url) {
      out.push({ url: '', company_name: company_name || 'Unknown', ok: false, error: 'missing url' });
      continue;
    }

    try {
      const { type, token } = detect(url);

      if (!type || !token) {
        out.push({ url, company_name, ok: false, error: 'not detected' });
        continue;
      }

      // 🚫 OLD (caused TS error):
      // await addSource({ type, token, company_name, active: true });

      // ✅ NEW: match the expected type { type, token, company_name }
      await addSource({ type, token, company_name });

      out.push({ url, company_name, ok: true, type: String(type), token });
    } catch (e: any) {
      out.push({
        url,
        company_name,
        ok: false,
        error: e?.message || 'unknown error'
      });
    }
  }

  return res.status(200).json({ ok: true, results: out });
}
