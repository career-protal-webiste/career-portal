// pages/cron-status.tsx
'use client';

import { useEffect, useState } from 'react';

type Row = {
  source: string;
  last_run: string;
  fetched_24h: number | null;
  inserted_24h: number | null;
};

type ApiResp = {
  ok: boolean;
  rows?: Row[];
  error?: string;
};

const th: React.CSSProperties = { textAlign: 'left', borderBottom: '1px solid #ddd', padding: '8px' };
const td: React.CSS_PROPERTIES = { borderBottom: '1px solid #eee', padding: '8px' };

export default function CronStatus() {
  const [data, setData] = useState<ApiResp | null>(null);

  useEffect(() => {
    let mounted = true;
    async function load() {
      try {
        const res = await fetch('/api/cron/status');
        const json: ApiResp = await res.json();
        if (mounted) setData(json);
      } catch (e: any) {
        if (mounted) setData({ ok: false, error: e?.message || String(e) });
      }
    }
    load();
    const id = setInterval(load, 30_000);
    return () => {
      mounted = false;
      clearInterval(id);
    };
  }, []);

  if (!data) return <div style={{ padding: 24 }}>Loading…</div>;
  if (!data.ok) return <div style={{ padding: 24, color: 'crimson' }}>Error: {data.error}</div>;

  return (
    <div style={{ padding: 24, fontFamily: 'Inter, system-ui, sans-serif' }}>
      <h1 style={{ marginBottom: 16 }}>Cron Status (last 24h)</h1>
      <table style={{ borderCollapse: 'collapse', width: '100%' }}>
        <thead>
          <tr>
            <th style={th}>Source</th>
            <th style={th}>Last Run</th>
            <th style={th}>Fetched</th>
            <th style={th}>Inserted</th>
          </tr>
        </thead>
        <tbody>
          {(data.rows || []).map((r) => (
            <tr key={r.source}>
              <td style={td}>{r.source}</td>
              <td style={td}>{r.last_run ? new Date(r.last_run).toLocaleString() : 'n/a'}</td>
              <td style={td}>{r.fetched_24h ?? 0}</td>
              <td style={td}>{r.inserted_24h ?? 0}</td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}
