import type { NextApiRequest, NextApiResponse } from 'next';
import { upsertJob } from '../../../lib/db';
import { createFingerprint, inferExperience, normalize } from '../../../lib/jobs';
import { recordCronHeartbeat } from '../../../lib/heartbeat';
import { roleMatchesWide } from '../../../lib/filters';
import { listSourcesByType } from '../../../lib/sources';

// Fallback seeds — popular US tech companies known to use Lever.
// Token = the company slug used in api.lever.co/v0/postings/{token}
const FALLBACK: { company: string; token: string }[] = [
  { company: 'Netflix',       token: 'netflix'      },
  { company: 'Brex',          token: 'brex'         },
  { company: 'Scale AI',      token: 'scaleai'      },
  { company: 'Amplitude',     token: 'amplitude'    },
  { company: 'Benchling',     token: 'benchling'    },
  { company: 'Grammarly',     token: 'grammarly'    },
  { company: 'Lattice',       token: 'lattice'      },
  { company: 'Rippling',      token: 'rippling'     },
  { company: 'Airtable',      token: 'airtable'     },
  { company: 'Cohere',        token: 'cohere'       },
  { company: 'Reddit',        token: 'reddit'       },
  { company: 'Waymo',         token: 'waymo'        },
  { company: 'Wealthfront',   token: 'wealthfront'  },
  { company: 'Figma',         token: 'figma'        },
  { company: 'Carta',         token: 'carta'        },
  { company: 'Checkr',        token: 'checkr'       },
  { company: 'Gusto',         token: 'gusto'        },
  { company: 'Faire',         token: 'faire'        },
  { company: 'Watershed',     token: 'watershed'    },
  { company: 'Roboflow',      token: 'roboflow'     },
];

type LeverJob = {
  id?: string;
  text?: string;
  hostedUrl?: string;
  categories?: {
    location?: string;
    team?: string;
    commitment?: string;
  };
  createdAt?: number;
  updatedAt?: number;
};

const isTrue = (v: any) => String(v ?? '').match(/^(1|true|yes)$/i) !== null;

export default async function handler(req: NextApiRequest, res: NextApiResponse) {
  const isVercelCron = !!req.headers['x-vercel-cron'];
  const incomingKey =
    (req.headers['x-cron-key'] as string) ||
    (req.headers['x-cron-secret'] as string) ||
    (req.query?.key as string) ||
    (req.query?.secret as string) ||
    '';
  if (!isVercelCron && process.env.CRON_SECRET && incomingKey !== process.env.CRON_SECRET) {
    return res.status(401).json({ ok: false, error: 'unauthorized' });
  }

  const FILTERED = isTrue((req.query as any)?.filtered);
  const debug    = isTrue((req.query as any)?.debug);

  const rows   = await listSourcesByType('lever');
  const TENANTS = rows.length
    ? rows.map(r => ({ company: r.company_name, token: r.token }))
    : FALLBACK;

  let fetched   = 0;
  let inserted  = 0;

  for (const t of TENANTS) {
    try {
      const url = `https://api.lever.co/v0/postings/${encodeURIComponent(t.token)}?mode=json`;
      const r   = await fetch(url, { headers: { accept: 'application/json' } });
      if (!r.ok) continue;
      const arr: LeverJob[] = await r.json();
      if (!Array.isArray(arr) || arr.length === 0) continue;

      for (const j of arr) {
        fetched++;
        const title    = (j.text || '').trim();
        const location = j.categories?.location || null;
        const urlJob   = j.hostedUrl || '';
        if (!title || !urlJob) continue;
        if (FILTERED && !roleMatchesWide(title)) continue;

        const fingerprint = createFingerprint(t.token, title, location ?? undefined, urlJob);

        await upsertJob({
          fingerprint,
          source: 'lever',
          source_id: j.id || null,
          company: t.company,
          title,
          location,
          remote: /remote/i.test(`${title} ${String(location)}`),
          employment_type: j.categories?.commitment || null,
          experience_hint: inferExperience(title, undefined),
          category: normalize(j.categories?.team || null),
          url: urlJob,
          posted_at: (j.updatedAt || j.createdAt) ? new Date((j.updatedAt || j.createdAt)!).toISOString() : null,
          scraped_at: new Date().toISOString(),
          description: null,
          salary_min: null,
          salary_max: null,
          currency: null,
          visa_tags: null,
        });
        inserted++;
      }
    } catch (e) {
      console.error('lever failed', t.token, e);
    }
  }

  if (debug) console.log(`[CRON] lever fetched=${fetched} inserted=${inserted} filtered=${FILTERED}`);

  try {
    await recordCronHeartbeat('lever', fetched, inserted);
  } catch (e) {
    console.error('[CRON] lever heartbeat failed', e);
  }

  return res.status(200).json({ fetched, inserted, tenants: TENANTS.length, filtered: FILTERED });
}
