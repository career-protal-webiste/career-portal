// pages/index.tsx
import type { GetServerSideProps } from 'next';
import Link from 'next/link';
import { useMemo, useState } from 'react';
import { listJobs, type JobRow } from '../lib/queries';

type Props = { nowISO: string; jobs: JobRow[] };

export const getServerSideProps: GetServerSideProps<Props> = async () => {
  const jobs = await listJobs(500);
  return { props: { jobs, nowISO: new Date().toISOString() } };
};

/** ------------ helpers (no external deps) ------------ */
const US_STATES = [
  ['AL','Alabama'],['AK','Alaska'],['AZ','Arizona'],['AR','Arkansas'],['CA','California'],
  ['CO','Colorado'],['CT','Connecticut'],['DE','Delaware'],['FL','Florida'],['GA','Georgia'],
  ['HI','Hawaii'],['ID','Idaho'],['IL','Illinois'],['IN','Indiana'],['IA','Iowa'],
  ['KS','Kansas'],['KY','Kentucky'],['LA','Louisiana'],['ME','Maine'],['MD','Maryland'],
  ['MA','Massachusetts'],['MI','Michigan'],['MN','Minnesota'],['MS','Mississippi'],['MO','Missouri'],
  ['MT','Montana'],['NE','Nebraska'],['NV','Nevada'],['NH','New Hampshire'],['NJ','New Jersey'],
  ['NM','New Mexico'],['NY','New York'],['NC','North Carolina'],['ND','North Dakota'],['OH','Ohio'],
  ['OK','Oklahoma'],['OR','Oregon'],['PA','Pennsylvania'],['RI','Rhode Island'],['SC','South Carolina'],
  ['SD','South Dakota'],['TN','Tennessee'],['TX','Texas'],['UT','Utah'],['VT','Vermont'],
  ['VA','Virginia'],['WA','Washington'],['WV','West Virginia'],['WI','Wisconsin'],['WY','Wyoming'],
  ['DC','District of Columbia']
];
const STATE_SET = new Set(US_STATES.flatMap(([abbrev, name]) => [abbrev.toLowerCase(), name.toLowerCase()]));

function toDate(iso: string | null): Date | null {
  if (!iso) return null;
  const d = new Date(iso);
  return isNaN(d.getTime()) ? null : d;
}
function relativeTime(fromISO: string | null, nowISO: string): string {
  const from = toDate(fromISO) ?? toDate(nowISO)!;
  const now = new Date(nowISO);
  const diffMs = now.getTime() - from.getTime();
  const s = Math.max(0, Math.floor(diffMs / 1000));
  const m = Math.floor(s / 60);
  const h = Math.floor(m / 60);
  const d = Math.floor(h / 24);
  if (d > 0) return `${d} day${d > 1 ? 's' : ''} ago`;
  if (h > 0) return `${h} hour${h > 1 ? 's' : ''} ago`;
  if (m > 0) return `${m} minute${m > 1 ? 's' : ''} ago`;
  return 'just now';
}
function formatUTC(iso: string | null): string {
  if (!iso) return '';
  const d = new Date(iso);
  return `${d.toLocaleDateString('en-GB')} ${d.toLocaleTimeString('en-GB', { hour: '2-digit', minute: '2-digit' })} UTC`;
}
function money(min?: number | null, max?: number | null, currency?: string | null) {
  if (!currency || (min == null && max == null)) return null;
  const fmt = (v: number) => v.toLocaleString(undefined, { style: 'currency', currency });
  if (min != null && max != null) return `${fmt(min)}–${fmt(max)}`;
  if (min != null) return `${fmt(min)}+`;
  return fmt(max!);
}
function isRemote(v: JobRow['remote']): boolean {
  if (typeof v === 'boolean') return v;
  return typeof v === 'string' && /remote/i.test(v);
}
function locStr(job: JobRow): string {
  const l = (job.location ?? '').toLowerCase();
  if (!l && isRemote(job.remote)) return 'remote';
  return l;
}
function isUSA(job: JobRow): boolean {
  const l = locStr(job);
  if (!l) return false;
  if (/(united states|usa|us[^a-z]|^us$)/i.test(l)) return true;
  // remote - us
  if (/remote.*\bus\b/.test(l)) return true;
  // Has a state name/abbrev
  for (const [abbr, name] of US_STATES) {
    if (new RegExp(`\\b${abbr}\\b`, 'i').test(l)) return true;
    if (new RegExp(`\\b${name.toLowerCase()}\\b`, 'i').test(l)) return true;
  }
  return false;
}
function stateMatches(job: JobRow, want: string): boolean {
  if (want === 'all') return true;
  const l = locStr(job);
  const [abbr, name] = US_STATES.find(([a, n]) => a.toLowerCase() === want || n.toLowerCase() === want) ?? [];
  if (!abbr) return false;
  return new RegExp(`\\b(${abbr}|${(name ?? '').toLowerCase()})\\b`, 'i').test(l);
}

