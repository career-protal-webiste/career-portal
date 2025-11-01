'use client';
import { useEffect, useState } from 'react';

type Item = { token:string; company_name:string };
type Group = { greenhouse:Item[]; lever:Item[]; ashby:Item[]; workable:Item[]; recruitee:Item[] };

export default function SourcesAdmin() {
  const [data, setData] = useState<Group | null>(null);
  const [type, setType] = useState('greenhouse');
  const [token, setToken] = useState('');
  const [company, setCompany] = useState('');

  const adminKey = typeof window !== 'undefined' ? localStorage.getItem('ADMIN_KEY') || '' : '';

  async function load() {
    const res = await fetch(`/api/admin/sources/list?key=${encodeURIComponent(adminKey)}`, { cache:'no-store' });
    const j = await res.json();
    setData(j.data);
  }
  useEffect(() => { load(); }, []);

  async function addOne() {
    await fetch('/api/admin/sources/add', {
      method:'POST',
      headers:{ 'Content-Type':'application/json', 'x-admin-key': adminKey },
      body: JSON.stringify({ type, token, company_name: company })
    });
    setToken(''); setCompany(''); load();
  }

  return (
    <div style={{fontFamily:'Inter, system-ui, Arial', background:'#0b0f13', color:'#e6edf3', minHeight:'100vh', padding:24}}>
      <h1 style={{fontSize:26, fontWeight:700}}>ATS Sources</h1>
      <p style={{opacity:.8, marginBottom:16}}>Add company boards/tokens once; crons will use them automatically.</p>

      <div style={{display:'flex', gap:8, marginBottom:16}}>
        <select value={type} onChange={e=>setType(e.target.value)} style={{padding:8, background:'#0f141b', color:'#e6edf3', border:'1px solid #2a3343', borderRadius:8}}>
          <option value="greenhouse">Greenhouse</option>
          <option value="lever">Lever</option>
          <option value="ashby">Ashby</option>
          <option value="workable">Workable</option>
          <option value="recruitee">Recruitee</option>
        </select>
        <input value={token} onChange={e=>setToken(e.target.value)} placeholder="token/subdomain/board"
               style={{padding:'8px 10px', background:'#0f141b', color:'#e6edf3', border:'1px solid #2a3343', borderRadius:8}} />
        <input value={company} onChange={e=>setCompany(e.target.value)} placeholder="Company name"
               style={{padding:'8px 10px', background:'#0f141b', color:'#e6edf3', border:'1px solid #2a3343', borderRadius:8}} />
        <button onClick={addOne} style={{padding:'8px 12px', borderRadius:8, background:'#2563eb', color:'#fff', border:'none'}}>Add</button>
      </div>

      <div style={{display:'grid', gridTemplateColumns:'repeat(auto-fit, minmax(240px, 1fr))', gap:12}}>
        {data && Object.entries(data).map(([t, arr]) => (
          <div key={t} style={{border:'1px solid #2a3343', borderRadius:12, padding:12, background:'#0f141b'}}>
            <h3 style={{margin:'6px 0 10px', fontSize:16, opacity:.9}}>{t}</h3>
            <div style={{display:'grid', gap:6}}>
              {(arr as Item[]).map((it, i) => (
                <div key={`${t}-${i}`} style={{opacity:.9}}>{it.company_name} <span style={{opacity:.6}}>({it.token})</span></div>
              ))}
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}
