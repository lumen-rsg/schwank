'use client';

import { useEffect, useMemo, useState } from 'react';
import { ArrowRight, Check, CheckCircle2, ChevronDown, CircleDollarSign, ClipboardCheck, Flame, Home, ListTodo, LoaderCircle, MessageCircle, MoreHorizontal, Plus, Search, Send, ShoppingBasket, Sparkles, Utensils, WalletCards } from 'lucide-react';

type Member = { id:string; name:string; initials:string; color:string; calorieGoal:number; proteinGoal:number; carbGoal:number; fatGoal:number };
type Nutrition = { id:number; memberId:string; label:string; calories:number; protein:number; carbs:number; fat:number; eatenOn:string };
type Task = { id:number; title:string; status:string; assigneeId:string; tag:string; due:string };
type Expense = { id:number; label:string; amount:number; category:string; paidBy:string; spentOn:string };
type Organiser = { id:number; list:string; label:string; done:boolean|number };
type Message = { id:number; memberId:string; body:string; createdAt:string; name:string; initials:string; color:string };
type Data = { members:Member[]; nutrition:Nutrition[]; tasks:Task[]; expenses:Expense[]; organisers:Organiser[]; messages:Message[] };

const nav = [
  { label:'Overview', icon:Home }, { label:'Nutrition', icon:Utensils }, { label:'Tasks', icon:ListTodo },
  { label:'Spending', icon:WalletCards }, { label:'Organisers', icon:ClipboardCheck }, { label:'Chat', icon:MessageCircle },
];
const fallbackMembers:Member[] = [
  { id:'alex',name:'Alex',initials:'AT',color:'#f27349',calorieGoal:2200,proteinGoal:140,carbGoal:250,fatGoal:70 },
  { id:'maya',name:'Maya',initials:'MA',color:'#708c67',calorieGoal:1900,proteinGoal:110,carbGoal:210,fatGoal:65 },
  { id:'leo',name:'Leo',initials:'LE',color:'#557ea4',calorieGoal:2500,proteinGoal:160,carbGoal:290,fatGoal:80 },
  { id:'nina',name:'Nina',initials:'NI',color:'#b17a9d',calorieGoal:2050,proteinGoal:120,carbGoal:225,fatGoal:68 },
];
const emptyData:Data = { members:fallbackMembers,nutrition:[],tasks:[],expenses:[],organisers:[],messages:[] };

function Avatar({ member, small=false }: { member:Partial<Member>; small?:boolean }) {
  return <span className={small?'avatar avatar-small':'avatar'} style={{backgroundColor:member.color}}>{member.initials}</span>;
}
function money(value:number) { return new Intl.NumberFormat('en-US',{style:'currency',currency:'USD'}).format(value); }
function memberFor(data:Data,id:string) { return data.members.find(m=>m.id===id) || fallbackMembers[0]; }
function Field({ name,label,type='text',placeholder,defaultValue,required=true }: { name:string;label:string;type?:string;placeholder?:string;defaultValue?:string|number;required?:boolean }) {
  return <label className="form-field"><span>{label}</span><input name={name} type={type} placeholder={placeholder} defaultValue={defaultValue} required={required} min={type==='number'?0:undefined} step={type==='number'?'any':undefined}/></label>;
}

