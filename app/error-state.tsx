'use client';

import { Home, ShieldX, Sparkles, TriangleAlert } from 'lucide-react';

export default function ErrorState({code,title,copy,retry}:{code:string;title:string;copy:string;retry?:()=>void}) {
  const Icon=code==='403'?ShieldX:TriangleAlert;
  return <main className="error-shell"><section className="error-card"><a className="auth-brand" href="/"><span className="brand-mark"><Sparkles size={18}/></span><strong>schwank</strong></a><div className="error-code">{code}</div><Icon size={30}/><h1>{title}</h1><p>{copy}</p><div className="error-actions">{retry&&<button className="primary-button" onClick={retry}>Try again</button>}<a className="secondary-button" href="/"><Home size={16}/>Go home</a></div></section></main>;
}
