import { env } from 'cloudflare:workers';
import type { AuthUser } from './auth';
import { ensureDatabase } from './setup';

export type DataAction = Record<string,string|number|boolean>;
const today=()=>new Date().toISOString().slice(0,10);
const asText=(value:unknown,fallback='')=>typeof value==='string'||typeof value==='number'?String(value):fallback;
const cleanText=(value:unknown,maximum:number,fallback='')=>asText(value,fallback).trim().slice(0,maximum);
const cleanNumber=(value:unknown,maximum=1_000_000)=>Math.max(0,Math.min(maximum,Number(value)||0));
const cleanVisibility=(value:unknown)=>value==='shared'?'shared':'private';
const cleanDate=(value:unknown)=>{const date=cleanText(value,10,today());const parsed=new Date(`${date}T00:00:00Z`);if(!/^\d{4}-\d{2}-\d{2}$/.test(date)||Number.isNaN(parsed.getTime())||parsed.toISOString().slice(0,10)!==date||date>today())throw new DataError('Enter a valid date that is not in the future.');return date};

type NutritionSex='male'|'female';
type NutritionActivity='inactive'|'low'|'active'|'very';
type NutritionPlan='lose'|'maintain'|'gain';
const energyEquations:Record<NutritionSex,Record<NutritionActivity,[number,number,number,number]>>={
  male:{inactive:[753.07,-10.83,6.50,14.10],low:[581.47,-10.83,8.30,14.94],active:[1004.82,-10.83,6.52,15.91],very:[-517.88,-10.83,15.61,19.11]},
  female:{inactive:[584.90,-7.01,5.72,11.71],low:[575.77,-7.01,6.60,12.14],active:[710.25,-7.01,6.54,12.34],very:[511.83,-7.01,9.07,12.56]},
};
function calculateNutrition(sex:NutritionSex,activity:NutritionActivity,plan:NutritionPlan,age:number,heightCm:number,weightKg:number){
  const [base,ageFactor,heightFactor,weightFactor]=energyEquations[sex][activity];const maintenance=Math.round((base+ageFactor*age+heightFactor*heightCm+weightFactor*weightKg)/10)*10;const planFactor=plan==='lose'?0.9:plan==='gain'?1.1:1;const calories=Math.round(maintenance*planFactor/10)*10;const ratios=plan==='lose'?{protein:.25,fat:.30}:plan==='gain'?{protein:.20,fat:.25}:{protein:.20,fat:.30};const protein=Math.round(calories*ratios.protein/4);const fat=Math.round(calories*ratios.fat/9);const carbs=Math.round((calories-protein*4-fat*9)/4);return {maintenance,calories,protein,fat,carbs};
}

export class DataError extends Error { constructor(message:string,public status=400){super(message);} }

function cleanImage(value:unknown,maximum:number){
  const image=typeof value==='string'?value:'';
  if(!image)return null;
  if(image.length>maximum)throw new DataError('The image is too large.');
  if(!/^data:image\/(?:jpeg|png|webp);base64,[A-Za-z0-9+/=]+$/.test(image))throw new DataError('Use a JPEG, PNG, or WebP image.');
  return image;
}

