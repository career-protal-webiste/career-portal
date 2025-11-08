// pages/cron-status.tsx
import useSWR from 'swr';

const fetcher = (u: string) => fetch(u).then((r) => r.json());

export default function CronStatus() {
  const { data } = useSWR('/api/cron/status', fetcher, { refreshInterval: 30_000 });

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
          {(data.rows || []).map((r: any) => (
            <tr key={r.source}>
              <td style={td}>{r.source}</td>
              <td style={td}>{new Date(r.last_run).toLocaleString()}</td>
              <td style={td}>{r.fetched_24h ?? 0}</td>
              <td style={td}>{r.inserted_24h ?? 0}</td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

const th: React.CSSProperties = { textAlign: 'left', borderBottom: '1px solid #ddd', padding: '8px' };
const td: React.CSSProperties = { borderBottom: '1px solid #eee', padding: '8px' };
