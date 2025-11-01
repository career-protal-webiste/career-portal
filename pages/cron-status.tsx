// pages/cron-status.tsx
'use client';

import { useEffect, useState } from 'react';

type Entry = {
  source: string;
  fetched: number;
  inserted: number;
  ran_at: string;
  age_minutes: number;
  ok: boolean;
};

export default function CronStatusPage() {
  const [data, setData] = useState<{ entries: Entry[]; threshold_min: number } | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    (async () => {
      setLoading(true);
      const res = await fetch('/api/cron/status?threshold_min=120', { cache: 'no-store' });
      const json = await res.json();
      setData(json);
      setLoading(false);
    })();
  }, []);

  return (
    <div style={{fontFamily:'Inter, system-ui, Arial', background:'#0b0f13', color:'#e6edf3', minHeight:'100vh', padding:'24px'}}>
      <h1 style={{fontSize:28, fontWeight:700, marginBottom:8}}>Cron Status</h1>
      <p style={{opacity:.75, marginBottom:16}}>Green = ran within {data?.threshold_min ?? 120} minutes. Red = stale.</p>

      {loading && <div>Loading…</div>}
      {!loading && data && (
        <div style={{display:'grid', gap:10, maxWidth:700}}>
          {data.entries.map(e => (
            <div key={e.source} style={{display:'flex', justifyContent:'space-between', padding:'12px 14px', border:'1px solid #263041', borderRadius:12, background:'#0f141b'}}>
              <div style={{display:'flex', gap:10, alignItems:'center'}}>
                <span style={{
                  display:'inline-block',
                  width:10, height:10, borderRadius:999,
                  background: e.ok ? '#22c55e' : '#ef4444'
                }} />
                <strong style={{textTransform:'capitalize'}}>{e.source}</strong>
              </div>
              <div style={{opacity:.85, display:'flex', gap:14, flexWrap:'wrap'}}>
                <span>fetched: <b>{e.fetched}</b></span>
                <span>inserted: <b>{e.inserted}</b></span>
                <span>last: <b>{new Date(e.ran_at).toLocaleString()}</b></span>
                <span>age: <b>{e.age_minutes}m</b></span>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
