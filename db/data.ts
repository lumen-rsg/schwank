import { env } from 'cloudflare:workers';
import type { AuthUser } from './auth';
import { ensureDatabase } from './setup';

export type DataAction = Record<string,string|number|boolean>;
const today=()=>new Date().toISOString().slice(0,10);
const cleanText=(value:unknown,maximum:number,fallback='')=>String(value??fallback).trim().slice(0,maximum);
const cleanNumber=(value:unknown,maximum=1_000_000)=>Math.max(0,Math.min(maximum,Number(value)||0));
const cleanVisibility=(value:unknown)=>value==='shared'?'shared':'private';

export class DataError extends Error { constructor(message:string,public status=400){super(message);} }

export async function readHouseholdData(user:AuthUser) {
  await ensureDatabase(); const db=env.DB;
  const [nutrition,tasks,expenses,organisers,messages]=await Promise.all([
    db.prepare('SELECT id,label,calories,protein,carbs,fat,eaten_on AS eatenOn FROM nutrition_entries WHERE user_id=? AND eaten_on=? ORDER BY id DESC').bind(user.id,today()).all(),
    db.prepare("SELECT id,title,status,tag,due,visibility,(user_id=?) AS owned FROM tasks WHERE user_id=? OR visibility='shared' ORDER BY id DESC").bind(user.id,user.id).all(),
    db.prepare("SELECT id,label,amount,category,spent_on AS spentOn,visibility,(user_id=?) AS owned FROM expenses WHERE user_id=? OR visibility='shared' ORDER BY id DESC").bind(user.id,user.id).all(),
    db.prepare("SELECT id,list,label,done,visibility,(user_id=?) AS owned FROM organiser_items WHERE user_id=? OR visibility='shared' ORDER BY id DESC").bind(user.id,user.id).all(),
    db.prepare('SELECT m.id,m.body,m.created_at AS createdAt,u.display_name AS name,u.initials,u.color,(m.user_id=?) AS mine FROM messages m JOIN users u ON u.id=m.user_id ORDER BY m.created_at').bind(user.id).all(),
  ]);
  return {currentUser:user,nutrition:nutrition.results,tasks:tasks.results,expenses:expenses.results,organisers:organisers.results,messages:messages.results};
}

export async function writeHouseholdData(userId:number,body:DataAction) {
  await ensureDatabase(); const db=env.DB; const legacyId=String(userId);
  if(body.type==='nutrition'){const label=cleanText(body.label,80);if(!label)throw new DataError('Meal name is required.');return db.prepare('INSERT INTO nutrition_entries (user_id,member_id,label,calories,protein,carbs,fat,eaten_on) VALUES (?,?,?,?,?,?,?,?)').bind(userId,legacyId,label,cleanNumber(body.calories,20_000),cleanNumber(body.protein,2_000),cleanNumber(body.carbs,2_000),cleanNumber(body.fat,2_000),today()).run();}
  if(body.type==='task'){const title=cleanText(body.title,120);if(!title)throw new DataError('Task title is required.');return db.prepare('INSERT INTO tasks (user_id,visibility,title,status,assignee_id,tag,due) VALUES (?,?,?,?,?,?,?)').bind(userId,cleanVisibility(body.visibility),title,'todo',legacyId,cleanText(body.tag,30,'Home')||'Home',cleanText(body.due,40,'This week')||'This week').run();}
  if(body.type==='task-status'){const status=['todo','progress','done'].includes(String(body.status))?String(body.status):'todo';const result=await db.prepare('UPDATE tasks SET status=? WHERE id=? AND user_id=?').bind(status,cleanNumber(body.id),userId).run();if(!result.meta.changes)throw new DataError('That task cannot be changed.',403);return result;}
  if(body.type==='expense'){const label=cleanText(body.label,100);const amount=cleanNumber(body.amount);if(!label||amount<=0)throw new DataError('Expense name and amount are required.');return db.prepare('INSERT INTO expenses (user_id,visibility,label,amount,category,paid_by,spent_on) VALUES (?,?,?,?,?,?,?)').bind(userId,cleanVisibility(body.visibility),label,amount,cleanText(body.category,40,'Other')||'Other',legacyId,today()).run();}
  if(body.type==='organiser'){const label=cleanText(body.label,100);const list=cleanText(body.list,50);if(!label||!list)throw new DataError('List and item names are required.');return db.prepare('INSERT INTO organiser_items (user_id,visibility,list,label,done) VALUES (?,?,?,?,0)').bind(userId,cleanVisibility(body.visibility),list,label).run();}
  if(body.type==='organiser-toggle'){const result=await db.prepare('UPDATE organiser_items SET done=? WHERE id=? AND user_id=?').bind(body.done?1:0,cleanNumber(body.id),userId).run();if(!result.meta.changes)throw new DataError('That item cannot be changed.',403);return result;}
  if(body.type==='message'){const message=cleanText(body.body,2_000);if(!message)throw new DataError('Message cannot be empty.');return db.prepare('INSERT INTO messages (user_id,member_id,body,created_at) VALUES (?,?,?,?)').bind(userId,legacyId,message,new Date().toISOString()).run();}
  throw new DataError('Unknown data action.');
}