export default function HouseholdApp() {
  const [active,setActive] = useState('Overview');
  const [memberId,setMemberId] = useState('alex');
  const [data,setData] = useState<Data>(emptyData);
  const [loading,setLoading] = useState(true);
  const [notice,setNotice] = useState('');
  const load = async () => {
    try { const response=await fetch('/api/schwank'); if(!response.ok) throw new Error(); setData(await response.json()); }
    catch { setNotice('Shared storage is reconnecting. Your workspace is still available.'); }
    finally { setLoading(false); }
  };
  useEffect(()=>{ void load(); },[]);
  const post = async (payload:Record<string,string|number|boolean>) => {
    setNotice('Saving…');
    const response=await fetch('/api/schwank',{method:'POST',headers:{'content-type':'application/json'},body:JSON.stringify(payload)});
    if(response.ok){ await load(); setNotice('Saved for everyone'); setTimeout(()=>setNotice(''),1800); }
    else setNotice('Could not save that. Try again.');
  };
  const current = memberFor(data,memberId);
  const todayNutrition = data.nutrition.filter(n=>n.memberId===memberId);
  const totals = todayNutrition.reduce((sum,n)=>({calories:sum.calories+n.calories,protein:sum.protein+n.protein,carbs:sum.carbs+n.carbs,fat:sum.fat+n.fat}),{calories:0,protein:0,carbs:0,fat:0});
  const totalSpend = data.expenses.reduce((sum,e)=>sum+Number(e.amount),0);
  const completed = data.tasks.filter(t=>t.status==='done').length;
  const taskPercent = data.tasks.length ? Math.round(completed/data.tasks.length*100) : 0;

  return <main className="app-shell">
    <aside className="sidebar">
      <div className="brand"><span className="brand-mark"><Sparkles size={18}/></span><div><strong>schwank</strong><span>Our shared space</span></div></div>
      <nav className="side-nav" aria-label="Main navigation">{nav.map(item=>{const Icon=item.icon; const count=item.label==='Tasks'?data.tasks.filter(t=>t.status!=='done').length:item.label==='Chat'?Math.min(data.messages.length,9):0; return <button onClick={()=>setActive(item.label)} className={active===item.label?'nav-item active':'nav-item'} key={item.label}><Icon size={18}/><span>{item.label}</span>{count>0&&<em>{count}</em>}</button>})}</nav>
      <div className="house-card"><div className="house-illustration"><Home size={24}/></div><strong>Maple House</strong><span>Move-in in 12 days</span><div className="avatar-stack">{data.members.map(m=><Avatar key={m.id} member={m} small/>)}</div></div>
      <button className="profile-row"><Avatar member={current}/><span><strong>{current.name}</strong><small>House member</small></span><MoreHorizontal size={18}/></button>
    </aside>

    <section className="workspace">
      <header className="topbar"><button className="mobile-brand" onClick={()=>setActive('Overview')}><span className="brand-mark"><Sparkles size={17}/></span>schwank</button><label className="search"><Search size={17}/><input placeholder="Search the household…"/></label><div className="topbar-actions"><button className="icon-button" aria-label="Add a task" onClick={()=>setActive('Tasks')}><Plus size={19}/></button><label className="person-picker"><Avatar member={current} small/><select value={memberId} onChange={e=>setMemberId(e.target.value)} aria-label="Current household member">{data.members.map(m=><option key={m.id} value={m.id}>{m.name}</option>)}</select><ChevronDown size={14}/></label></div></header>
      {notice&&<div className="toast" role="status">{notice}</div>}
      <div className="content">
        {loading ? <div className="loading-state"><LoaderCircle className="spin"/>Opening Maple House…</div> : active==='Overview' ? <Overview data={data} current={current} totals={totals} totalSpend={totalSpend} taskPercent={taskPercent} setActive={setActive}/> : active==='Nutrition' ? <NutritionView data={data} current={current} memberId={memberId} setMemberId={setMemberId} totals={totals} post={post}/> : active==='Tasks' ? <TasksView data={data} post={post}/> : active==='Spending' ? <SpendingView data={data} total={totalSpend} memberId={memberId} post={post}/> : active==='Organisers' ? <OrganisersView data={data} post={post}/> : <ChatView data={data} current={current} post={post}/>} 
      </div>
    </section>
  </main>;
}

function PageTitle({eyebrow,title,copy,action}:{eyebrow:string;title:string;copy:string;action?:React.ReactNode}) { return <div className="welcome"><div><span className="eyebrow">{eyebrow}</span><h1>{title} <span>✦</span></h1><p>{copy}</p></div>{action}</div>; }

