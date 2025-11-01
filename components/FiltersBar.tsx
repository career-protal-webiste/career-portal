// components/FiltersBar.tsx
import React, { CSSProperties } from 'react';

export const ROLE_OPTIONS = [
  { key: 'software',      label: 'Software Eng' },
  { key: 'data_engineer', label: 'Data Engineer' },
  { key: 'data_science',  label: 'Data Science / ML' },
  { key: 'devops',        label: 'DevOps / SRE' },
  { key: 'security',      label: 'Security' },
  { key: 'qa',            label: 'QA / SDET' },
  { key: 'analyst',       label: 'Analyst' },
  { key: 'product',       label: 'Product' },
];

export default function FiltersBar(props: {
  q: string; setQ: (v:string)=>void;
  usOnly: boolean; setUsOnly:(v:boolean)=>void;
  maxAgeDays: number; setMaxAgeDays:(n:number)=>void;
  roles: string[]; setRoles:(fn:(prev:string[])=>string[])=>void;
  onApply: ()=>void; onReset: ()=>void;
  extraLink?: React.ReactNode;
}) {
  const { q, setQ, usOnly, setUsOnly, maxAgeDays, setMaxAgeDays, roles, setRoles, onApply, onReset, extraLink } = props;

  const toggleRole = (k: string) =>
    setRoles(prev => (prev.includes(k) ? prev.filter(x => x !== k) : [...prev, k]));

  return (
    <section style={s.filters}>
      <div style={s.row}>
        <input
          placeholder="Search title/company/location…"
          value={q}
          onChange={(e)=>setQ(e.target.value)}
          style={s.input}
          onKeyDown={(e)=>{ if (e.key==='Enter') onApply(); }}
        />
        <label style={s.check}>
          <input type="checkbox" checked={usOnly} onChange={e=>setUsOnly(e.target.checked)} />
          <span style={{marginLeft:8}}>US only</span>
        </label>
        <select value={maxAgeDays} onChange={(e)=>setMaxAgeDays(parseInt(e.target.value,10))} style={s.select}>
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
      <div style={s.roles}>
        {ROLE_OPTIONS.map(r=>(
          <label key={r.key} style={pill(roles.includes(r.key))}>
            <input type="checkbox" checked={roles.includes(r.key)} onChange={()=>toggleRole(r.key)} style={{display:'none'}}/>
            {r.label}
          </label>
        ))}
      </div>
    </section>
  );
}

const s:Record<string,any>={
  filters:{maxWidth:1100, margin:'8px auto 12px'},
  row:{display:'flex', gap:12, alignItems:'center', flexWrap:'wrap'},
  input:{
    flex:1, minWidth:260, height:38, borderRadius:10, border:'1px solid var(--border)',
    background:'var(--panel-2)', color:'#fff', padding:'0 12px'
  },
  check:{display:'flex', alignItems:'center', gap:0, fontSize:14, opacity:.95},
  select:{height:38, borderRadius:10, background:'var(--panel-2)', color:'#fff', border:'1px solid var(--border)', padding:'0 10px'},
  apply:{height:38, padding:'0 14px', borderRadius:10, cursor:'pointer', border:'1px solid var(--brand)', background:'var(--brand)', color:'#fff', fontWeight:600},
  reset:{height:38, padding:'0 12px', borderRadius:10, cursor:'pointer', border:'1px solid var(--border)', background:'var(--panel-2)', color:'#d8d8d8'},
  roles:{marginTop:10, display:'flex', flexWrap:'wrap', gap:8}
};

// ✅ make TS happy by returning a typed CSSProperties and a literal for userSelect
const pill = (active:boolean): CSSProperties => ({
  borderRadius:999,
  padding:'6px 10px',
  fontSize:13,
  cursor:'pointer',
  userSelect:'none', // typed correctly now
  border:`1px solid ${active?'var(--brand)':'var(--border)'}`,
  background: active ? 'var(--brand-2)' : 'var(--panel-2)',
  color: active ? '#dfe6ff' : '#c8c8c8',
});
