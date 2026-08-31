'use client';
/* oxlint-disable next(no-html-link-for-pages) */

import { Home, ShieldX, Sparkles, TriangleAlert } from 'lucide-react';
import { useLanguage } from './i18n';

export default function ErrorState({code,title,copy,retry}:{code:string;title:string;copy:string;retry?:()=>void}) {
  const {language}=useLanguage();const Icon=code==='403'?ShieldX:TriangleAlert;
  const russian:Record<string,{title:string;copy:string}>={'401':{title:'Требуется вход',copy:'Войдите, чтобы открыть домашнее пространство.'},'403':{title:'Это останется личным',copy:'У вас нет доступа к этой записи.'},'404':{title:'Такой страницы нет',copy:'Возможно, адрес указан неверно или страница перемещена.'},'500':{title:'Что-то пошло не так',copy:'Ваши данные в безопасности. Попробуйте ещё раз или вернитесь на главную.'}};const localized=language==='ru'?russian[code]:undefined;
  return <main className="error-shell"><section className="error-card"><a className="auth-brand" href="/"><span className="brand-mark"><Sparkles size={18}/></span><strong>schwank</strong></a><div className="error-code">{code}</div><Icon size={30}/><h1>{localized?.title||title}</h1><p>{localized?.copy||copy}</p><div className="error-actions">{retry&&<button className="primary-button" onClick={retry}>{language==='ru'?'Попробовать снова':'Try again'}</button>}<a className="secondary-button" href="/"><Home size={16}/>{language==='ru'?'На главную':'Go home'}</a></div></section></main>;
}