function Overview({data,current,totals,totalSpend,taskPercent,setActive}:{data:Data;current:Member;totals:{calories:number;protein:number;carbs:number;fat:number};totalSpend:number;taskPercent:number;setActive:(v:string)=>void}) {
  const recentTasks=data.tasks.filter(t=>t.status!=='done').slice(0,4);
  return <>
    <PageTitle eyebrow="Your shared home" title={`Good morning, ${current.name}`} copy="Here’s what’s happening around the apartment today." action={<button className="primary-button" onClick={()=>setActive('Tasks')}><Plus size={18}/>Quick add</button>}/>
    <div className="stats-grid">
      <article className="stat-card nutrition-card"><div className="stat-heading"><span className="tinted-icon orange"><Flame size={19}/></span><span>Today’s nutrition</span><button onClick={()=>setActive('Nutrition')}><ArrowRight size={17}/></button></div><div className="nutrition-body"><div className="calorie-ring" style={{background:`conic-gradient(var(--orange) 0 ${Math.min(100,totals.calories/current.calorieGoal*100)}%,#eeeae2 0)`}}><span><strong>{totals.calories.toLocaleString()}</strong><small>of {current.calorieGoal.toLocaleString()} kcal</small></span></div><div className="macro-list"><Macro name="Protein" value={totals.protein} goal={current.proteinGoal} cls="protein"/><Macro name="Carbs" value={totals.carbs} goal={current.carbGoal} cls="carbs"/><Macro name="Fats" value={totals.fat} goal={current.fatGoal} cls="fats"/></div></div><button onClick={()=>setActive('Nutrition')} className="text-button">Log a meal <ArrowRight size={15}/></button></article>
      <article className="stat-card spending-card"><div className="stat-heading"><span className="tinted-icon green"><CircleDollarSign size={19}/></span><span>August spending</span><button onClick={()=>setActive('Spending')}><ArrowRight size={17}/></button></div><div className="spend-total"><strong>{money(totalSpend)}</strong><span><b>Shared total</b> across {data.expenses.length} expenses</span></div><div className="mini-chart">{[36,58,45,77,52,86,66,92,70,55,74,61].map((h,i)=><i key={i} style={{height:`${h}%`}}/>)}</div><div className="spend-footer"><span>Household budget</span><b>{money(Math.max(0,2000-totalSpend))} left</b></div></article>
      <article className="stat-card progress-card"><div className="stat-heading"><span className="tinted-icon blue"><CheckCircle2 size={19}/></span><span>Move-in progress</span><button onClick={()=>setActive('Tasks')}><ArrowRight size={17}/></button></div><div className="progress-number"><strong>{taskPercent}%</strong><span>{data.tasks.filter(t=>t.status==='done').length} of {data.tasks.length} tasks complete</span></div><div className="big-progress"><i style={{width:`${taskPercent}%`}}/></div><div className="milestones"><span className="done">✓ Lease signed</span><span>○ Moving day</span></div></article>
    </div>
    <div className="lower-grid"><article className="panel task-panel"><div className="panel-heading"><div><h2>Up next</h2><span>{recentTasks.length} active tasks</span></div><button className="link-button" onClick={()=>setActive('Tasks')}>View board <ArrowRight size={15}/></button></div><div className="task-list">{recentTasks.map(task=>{const m=memberFor(data,task.assigneeId);return <div className="task-row" key={task.id}><span className="check"/><div className="task-copy"><strong>{task.title}</strong><span>{task.due}</span></div><span className="task-tag">{task.tag}</span><Avatar member={m} small/></div>})}</div></article><div className="right-stack"><article className="panel groceries-panel"><div className="panel-heading"><div><h2>Grocery list</h2><span>{data.organisers.filter(i=>i.list==='Groceries'&&!i.done).length} items</span></div><span className="tinted-icon peach"><ShoppingBasket size={18}/></span></div><div className="grocery-list">{data.organisers.filter(i=>i.list==='Groceries'&&!i.done).slice(0,4).map(i=><span key={i.id}>{i.label}</span>)}</div><button onClick={()=>setActive('Organisers')} className="add-row compact">Open organisers</button></article><article className="panel chat-panel"><div className="panel-heading"><div><h2>House chat</h2><span>{data.messages.length} messages</span></div><button onClick={()=>setActive('Chat')} className="link-button">Open chat</button></div>{data.messages.slice(-2).map(m=><div className="message-preview" key={m.id}><Avatar member={m}/><div><strong>{m.name}</strong><p>{m.body}</p></div></div>)}</article></div></div>
  </>;
}

function Macro({name,value,goal,cls}:{name:string;value:number;goal:number;cls:string}) { return <div><span><i className={`dot ${cls}`}/>{name}</span><b>{value} / {goal}g</b><progress value={value} max={goal}/></div>; }

