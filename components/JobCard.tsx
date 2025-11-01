// components/JobCard.tsx
import React from 'react';

export type Job = {
  company: string;
  title: string;
  source: string;
  url: string;
  location: string | null;
  when_time: string | null;
};

const chipBg: Record<string,string> = {
  greenhouse:'#13301d',
  ashby:'#1b273a',
  lever:'#262326',
  workable:'#232a36',
  recruitee:'#232a36',
  smartrecruiters:'#183222',
  workday:'#17283d',
};

export default function JobCard({ job }: { job: Job }) {
  const remote = /remote/i.test(`${job.title} ${job.location ?? ''}`);
  return (
    <a href={job.url} target="_blank" rel="noreferrer" style={s.card}>
      <div style={s.top}>
        <div style={s.title}>{job.title || 'Untitled role'}</div>
        <span style={{
          ...s.chip,
          background: chipBg[job.source] || '#1c2230',
          borderColor:'#2c3a56'
        }}>
          {job.source}
        </span>
      </div>
      <div style={s.line}>
        <span style={s.company}>{job.company}</span>
        {job.location ? <span> • {job.location}</span> : null}
        {remote ? <span style={s.remote}> • Remote</span> : null}
      </div>
      <div style={s.time}>{job.when_time ? new Date(job.when_time).toLocaleString() : ''}</div>
    </a>
  );
}

const s: Record<string, any> = {
  card: {
    display:'block', padding:14, borderRadius:14,
    background:'var(--panel)', border:'1px solid var(--border)',
    textDecoration:'none', color:'inherit',
    transition:'transform .06s ease, border-color .06s ease, background .06s ease',
  },
  top:{display:'flex', alignItems:'center', justifyContent:'space-between', gap:12},
  title:{fontSize:16.5, fontWeight:650, color:'#f2f3f5'},
  line:{marginTop:4, fontSize:14.2, color:'var(--muted)'},
  time:{marginTop:2, fontSize:12.5, color:'var(--muted-2)'},
  chip:{
    fontSize:12, textTransform:'capitalize', borderRadius:999,
    padding:'4px 8px', color:'#dfe6ff', border:'1px solid var(--border)'
  },
  company:{fontWeight:600},
  remote:{color:'var(--good)', fontWeight:600}
};