export async function readHouseholdData(user:AuthUser){
  await ensureDatabase();const db=env.DB;
  const since=new Date();since.setUTCDate(since.getUTCDate()-83);
  const [currentUser,members,home,nutrition,tasks,expenses,organisers,messages,habits,water]=await Promise.all([
    db.prepare('SELECT id,email,display_name AS name,initials,color,avatar_data AS avatar,calorie_goal AS calorieGoal,protein_goal AS proteinGoal,carb_goal AS carbGoal,fat_goal AS fatGoal,water_goal AS waterGoal,maintenance_calories AS maintenanceCalories,height_cm AS heightCm,weight_kg AS weightKg,age,sex,activity,nutrition_plan AS nutritionPlan,diet FROM users WHERE id=?').bind(user.id).first<AuthUser>(),
    db.prepare('SELECT id,display_name AS name,initials,color,avatar_data AS avatar FROM users ORDER BY display_name').all(),
    db.prepare('SELECT name,address,photo_data AS photo FROM household_settings WHERE id=1').first(),
    db.prepare("SELECT n.id,n.label,n.calories,n.protein,n.carbs,n.fat,n.eaten_on AS eatenOn,n.visibility,(n.user_id=?) AS owned,u.id AS userId,u.display_name AS name,u.initials,u.color,u.avatar_data AS avatar FROM nutrition_entries n JOIN users u ON u.id=n.user_id WHERE n.eaten_on=? AND (n.user_id=? OR n.visibility='shared') ORDER BY n.id DESC").bind(user.id,today(),user.id).all(),
    db.prepare("SELECT id,title,status,tag,due,visibility,(user_id=?) AS owned FROM tasks WHERE user_id=? OR visibility='shared' ORDER BY id DESC").bind(user.id,user.id).all(),
    db.prepare("SELECT id,label,amount,category,spent_on AS spentOn,visibility,(user_id=?) AS owned FROM expenses WHERE user_id=? OR visibility='shared' ORDER BY id DESC").bind(user.id,user.id).all(),
    db.prepare("SELECT id,list,label,done,visibility,(user_id=?) AS owned FROM organiser_items WHERE user_id=? OR visibility='shared' ORDER BY id DESC").bind(user.id,user.id).all(),
    db.prepare('SELECT m.id,m.body,m.created_at AS createdAt,u.display_name AS name,u.initials,u.color,u.avatar_data AS avatar,(m.user_id=?) AS mine FROM messages m JOIN users u ON u.id=m.user_id ORDER BY m.created_at').bind(user.id).all(),
    db.prepare('SELECT h.id,h.user_id AS userId,h.habit,h.occurrences,h.cost,h.occurred_on AS occurredOn,h.created_at AS createdAt,u.display_name AS name,u.initials,u.color,u.avatar_data AS avatar,(h.user_id=?) AS mine FROM habit_entries h JOIN users u ON u.id=h.user_id WHERE h.occurred_on>=? ORDER BY h.occurred_on DESC,h.id DESC').bind(user.id,since.toISOString().slice(0,10)).all(),
    db.prepare('SELECT id,amount_ml AS amountMl,drunk_on AS drunkOn,created_at AS createdAt FROM water_entries WHERE user_id=? AND drunk_on=? ORDER BY id DESC').bind(user.id,today()).all(),
  ]);
  return {currentUser:currentUser??user,members:members.results,home:home??{name:'Our home',address:'',photo:null},nutrition:nutrition.results,tasks:tasks.results,expenses:expenses.results,organisers:organisers.results,messages:messages.results,habits:habits.results,water:water.results};
}

