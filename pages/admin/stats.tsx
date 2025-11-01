// pages/admin/stats.tsx
import { useEffect, useState } from 'react';

type Row = {
  source: string;
  total_60d: number;
  last24h: number;
  last_run_at: string | null;
  last_fetched: number | null;
  last_inserted: number | null;
};

const PUB_KEY = process.env.NEXT_PUBLIC_ADMIN_KEY || '';

export default function AdminStats() {
  const [rows, setRows] = useState<Row[]>([]);
  const [loading, setLoading] = useState(false);
  const canRun = Boolean(PUB_KEY);

  const load = async () => {
    setLoading(true);
    try {
      const r = await fetch('/api/stats/sources');
      const j = await r.json();
      setRows(j.rows || []);
    } finally { setLoading(false); }
  };

  useEffect(() => { load(); }, []);

  const runCron = async (source: string) => {
    if (!canRun) return;
    await fetch(`/api/cron/${source}?debug=1&key=${PUB_KEY}`);
    await load();
  };

  return (
    <div style={{maxWidth:1000, margin:'24px auto', color:'#eaeaea'}}>
      <h1 style={{fontSize:24, marginBottom:12}}>Ingestion Stats (60 days)</h1>
      {!canRun && (
        <p style={{opacity:.8, margin:'6px 0 18px'}}>
          Tip: set <code>NEXT_PUBLIC_ADMIN_KEY</code> in Vercel to enable “Run now” buttons.
        </p>
      )}
      <button onClick={load} disabled={loading} style={btn()}>
        {loading ? 'Refreshing…' : 'Refresh'}
      </button>

      <table style={{width:'100%', marginTop:16, borderCollapse:'separate', borderSpacing:0}}>
        <thead>
          <tr style={trH()}>
            <th style={th()}>Source</th>
            <th style={th('right')}>Jobs (60d)</th>
            <th style={th('right')}>New (24h)</th>
            <th style={th()}>Last run</th>
            <th style={th('right')}>Fetched</th>
            <th style={th('right')}>Inserted</th>
            <th style={th('center')}>Run</th>
          </tr>
        </thead>
        <tbody>
          {rows.map(r=>(
            <tr key={r.source} style={tr()}>
              <td style={td()}>{r.source}</td>
              <td style={td('right')}>{r.total_60d}</td>
              <td style={td('right')}>{r.last24h}</td>
              <td style={td()}>{r.last_run_at ? new Date(r.last_run_at).toLocaleString() : '—'}</td>
              <td style={td('right')}>{r.last_fetched ?? '—'}</td>
              <td style={td('right')}>{r.last_inserted ?? '—'}</td>
              <td style={td('center')}>
                <button disabled={!canRun} onClick={()=>runCron(r.source)} style={btnSmall()}>
                  Run now
                </button>
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

const btn = (): React.CSSProperties => ({
  padding:'8px 14px', borderRadius:10, border:'1px solid #3b82f6', background:'#1f2937',
  color:'#fff', cursor:'pointer'
});
const btnSmall = (): React.CSSProperties => ({ ...btn(), padding:'6px 10px', fontSize:12 });

const trH = (): React.CSSProperties => ({ background:'#111827' });
const tr  = (): React.CSSProperties => ({ background:'#0b1220', borderBottom:'1px solid #1f2a44' });
const th = (align:'left'|'right'|'center'='left'): React.CSSProperties =>
  ({ textAlign:align, padding:'10px 12px', fontWeight:600, color:'#cbd5e1', borderBottom:'1px solid #1f2a44' });
const td = (align:'left'|'right'|'center'='left'): React.CSSProperties =>
  ({ textAlign:align, padding:'10px 12px', color:'#e5e7eb', borderBottom:'1px solid #0f172a' });