function NutritionView({data,current,memberId,setMemberId,totals,post}:{data:Data;current:Member;memberId:string;setMemberId:(v:string)=>void;totals:{calories:number;protein:number;carbs:number;fat:number};post:(p:Record<string,string|number|boolean>)=>Promise<void>}) {
  return <><PageTitle eyebrow="Personal goals" title="Nutrition" copy="Calories and macros stay separate for every housemate."/>
    <div className="member-tabs">{data.members.map(m=><button key={m.id} onClick={()=>setMemberId(m.id)} className={memberId===m.id?'selected':''}><Avatar member={m} small/>{m.name}</button>)}</div>
    <div className="feature-grid"><article className="panel nutrition-summary"><div className="calorie-ring large" style={{background:`conic-gradient(var(--orange) 0 ${Math.min(100,totals.calories/current.calorieGoal*100)}%,#eeeae2 0)`}}><span><strong>{totals.calories}</strong><small>{Math.max(0,current.calorieGoal-totals.calories)} kcal remaining</small></span></div><div className="macro-cards"><div><span>Protein</span><strong>{totals.protein}g</strong><progress value={totals.protein} max={current.proteinGoal}/><small>Goal {current.proteinGoal}g</small></div><div><span>Carbs</span><strong>{totals.carbs}g</strong><progress value={totals.carbs} max={current.carbGoal}/><small>Goal {current.carbGoal}g</small></div><div><span>Fats</span><strong>{totals.fat}g</strong><progress value={totals.fat} max={current.fatGoal}/><small>Goal {current.fatGoal}g</small></div></div></article><article className="panel entry-panel"><h2>Log a meal</h2><p>Quick totals are enough—no food database needed.</p><form className="form-grid" onSubmit={async e=>{e.preventDefault();const f=new FormData(e.currentTarget);await post({type:'nutrition',memberId,label:String(f.get('label')),calories:Number(f.get('calories')),protein:Number(f.get('protein')),carbs:Number(f.get('carbs')),fat:Number(f.get('fat'))});e.currentTarget.reset();}}><Field name="label" label="Meal" placeholder="Dinner"/><Field name="calories" label="Calories" type="number"/><Field name="protein" label="Protein (g)" type="number"/><Field name="carbs" label="Carbs (g)" type="number"/><Field name="fat" label="Fat (g)" type="number"/><button className="primary-button" type="submit"><Plus size={16}/>Add meal</button></form></article></div>
    <article className="panel table-panel"><div className="panel-heading"><div><h2>Today’s meals</h2><span>{current.name}’s log</span></div></div><div className="data-table">{data.nutrition.filter(n=>n.memberId===memberId).map(n=><div key={n.id}><strong>{n.label}</strong><span>{n.calories} kcal</span><span>{n.protein}P</span><span>{n.carbs}C</span><span>{n.fat}F</span></div>)}</div></article>
  </>;
}

function TasksView({data,post}:{data:Data;post:(p:Record<string,string|number|boolean>)=>Promise<void>}) {
  const columns=[['todo','To do'],['progress','In progress'],['done','Done']];
  return <><PageTitle eyebrow="Shared responsibility" title="Task board" copy="Keep move-in jobs and everyday chores moving."/>
    <form className="quick-form panel" onSubmit={async e=>{e.preventDefault();const f=new FormData(e.currentTarget);await post({type:'task',title:String(f.get('title')),assigneeId:String(f.get('assigneeId')),tag:String(f.get('tag')),due:String(f.get('due'))});e.currentTarget.reset();}}><Field name="title" label="New task" placeholder="What needs doing?"/><label className="form-field"><span>Assignee</span><select name="assigneeId">{data.members.map(m=><option key={m.id} value={m.id}>{m.name}</option>)}</select></label><Field name="tag" label="Group" defaultValue="Home"/><Field name="due" label="Due" defaultValue="This week"/><button className="primary-button"><Plus size={16}/>Add task</button></form>
    <div className="kanban">{columns.map(([status,label])=><section className="kanban-column" key={status}><header><div><i className={status}/><strong>{label}</strong></div><span>{data.tasks.filter(t=>t.status===status).length}</span></header>{data.tasks.filter(t=>t.status===status).map(task=>{const m=memberFor(data,task.assigneeId);const next=status==='todo'?'progress':status==='progress'?'done':'todo';return <article className="task-card" key={task.id}><span className="task-tag">{task.tag}</span><h3>{task.title}</h3><footer><div><Avatar member={m} small/><span>{task.due}</span></div><button onClick={()=>post({type:'task-status',id:task.id,status:next})} aria-label={`Move ${task.title}`}><ArrowRight size={15}/></button></footer></article>})}</section>)}</div>
  </>;
}