export async function writeHouseholdData(userId:number,body:DataAction){
  await ensureDatabase();const db=env.DB;const legacyId=String(userId);
  if(body.type==='nutrition'){
    const label=cleanText(body.label,80);if(!label)throw new DataError('Meal name is required.');
    return db.prepare('INSERT INTO nutrition_entries (user_id,member_id,visibility,label,calories,protein,carbs,fat,eaten_on) VALUES (?,?,?,?,?,?,?,?,?)').bind(userId,legacyId,cleanVisibility(body.visibility),label,cleanNumber(body.calories,20_000),cleanNumber(body.protein,2_000),cleanNumber(body.carbs,2_000),cleanNumber(body.fat,2_000),today()).run();
  }
  if(body.type==='task'){const title=cleanText(body.title,120);if(!title)throw new DataError('Task title is required.');return db.prepare('INSERT INTO tasks (user_id,visibility,title,status,assignee_id,tag,due) VALUES (?,?,?,?,?,?,?)').bind(userId,cleanVisibility(body.visibility),title,'todo',legacyId,cleanText(body.tag,30,'Home')||'Home',cleanText(body.due,40,'This week')||'This week').run();}
  if(body.type==='task-status'){const status=['todo','progress','done'].includes(String(body.status))?String(body.status):'todo';const result=await db.prepare('UPDATE tasks SET status=? WHERE id=? AND user_id=?').bind(status,cleanNumber(body.id),userId).run();if(!result.meta.changes)throw new DataError('That task cannot be changed.',403);return result;}
  if(body.type==='expense'){const label=cleanText(body.label,100);const amount=cleanNumber(body.amount);if(!label||amount<=0)throw new DataError('Expense name and amount are required.');return db.prepare('INSERT INTO expenses (user_id,visibility,label,amount,category,paid_by,spent_on) VALUES (?,?,?,?,?,?,?)').bind(userId,cleanVisibility(body.visibility),label,amount,cleanText(body.category,40,'Other')||'Other',legacyId,today()).run();}
  if(body.type==='organiser'){const label=cleanText(body.label,100);const list=cleanText(body.list,50);if(!label||!list)throw new DataError('List and item names are required.');return db.prepare('INSERT INTO organiser_items (user_id,visibility,list,label,done) VALUES (?,?,?,?,0)').bind(userId,cleanVisibility(body.visibility),list,label).run();}
  if(body.type==='organiser-toggle'){const result=await db.prepare('UPDATE organiser_items SET done=? WHERE id=? AND user_id=?').bind(body.done?1:0,cleanNumber(body.id),userId).run();if(!result.meta.changes)throw new DataError('That item cannot be changed.',403);return result;}
  if(body.type==='message'){const message=cleanText(body.body,2_000);if(!message)throw new DataError('Message cannot be empty.');return db.prepare('INSERT INTO messages (user_id,member_id,body,created_at) VALUES (?,?,?,?)').bind(userId,legacyId,message,new Date().toISOString()).run();}
  if(body.type==='home'){
    const name=cleanText(body.name,60);const address=cleanText(body.address,180);if(!name)throw new DataError('Home name is required.');
    if(typeof body.photo==='string')return db.prepare('UPDATE household_settings SET name=?,address=?,photo_data=?,updated_at=?,updated_by=? WHERE id=1').bind(name,address,cleanImage(body.photo,1_200_000),new Date().toISOString(),userId).run();
    return db.prepare('UPDATE household_settings SET name=?,address=?,updated_at=?,updated_by=? WHERE id=1').bind(name,address,new Date().toISOString(),userId).run();
  }
  if(body.type==='avatar')return db.prepare('UPDATE users SET avatar_data=? WHERE id=?').bind(cleanImage(body.avatar,450_000),userId).run();
  if(body.type==='habit'){
    const habit=body.habit==='alcohol'?'alcohol':body.habit==='vaping'?'vaping':null;if(!habit)throw new DataError('Choose vaping or alcohol.');
    const occurrences=Math.max(1,Math.round(cleanNumber(body.occurrences,1_000)));const cost=cleanNumber(body.cost);const occurredOn=cleanDate(body.occurredOn);
    return db.prepare('INSERT INTO habit_entries (user_id,habit,occurrences,cost,occurred_on,created_at) VALUES (?,?,?,?,?,?)').bind(userId,habit,occurrences,cost,occurredOn,new Date().toISOString()).run();
  }
  if(body.type==='water'){
    const amountMl=Math.round(cleanNumber(body.amountMl,10_000));if(amountMl<1)throw new DataError('Water amount is required.');
    return db.prepare('INSERT INTO water_entries (user_id,amount_ml,drunk_on,created_at) VALUES (?,?,?,?)').bind(userId,amountMl,cleanDate(body.drunkOn),new Date().toISOString()).run();
  }
  if(body.type==='water-goal'){
    const goal=Math.round(cleanNumber(body.waterGoal,10_000));if(goal<250)throw new DataError('Water goal must be at least 250 ml.');
    return db.prepare('UPDATE users SET water_goal=? WHERE id=?').bind(goal,userId).run();
  }
  if(body.type==='nutrition-profile'){
    const sex=body.sex==='male'||body.sex==='female'?body.sex:null;const activity=['inactive','low','active','very'].includes(String(body.activity))?body.activity as NutritionActivity:null;const plan=['lose','maintain','gain'].includes(String(body.plan))?body.plan as NutritionPlan:null;const diet=['omnivore','vegetarian','vegan'].includes(String(body.diet))?String(body.diet):null;const age=Math.round(cleanNumber(body.age,100));const heightCm=Math.round(cleanNumber(body.heightCm,250)*10)/10;const weightKg=Math.round(cleanNumber(body.weightKg,350)*10)/10;
    if(!sex||!activity||!plan||!diet||age<19||heightCm<120||weightKg<35)throw new DataError('Enter valid adult profile details.');
    const goals=calculateNutrition(sex,activity,plan,age,heightCm,weightKg);
    return db.prepare('UPDATE users SET height_cm=?,weight_kg=?,age=?,sex=?,activity=?,nutrition_plan=?,diet=?,maintenance_calories=?,calorie_goal=?,protein_goal=?,carb_goal=?,fat_goal=? WHERE id=?').bind(heightCm,weightKg,age,sex,activity,plan,diet,goals.maintenance,goals.calories,goals.protein,goals.carbs,goals.fat,userId).run();
  }
  throw new DataError('Unknown data action.');
}
