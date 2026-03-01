// components/JobCard.tsx
import React from 'react';

export type Job = {
  company: string;
  title: string;
  source: string;
  url: string;
  location: string | null;
  when_time: string | null;
  experience_hint?: string | null;
  scraped_at?: string | null;
};

// ATS source badge colours
const chipBg: Record<string, string> = {
  greenhouse:      '#0f2c1a',
  ashby:           '#141c3a',
  lever:           '#1a1025',
  workable:        '#0f1f30',
  recruitee:       '#0f1f30',
  smartrecruiters: '#0d2217',
  workday:         '#0f1d32',
  remotive:        '#1a240f',
  adzuna:          '#2a1a0a',
};
const chipText: Record<string, string> = {
  greenhouse:      '#4ade80',
  ashby:           '#818cf8',
  lever:           '#c084fc',
  workable:        '#60a5fa',
  recruitee:       '#60a5fa',
  smartrecruiters: '#34d399',
  workday:         '#38bdf8',
  remotive:        '#86efac',
  adzuna:          '#fbbf24',
};

/** Friendly relative time: "2h ago", "3d ago", "just now" */
function relativeTime(iso: string | null | undefined): string {
  if (!iso) return '';
  const ms = Date.now() - new Date(iso).getTime();
  if (ms < 0) return 'just now';
  const mins = Math.floor(ms / 60_000);
  if (mins < 2)  return 'just now';
  if (mins < 60) return `${mins}m ago`;
  const hrs = Math.floor(mins / 60);
  if (hrs < 24)  return `${hrs}h ago`;
  const days = Math.floor(hrs / 24);
  if (days < 7)  return `${days}d ago`;
  const wks = Math.floor(days / 7);
  if (wks < 5)   return `${wks}w ago`;
  return new Date(iso).toLocaleDateString(undefined, { month: 'short', day: 'numeric' });
}

/** Colour-coded freshness for the timestamp */
function freshnessColor(iso: string | null | undefined): string {
  if (!iso) return 'var(--muted-2)';
  const hrs = (Date.now() - new Date(iso).getTime()) / 3_600_000;
  if (hrs < 6)  return '#10b981';
  if (hrs < 24) return '#34d399';
  if (hrs < 72) return '#fbbf24';
  return 'var(--muted-2)';
}

/** Experience badge */
function expBadge(hint: string | null | undefined): { label: string; bg: string; color: string } | null {
  if (!hint) return null;
  if (hint === 'intern')  return { label: 'Intern',   bg: '#083344', color: '#22d3ee' };
  if (hint === '0-2')     return { label: 'New Grad', bg: '#2e1065', color: '#c084fc' };
  if (hint === 'junior')  return { label: 'Junior',   bg: '#14532d', color: '#86efac' };
  if (hint === 'senior')  return { label: 'Senior',   bg: '#1c1917', color: '#9ca3af' };
  return null;
}

export default function JobCard({ job }: { job: Job }) {
  const remote   = /remote/i.test(`${job.title} ${job.location ?? ''}`);
  const timeRef  = job.scraped_at || job.when_time;
  const badge    = expBadge(job.experience_hint);
  const srcColor = chipText[job.source] || '#a5b4fc';
  const srcBg    = chipBg[job.source]   || '#1c2438';

  return (
    <a
      href={job.url}
      target="_blank"
      rel="noreferrer"
      style={s.card}
      onMouseEnter={e => {
        const el = e.currentTarget as HTMLElement;
        el.style.borderColor = 'var(--border-bright)';
        el.style.background  = 'var(--panel-hover)';
        el.style.transform   = 'translateY(-1px)';
      }}
      onMouseLeave={e => {
        const el = e.currentTarget as HTMLElement;
        el.style.borderColor = 'var(--border)';
        el.style.background  = 'var(--panel)';
        el.style.transform   = 'translateY(0)';
      }}
    >
      {/* Row 1: title + ATS source chip */}
      <div style={s.top}>
        <span style={s.title}>{job.title || 'Untitled role'}</span>
        <span style={{ ...s.chip, background: srcBg, color: srcColor }}>{job.source}</span>
      </div>

      {/* Row 2: company · location · remote */}
      <div style={s.meta}>
        <span style={s.company}>{job.company}</span>
        {job.location ? <span style={s.dot}> · {job.location}</span> : null}
        {remote ? <span style={s.remote}> · Remote ✦</span> : null}
      </div>

      {/* Row 3: experience badge + freshness clock */}
      <div style={s.footer}>
        <div style={s.badges}>
          {badge && (
            <span style={{ ...s.badge, background: badge.bg, color: badge.color }}>
              {badge.label}
            </span>
          )}
        </div>
        <span style={{ ...s.time, color: freshnessColor(timeRef) }}>
          {relativeTime(timeRef)}
        </span>
      </div>
    </a>
  );
}

const s: Record<string, React.CSSProperties> = {
  card: {
    display:        'block',
    padding:        '14px 16px',
    borderRadius:   14,
    background:     'var(--panel)',
    border:         '1px solid var(--border)',
    textDecoration: 'none',
    color:          'inherit',
    transition:     'transform .1s ease, border-color .1s ease, background .1s ease',
    cursor:         'pointer',
  },
  top: {
    display:        'flex',
    alignItems:     'flex-start',
    justifyContent: 'space-between',
    gap:            12,
  },
  title: {
    fontSize:   15.5,
    fontWeight: 650,
    color:      '#e8ecff',
    lineHeight: 1.35,
    flex:       1,
  },
  chip: {
    fontSize:      11,
    fontWeight:    600,
    textTransform: 'capitalize',
    borderRadius:  999,
    padding:       '3px 8px',
    whiteSpace:    'nowrap',
    flexShrink:    0,
    letterSpacing: 0.3,
  },
  meta: {
    marginTop: 5,
    fontSize:  13.5,
    color:     'var(--muted)',
  },
  company: {
    fontWeight: 600,
    color:      '#c8d4f0',
  },
  dot: {
    color: 'var(--muted)',
  },
  remote: {
    color:      'var(--good)',
    fontWeight: 600,
  },
  footer: {
    marginTop:      8,
    display:        'flex',
    alignItems:     'center',
    justifyContent: 'space-between',
  },
  badges: {
    display: 'flex',
    gap:     6,
  },
  badge: {
    fontSize:      11,
    fontWeight:    600,
    borderRadius:  6,
    padding:       '2px 7px',
    letterSpacing: 0.2,
  },
  time: {
    fontSize:      12,
    fontWeight:    500,
    letterSpacing: 0.1,
  },
};