function SpendingView({data,total,memberId,post}:{data:Data;total:number;memberId:string;post:(p:Record<string,string|number|boolean>)=>Promise<void>}) {
  const categories=useMemo(()=>Object.entries(data.expenses.reduce<Record<string,number>>((a,e)=>{a[e.category]=(a[e.category]||0)+Number(e.amount);return a},{})).sort((a,b)=>b[1]-a[1]),[data.expenses]);
  return <><PageTitle eyebrow="Household money" title="Spending" copy="See where the shared budget is going and who paid."/>
    <div className="feature-grid"><article className="panel spend-hero"><span>Total this month</span><strong>{money(total)}</strong><div className="category-bars">{categories.map(([name,value])=><div key={name}><span>{name}<b>{money(value)}</b></span><i><em style={{width:`${total?value/total*100:0}%`}}/></i></div>)}</div></article><article className="panel entry-panel"><h2>Add an expense</h2><p>Record shared purchases as they happen.</p><form className="form-grid" onSubmit={async e=>{e.preventDefault();const f=new FormData(e.currentTarget);await post({type:'expense',label:String(f.get('label')),amount:Number(f.get('amount')),category:String(f.get('category')),paidBy:memberId});e.currentTarget.reset();}}><Field name="label" label="What was it?" placeholder="Cleaning supplies"/><Field name="amount" label="Amount" type="number"/><label className="form-field"><span>Category</span><select name="category"><option>Groceries</option><option>Housing</option><option>Utilities</option><option>Furniture</option><option>Transport</option><option>Other</option></select></label><button className="primary-button"><Plus size={16}/>Add expense</button></form></article></div>
    <article className="panel table-panel"><div className="panel-heading"><div><h2>Recent expenses</h2><span>{data.expenses.length} entries</span></div></div><div className="expense-list">{data.expenses.map(e=>{const m=memberFor(data,e.paidBy);return <div key={e.id}><span className="expense-icon"><WalletCards size={16}/></span><div><strong>{e.label}</strong><small>{e.category} · paid by {m.name}</small></div><b>{money(Number(e.amount))}</b></div>})}</div></article>
  </>;
}

function OrganisersView({data,post}:{data:Data;post:(p:Record<string,string|number|boolean>)=>Promise<void>}) {
  const lists=Array.from(new Set(['Groceries','Moving checklist','House rules',...data.organisers.map(i=>i.list)]));
  return <><PageTitle eyebrow="Lists that stay useful" title="Organisers" copy="Groceries, move-in notes, recurring chores—kept in one calm place."/><div className="organiser-grid">{lists.map(list=><article className="panel organiser-card" key={list}><div className="panel-heading"><div><h2>{list}</h2><span>{data.organisers.filter(i=>i.list===list&&!i.done).length} remaining</span></div><span className="tinted-icon peach"><ClipboardCheck size={18}/></span></div><div className="check-list">{data.organisers.filter(i=>i.list===list).map(item=><button key={item.id} className={item.done?'complete':''} onClick={()=>post({type:'organiser-toggle',id:item.id,done:!item.done})}><i>{item.done&&<Check size={12}/>}</i><span>{item.label}</span></button>)}</div><form className="inline-add" onSubmit={async e=>{e.preventDefault();const f=new FormData(e.currentTarget);await post({type:'organiser',list,label:String(f.get('label'))});e.currentTarget.reset();}}><input name="label" placeholder="Add an item…" required/><button aria-label={`Add to ${list}`}><Plus size={16}/></button></form></article>)}</div></>;
}

function ChatView({data,current,post}:{data:Data;current:Member;post:(p:Record<string,string|number|boolean>)=>Promise<void>}) {
  return <><PageTitle eyebrow="Everyone’s in the loop" title="House chat" copy="A lightweight place for links, decisions, and quick updates."/><article className="chat-room panel"><header><div className="avatar-stack">{data.members.map(m=><Avatar key={m.id} member={m} small/>)}</div><div><strong>Maple House</strong><span>{data.members.length} members · local household chat</span></div></header><div className="messages">{data.messages.map(message=>{const mine=message.memberId===current.id;return <div className={mine?'message mine':'message'} key={message.id}><Avatar member={message}/><div><span>{message.name} · {new Date(message.createdAt).toLocaleTimeString([],{hour:'2-digit',minute:'2-digit'})}</span><p>{message.body}</p></div></div>})}</div><form className="chat-compose" onSubmit={async e=>{e.preventDefault();const f=new FormData(e.currentTarget);const body=String(f.get('body')).trim();if(body){await post({type:'message',memberId:current.id,body});e.currentTarget.reset();}}}><Avatar member={current}/><input name="body" placeholder={`Message as ${current.name}…`} autoComplete="off"/><button aria-label="Send message"><Send size={18}/></button></form></article></>;
}
