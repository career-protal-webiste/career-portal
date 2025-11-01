// components/Pagination.tsx
import React from 'react';

export default function Pagination({
  page, totalPages, onPage
}: { page: number; totalPages: number; onPage: (n:number)=>void }) {
  const max = 10;
  const start = Math.max(1, Math.min(page - 4, totalPages - (max - 1)));
  const end = Math.min(totalPages, start + (max - 1));
  const nums = Array.from({length: end - start + 1}, (_,i)=> start + i);

  return (
    <nav style={s.wrap}>
      <button style={s.btn} disabled={page<=1} onClick={()=>onPage(1)}>« First</button>
      <button style={s.btn} disabled={page<=1} onClick={()=>onPage(page-1)}>‹ Prev</button>

      {nums.map(n=>(
        <button key={n}
          style={n===page?s.numActive:s.num}
          disabled={n===page}
          onClick={()=>onPage(n)}
        >{n}</button>
      ))}

      <button style={s.btn} disabled={page>=totalPages} onClick={()=>onPage(page+1)}>Next ›</button>
      <button style={s.btn} disabled={page>=totalPages} onClick={()=>onPage(totalPages)}>Last »</button>
    </nav>
  );
}

const s:Record<string,any>={
  wrap:{maxWidth:1100, margin:'16px auto 40px', display:'flex', flexWrap:'wrap', gap:8, justifyContent:'center'},
  btn:{height:36, padding:'0 12px', borderRadius:10, background:'var(--panel-2)', color:'var(--text)', border:'1px solid var(--border)', cursor:'pointer'},
  num:{height:36, minWidth:36, padding:'0 10px', borderRadius:10, border:'1px solid var(--border)', background:'var(--panel-2)', color:'var(--text)', cursor:'pointer'},
  numActive:{height:36, minWidth:36, padding:'0 10px', borderRadius:10, border:`1px solid var(--brand)`, background:'var(--brand-2)', color:'#dfe6ff', fontWeight:700}
};