/** Role buckets with synonyms / proxies */
const ROLE_BUCKETS: Record<string, RegExp[]> = {
  sde: [
    /\bsoftware\s+(engineer|developer)\b/i,
    /\bswe\b/i, /\bsde\b/i,
    /\b(full[-\s]?stack|backend|front[-\s]?end)\b.*\b(engineer|developer)\b/i,
    /\bqa\b/i, /\bsdet\b/i, /\btest(ing)?\b/i
  ],
  'data scientist': [
    /\bdata\s+scientist\b/i, /\bml\s+engineer\b/i, /\bmachine\s+learning\b/i,
    /\b(nlp|cv|llm)s?\b/i
  ],
  'data engineer': [
    /\bdata\s+engineer\b/i, /\betl\b/i, /\bpipeline(s)?\b/i, /\bdag\b/i,
    /\bwarehouse\b/i, /\bdbt\b/i, /\bairflow\b/i, /\bspark\b/i
  ],
  analyst: [
    /\b(data|business)\s+analyst\b/i, /\banalytics?\b/i, /\bbi\b/i, /\banalytics?\s+engineer\b/i
  ],
  'product manager': [/\bproduct\s+manager\b/i, /\bpm\b/i],
};

function matchesRoleBucket(job: JobRow, bucket: string): boolean {
  if (!bucket) return true;
  const hay = [job.title, job.category, job.experience_hint].filter(Boolean).join(' ');
  const regexes = ROLE_BUCKETS[bucket] ?? [];
  return regexes.some(r => r.test(hay));
}

/** Experience ≤5y gate */
function isAtMostFiveYears(job: JobRow): boolean {
  const h = (job.experience_hint ?? '').toLowerCase();
  if (!h) return true;
  if (/\b(intern|new grad|fresh(er)?|entry)\b/.test(h)) return true;
  if (/\b(senior|staff|principal|lead|architect)\b/.test(h)) return false;
  const years = [...h.matchAll(/(\d+)\s*\+?\s*year/i)].map(m => parseInt(m[1], 10));
  if (years.length === 0) return true; // unknown => allow
  const max = Math.max(...years);
  return max <= 5;
}

/** Expand certain query tokens into synonyms (so "sde" behaves well) */
function expandQueryTokens(q: string): RegExp[] {
  const toks = q.split(/\s+/).filter(Boolean);
  const regs: RegExp[] = [];
  for (const t of toks) {
    const lt = t.toLowerCase();
    if (lt === 'sde' || lt === 'swe' || lt === 'software') {
      regs.push(/\b(sde|swe|software\s+(engineer|developer)|full[-\s]?stack|backend|front[-\s]?end)\b/i);
      continue;
    }
    if (lt === 'qa' || lt === 'sdet') {
      regs.push(/\b(qa|sdet|test(ing)?)\b/i);
      continue;
    }
    if (lt === 'de' || lt === 'data' && regs.length === 0) {
      regs.push(/\b(data\s+engineer|etl|pipeline|airflow|dbt|spark)\b/i);
      continue;
    }
    regs.push(new RegExp(lt.replace(/[.*+?^${}()|[\]\\]/g, '\\$&'), 'i'));
  }
  return regs;
}

/** ------------ page ------------ */
type WindowOpt = '1h' | '24h' | '72h' | 'all';
type RemoteOpt = 'any' | 'remote' | 'onsite';

