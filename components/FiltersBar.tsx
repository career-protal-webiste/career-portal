// components/FiltersBar.tsx
import React, { CSSProperties } from 'react';

export const ROLE_OPTIONS = [
  { key: 'software',      label: 'Software Eng' },
  { key: 'data_engineer', label: 'Data Eng' },
  { key: 'data_science',  label: 'Data Science / ML' },
  { key: 'devops',        label: 'DevOps / SRE' },
  { key: 'security',      label: 'Security' },
  { key: 'qa',            label: 'QA / SDET' },
  { key: 'analyst',       label: 'Analyst' },
  { key: 'product',       label: 'Product' },
];

export const EXP_OPTIONS = [
  { key: 'intern',   label: '🎓 Intern',  color: '#22d3ee', activeBg: '#083344' },
  { key: 'new_grad', label: '✨ New Grad', color: '#c084fc', activeBg: '#2e1065' },
  { key: 'junior',   label: 'Junior',      color: '#86efac', activeBg: '#14532d' },
];

export default function FiltersBar(props: {
  q: string;          setQ:         (v: string) => void;
  usOnly: boolean;    setUsOnly:    (v: boolean) => void;
  maxAgeDays: number; setMaxAgeDays:(n: number) => void;
  roles: string[];    setRoles:     (fn: (prev: string[]) => string[]) => void;
  exp: string;        setExp:       (v: string) => void;
  onApply: () => void;
  onReset: () => void;
  extraLink?: React.ReactNode;
}) {
  const { q, setQ, usOnly, setUsOnly, maxAgeDays, setMaxAgeDays,
          roles, setRoles, exp, setExp, onApply, onReset, extraLink } = props;

  const toggleRole = (k: string) =>
    setRoles(prev => prev.includes(k) ? prev.filter(x => x !== k) : [...prev, k]);

  return (
    <section style={s.filters}>
      {/* Search + controls row */}
      <div style={s.row}>
        <input
          placeholder="Search title, company or location…"
          value={q}
          onChange={e => setQ(e.target.value)}
          style={s.input}
          onKeyDown={e => { if (e.key === 'Enter') onApply(); }}
        />
        <label style={s.check}>
          <input type="checkbox" checked={usOnly} onChange={e => setUsOnly(e.target.checked)} />
          <span style={{ marginLeft: 7 }}>🇺🇸 US only</span>
        </label>
        <select
          value={maxAgeDays}
          onChange={e => setMaxAgeDays(parseInt(e.target.value, 10))}
          style={s.select}
        >
          <option value={365}>All (1 year)</option>
          <option value={1}>Last 24 hours</option>
          <option value={3}>Last 3 days</option>
          <option value={7}>Last 7 days</option>
          <option value={14}>Last 14 days</option>
          <option value={30}>Last 30 days</option>
          <option value={60}>Last 60 days</option>
        </select>
        <button onClick={onApply} style={s.apply}>Apply</button>
        <button onClick={onReset} style={s.reset}>Reset</button>
        {extraLink}
      </div>

      {/* Experience level row */}
      <div style={s.pillRow}>
        <span style={s.label}>Experience:</span>
        {EXP_OPTIONS.map(o => {
          const active = exp === o.key;
          return (
            <label
              key={o.key}
              onClick={() => setExp(active ? '' : o.key)}
              style={expPill(active, o.color, o.activeBg)}
            >
              {o.label}
            </label>
          );
        })}
      </div>

      {/* Role filter row */}
      <div style={s.pillRow}>
        <span style={s.label}>Role:</span>
        {ROLE_OPTIONS.map(r => (
          <label key={r.key} style={rolePill(roles.includes(r.key))}>
            <input
              type="checkbox"
              checked={roles.includes(r.key)}
              onChange={() => toggleRole(r.key)}
              style={{ display: 'none' }}
            />
            {r.label}
          </label>
        ))}
      </div>
    </section>
  );
}

const s: Record<string, CSSProperties> = {
  filters: { maxWidth: 1100, margin: '8px auto 12px' },
  row: { display: 'flex', gap: 10, alignItems: 'center', flexWrap: 'wrap', marginBottom: 10 },
  pillRow: { display: 'flex', flexWrap: 'wrap', gap: 7, alignItems: 'center', marginBottom: 8 },
  label: {
    fontSize: 11, color: 'var(--muted-2)', fontWeight: 600,
    letterSpacing: 0.6, textTransform: 'uppercase', marginRight: 2,
  },
  input: {
    flex: 1, minWidth: 240, height: 38, borderRadius: 10,
    border: '1px solid var(--border)', background: 'var(--panel-2)',
    color: '#fff', padding: '0 12px', fontSize: 14,
  },
  check: {
    display: 'flex', alignItems: 'center', fontSize: 14,
    color: 'var(--muted)', cursor: 'pointer', whiteSpace: 'nowrap',
  },
  select: {
    height: 38, borderRadius: 10, background: 'var(--panel-2)',
    color: '#fff', border: '1px solid var(--border)', padding: '0 10px', fontSize: 14,
  },
  apply: {
    height: 38, padding: '0 16px', borderRadius: 10, cursor: 'pointer',
    border: 'none', background: 'var(--brand)', color: '#fff', fontWeight: 600, fontSize: 14,
  },
  reset: {
    height: 38, padding: '0 12px', borderRadius: 10, cursor: 'pointer',
    border: '1px solid var(--border)', background: 'var(--panel-2)', color: 'var(--muted)', fontSize: 14,
  },
};

const expPill = (active: boolean, color: string, activeBg: string): CSSProperties => ({
  borderRadius: 999, padding: '5px 11px', fontSize: 13, cursor: 'pointer', userSelect: 'none',
  border: `1px solid ${active ? color : 'var(--border)'}`,
  background: active ? activeBg : 'var(--panel-2)',
  color: active ? color : 'var(--muted)',
  fontWeight: active ? 600 : 400,
  transition: 'all .1s ease',
});

const rolePill = (active: boolean): CSSProperties => ({
  borderRadius: 999, padding: '5px 11px', fontSize: 13, cursor: 'pointer', userSelect: 'none',
  border: `1px solid ${active ? 'var(--brand)' : 'var(--border)'}`,
  background: active ? 'var(--brand-2)' : 'var(--panel-2)',
  color: active ? 'var(--brand-light)' : 'var(--muted)',
  fontWeight: active ? 600 : 400,
  transition: 'all .1s ease',
});