export default function Home({ jobs, nowISO }: Props) {
  const [query, setQuery] = useState('');
  const [bucket, setBucket] = useState<string>('');               // role bucket
  const [win, setWin] = useState<WindowOpt>('all');               // recency
  const [usaOnly, setUsaOnly] = useState<boolean>(true);          // USA focus (default ON)
  const [remote, setRemote] = useState<RemoteOpt>('any');         // remote/onsite
  const [state, setState] = useState<string>('all');              // US state
  const [lte5y, setLte5y] = useState<boolean>(true);              // ≤5 years experience

  const filtered = useMemo(() => {
    const regs = expandQueryTokens(query.trim().toLowerCase());

    const within = (postedISO: string | null) => {
      if (win === 'all') return true;
      const posted = toDate(postedISO);
      if (!posted) return false;
      const now = new Date(nowISO);
      const diffHrs = (now.getTime() - posted.getTime()) / 36e5;
      return win === '1h' ? diffHrs <= 1
           : win === '24h' ? diffHrs <= 24
           : diffHrs <= 72;
    };

    return jobs.filter(j => {
      const postedISO = j.posted_at ?? j.scraped_at;
      if (!within(postedISO)) return false;

      if (usaOnly && !isUSA(j)) return false;
      if (state !== 'all' && !stateMatches(j, state)) return false;

      if (remote === 'remote' && !isRemote(j.remote)) return false;
      if (remote === 'onsite' && isRemote(j.remote)) return false;

      if (lte5y && !isAtMostFiveYears(j)) return false;

      if (bucket && !matchesRoleBucket(j, bucket)) return false;

      if (regs.length) {
        const hay = [
          j.title, j.company, j.location, j.category,
          j.employment_type, j.experience_hint
        ].filter(Boolean).join(' ');
        if (!regs.every(r => r.test(hay))) return false;
      }
      return true;
    });
  }, [jobs, nowISO, query, bucket, win, usaOnly, remote, state, lte5y]);

  const roleChips = [
    { key: 'sde', label: 'SDE' },
    { key: 'data scientist', label: 'Data Scientist' },
    { key: 'data engineer', label: 'Data Engineer' },
    { key: 'analyst', label: 'Analyst' },
    { key: 'product manager', label: 'Product Manager' },
  ];

  return (
    <div className="container">
      <div className="kicker">Careers Portal</div>
      <h1 className="h1">Careers Portal</h1>
      <div className="subtle">Fresh postings automatically pulled from Lever &amp; Greenhouse.</div>

      {/* chips + search */}
      <div className="toolbar">
        <div className="chips">
          {roleChips.map(c => (
            <button
              key={c.key}
              className={`chip ${bucket === c.key ? 'active' : ''}`}
              onClick={() => setBucket(curr => (curr === c.key ? '' : c.key))}
              title={`Filter by ${c.label}`}
            >
              {c.label}
            </button>
          ))}
          <button className="chip clear" onClick={() => { setBucket(''); setQuery(''); }}>
            Clear filters
          </button>
        </div>

        <div style={{display:'flex', gap: 8}}>
          <input
            className="input"
            placeholder="Search title, company, or location…"
            value={query}
            onChange={e => setQuery(e.target.value)}
          />
        </div>
      </div>

      {/* recency + switches */}
      <div className="segment" style={{marginTop: 6, marginBottom: 8}}>
        <button className={win==='1h'?'active':''} onClick={() => setWin('1h')}>Last hour</button>
        <button className={win==='24h'?'active':''} onClick={() => setWin('24h')}>24 hours</button>
        <button className={win==='72h'?'active':''} onClick={() => setWin('72h')}>3 days</button>
        <button className={win==='all'?'active':''} onClick={() => setWin('all')}>All</button>
      </div>

      <div className="controls">
        <label className="check">
          <input type="checkbox" checked={usaOnly} onChange={e => setUsaOnly(e.target.checked)} />
          USA only
        </label>

        <div className="select">
          Remote:
          <select value={remote} onChange={e => setRemote(e.target.value as RemoteOpt)}>
            <option value="any">Any</option>
            <option value="remote">Remote only</option>
            <option value="onsite">On-site only</option>
          </select>
        </div>

        <div className="select">
          State:
          <select value={state} onChange={e => setState(e.target.value)}>
            <option value="all">All</option>
            {US_STATES.map(([abbr, name]) => (
              <option key={abbr} value={abbr.toLowerCase()}>{name}</option>
            ))}
          </select>
        </div>

        <label className="check">
          <input type="checkbox" checked={lte5y} onChange={e => setLte5y(e.target.checked)} />
          ≤ 5 years experience
        </label>
      </div>

      <div className="count">{filtered.length} open roles</div>

      <div className="grid">
        {filtered.map(job => {
          const postedISO = job.posted_at ?? job.scraped_at;
          const rel = relativeTime(postedISO, nowISO);
          const utc = formatUTC(postedISO);
          const isHot = (() => {
            const d = toDate(postedISO);
            if (!d) return false;
            const hrs = (new Date(nowISO).getTime() - d.getTime()) / 36e5;
            return hrs <= 1;
          })();
          const pay = money(job.salary_min ?? undefined, job.salary_max ?? undefined, job.currency ?? undefined);

          return (
            <article className="card" key={job.fingerprint}>
              <header>
                <strong>{job.company ?? 'Unknown'}</strong>
                <span className="dot" />
                <span>{job.location ?? (isRemote(job.remote) ? 'Remote' : '—')}</span>
              </header>

              <div className="title">{job.title ?? 'Untitled role'}</div>

              <div className="meta">
                <span>Posted {rel} ({utc})</span>
                {job.experience_hint ? <span>• {job.experience_hint}</span> : null}
                {job.category ? <span>• {job.category}</span> : null}
              </div>

              <div className="badges">
                {isHot && <span className="badge ctr">🔥 High CTR</span>}
                {pay && <span className="badge salary">💸 {pay}</span>}
                {isRemote(job.remote) && <span className="badge">🏡 Remote</span>}
                {job.employment_type && <span className="badge">{job.employment_type}</span>}
              </div>

              <div className="actions">
                <a className="btn primary" href={job.url} target="_blank" rel="noreferrer">Apply</a>
                <Link className="btn secondary" href={`/job/${encodeURIComponent(job.fingerprint)}`}>
                  Details
                </Link>
              </div>
            </article>
          );
        })}
      </div>

      <footer className="note">
        Note: Times are shown in UTC. Salary appears when the source provides it. “High CTR” highlights roles posted within the last hour.
      </footer>
    </div>
  );
}
