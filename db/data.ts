import { env } from 'cloudflare:workers';
import { isAiConfigured } from './ai-config';
import type { AuthUser } from './auth';
import { ensureDatabase } from './setup';

export type DataAction = Record<string, unknown>;
const today = () => new Date().toISOString().slice(0, 10);
const asText = (value: unknown, fallback = '') =>
  typeof value === 'string' || typeof value === 'number'
    ? String(value)
    : fallback;
const cleanText = (value: unknown, maximum: number, fallback = '') =>
  asText(value, fallback).trim().slice(0, maximum);
const cleanNumber = (value: unknown, maximum = 1_000_000) =>
  Math.max(0, Math.min(maximum, Number(value) || 0));
const cleanVisibility = (value: unknown) =>
  value === 'shared' ? 'shared' : 'private';
const cleanDate = (value: unknown) => {
  const date = cleanText(value, 10, today());
  const parsed = new Date(`${date}T00:00:00Z`);
  if (
    !/^\d{4}-\d{2}-\d{2}$/.test(date) ||
    Number.isNaN(parsed.getTime()) ||
    parsed.toISOString().slice(0, 10) !== date ||
    date > today()
  )
    throw new DataError('Enter a valid date that is not in the future.');
  return date;
};
const normalizeFoodName = (value: string) =>
  value.normalize('NFKC').trim().toLocaleLowerCase('en').replace(/\s+/g, ' ');
const cleanFoodUnit = (value: unknown) =>
  ['g', 'kg', 'ml', 'l', 'pcs'].includes(String(value)) ? String(value) : null;
const cleanOptionalDate = (value: unknown) => {
  const date = cleanText(value, 10);
  if (!date) return null;
  const parsed = new Date(`${date}T00:00:00Z`);
  if (
    !/^\d{4}-\d{2}-\d{2}$/.test(date) ||
    Number.isNaN(parsed.getTime()) ||
    parsed.toISOString().slice(0, 10) !== date
  )
    throw new DataError('Enter a valid expiry date.');
  return date;
};
const cleanPaymentDate = (value: unknown) => {
  const date = cleanText(value, 10);
  const parsed = new Date(`${date}T00:00:00Z`);
  if (
    !/^\d{4}-\d{2}-\d{2}$/.test(date) ||
    Number.isNaN(parsed.getTime()) ||
    parsed.toISOString().slice(0, 10) !== date
  )
    throw new DataError('Enter a valid payment date.');
  return date;
};
const cleanDateTime = (value: unknown) => {
  const dateTime = cleanText(value, 16);
  if (!/^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}$/.test(dateTime))
    throw new DataError('Enter a valid reminder date and time.');
  const [date, time] = dateTime.split('T');
  const [hours, minutes] = time.split(':').map(Number);
  cleanPaymentDate(date);
  if (hours > 23 || minutes > 59)
    throw new DataError('Enter a valid reminder date and time.');
  return dateTime;
};
const cleanMedicationTimes = (value: unknown) => {
  const times = Array.from(
    new Set(
      cleanText(value, 80)
        .split(',')
        .map((time) => time.trim())
        .filter(Boolean),
    ),
  );
  if (
    !times.length ||
    times.length > 8 ||
    times.some((time) => {
      if (!/^\d{2}:\d{2}$/.test(time)) return true;
      const [hours, minutes] = time.split(':').map(Number);
      return hours > 23 || minutes > 59;
    })
  )
    throw new DataError('Add 1–8 medication times in HH:MM format.');
  return times.sort();
};
const expenseCategories = [
  'groceries',
  'housing',
  'rent',
  'utilities',
  'subscriptions',
  'loan',
  'furniture',
  'transport',
  'health',
  'leisure',
  'other',
] as const;
type ExpenseCategory = (typeof expenseCategories)[number];
const cleanExpenseCategory = (value: unknown): ExpenseCategory =>
  expenseCategories.includes(value as ExpenseCategory)
    ? (value as ExpenseCategory)
    : 'other';
const paymentKinds = ['subscription', 'loan', 'rent'] as const;
type PaymentKind = (typeof paymentKinds)[number];
const cleanPaymentKind = (value: unknown): PaymentKind | null =>
  paymentKinds.includes(value as PaymentKind) ? (value as PaymentKind) : null;
function advancePaymentDate(date: string, cycle: string) {
  const [year, month, day] = date.split('-').map(Number);
  const monthOffset = cycle === 'yearly' ? 12 : 1;
  const targetMonth = month - 1 + monthOffset;
  const targetYear = year + Math.floor(targetMonth / 12);
  const normalizedMonth = ((targetMonth % 12) + 12) % 12;
  const lastDay = new Date(
    Date.UTC(targetYear, normalizedMonth + 1, 0),
  ).getUTCDate();
  return new Date(Date.UTC(targetYear, normalizedMonth, Math.min(day, lastDay)))
    .toISOString()
    .slice(0, 10);
}
const recipeCourses = [
  'breakfast',
  'starter',
  'main',
  'dinner',
  'salad',
  'dessert',
] as const;
type RecipeCourse = (typeof recipeCourses)[number];
const cleanRecipeCourse = (value: unknown): RecipeCourse | null =>
  recipeCourses.includes(value as RecipeCourse)
    ? (value as RecipeCourse)
    : null;

type NutritionSex = 'male' | 'female';
type NutritionActivity = 'inactive' | 'low' | 'active' | 'very';
type NutritionPlan = 'lose' | 'maintain' | 'gain';
const energyEquations: Record<
  NutritionSex,
  Record<NutritionActivity, [number, number, number, number]>
> = {
  male: {
    inactive: [753.07, -10.83, 6.5, 14.1],
    low: [581.47, -10.83, 8.3, 14.94],
    active: [1004.82, -10.83, 6.52, 15.91],
    very: [-517.88, -10.83, 15.61, 19.11],
  },
  female: {
    inactive: [584.9, -7.01, 5.72, 11.71],
    low: [575.77, -7.01, 6.6, 12.14],
    active: [710.25, -7.01, 6.54, 12.34],
    very: [511.83, -7.01, 9.07, 12.56],
  },
};
function calculateNutrition(
  sex: NutritionSex,
  activity: NutritionActivity,
  plan: NutritionPlan,
  age: number,
  heightCm: number,
  weightKg: number,
) {
  const [base, ageFactor, heightFactor, weightFactor] =
    energyEquations[sex][activity];
  const maintenance =
    Math.round(
      (base +
        ageFactor * age +
        heightFactor * heightCm +
        weightFactor * weightKg) /
        10,
    ) * 10;
  const planFactor = plan === 'lose' ? 0.9 : plan === 'gain' ? 1.1 : 1;
  const calories = Math.round((maintenance * planFactor) / 10) * 10;
  const ratios =
    plan === 'lose'
      ? { protein: 0.25, fat: 0.3 }
      : plan === 'gain'
        ? { protein: 0.2, fat: 0.25 }
        : { protein: 0.2, fat: 0.3 };
  const protein = Math.round((calories * ratios.protein) / 4);
  const fat = Math.round((calories * ratios.fat) / 9);
  const carbs = Math.round((calories - protein * 4 - fat * 9) / 4);
  return { maintenance, calories, protein, fat, carbs };
}

export class DataError extends Error {
  constructor(
    message: string,
    public status = 400,
  ) {
    super(message);
  }
}

function cleanImage(value: unknown, maximum: number) {
  const image = typeof value === 'string' ? value : '';
  if (!image) return null;
  if (image.length > maximum) throw new DataError('The image is too large.');
  if (!/^data:image\/(?:jpeg|png|webp);base64,[A-Za-z0-9+/=]+$/.test(image))
    throw new DataError('Use a JPEG, PNG, or WebP image.');
  return image;
}

export async function readHouseholdData(user: AuthUser) {
  await ensureDatabase();
  const db = env.DB;
  const since = new Date();
  since.setUTCDate(since.getUTCDate() - 83);
  const [
    currentUser,
    members,
    home,
    nutrition,
    tasks,
    expenses,
    recurringPayments,
    organisers,
    reminders,
    medicationRows,
    medicationDoses,
    purchaseIdeas,
    purchaseVotes,
    messages,
    habits,
    water,
    foods,
    recipeRows,
    ingredientRows,
    weeklyPlan,
    aiConsentCount,
  ] = await Promise.all([
    db
      .prepare(
        'SELECT id,email,display_name AS name,initials,color,avatar_data AS avatar,calorie_goal AS calorieGoal,protein_goal AS proteinGoal,carb_goal AS carbGoal,fat_goal AS fatGoal,water_goal AS waterGoal,maintenance_calories AS maintenanceCalories,height_cm AS heightCm,weight_kg AS weightKg,age,sex,activity,nutrition_plan AS nutritionPlan,diet,ai_consent AS aiConsent FROM users WHERE id=?',
      )
      .bind(user.id)
      .first<AuthUser>(),
    db
      .prepare(
        'SELECT id,display_name AS name,initials,color,avatar_data AS avatar FROM users ORDER BY display_name',
      )
      .all(),
    db
      .prepare(
        'SELECT name,address,photo_data AS photo FROM household_settings WHERE id=1',
      )
      .first(),
    db
      .prepare(
        "SELECT n.id,n.label,n.calories,n.protein,n.carbs,n.fat,n.eaten_on AS eatenOn,n.visibility,(n.user_id=?) AS owned,u.id AS userId,u.display_name AS name,u.initials,u.color,u.avatar_data AS avatar FROM nutrition_entries n JOIN users u ON u.id=n.user_id WHERE n.eaten_on=? AND (n.user_id=? OR n.visibility='shared') ORDER BY n.id DESC",
      )
      .bind(user.id, today(), user.id)
      .all(),
    db
      .prepare(
        "SELECT id,title,status,tag,due,due_on AS dueOn,visibility,(user_id=?) AS owned FROM tasks WHERE user_id=? OR visibility='shared' ORDER BY id DESC",
      )
      .bind(user.id, user.id)
      .all(),
    db
      .prepare(
        "SELECT id,label,amount,category,spent_on AS spentOn,visibility,(user_id=?) AS owned FROM expenses WHERE user_id=? OR visibility='shared' ORDER BY id DESC",
      )
      .bind(user.id, user.id)
      .all(),
    db
      .prepare(
        "SELECT id,kind,label,amount,billing_cycle AS billingCycle,next_due_on AS nextDueOn,remaining_amount AS remainingAmount,active,visibility,(user_id=?) AS owned FROM recurring_payments WHERE user_id=? OR visibility='shared' ORDER BY active DESC,next_due_on,id DESC",
      )
      .bind(user.id, user.id)
      .all(),
    db
      .prepare(
        "SELECT id,list,label,done,visibility,(user_id=?) AS owned FROM organiser_items WHERE user_id=? OR visibility='shared' ORDER BY id DESC",
      )
      .bind(user.id, user.id)
      .all(),
    db
      .prepare(
        "SELECT id,label,remind_at AS remindAt,done,visibility,(user_id=?) AS owned FROM reminders WHERE user_id=? OR visibility='shared' ORDER BY done,remind_at,id DESC",
      )
      .bind(user.id, user.id)
      .all(),
    db
      .prepare(
        "SELECT m.id,m.name,m.dosage,m.instructions,m.schedule_times AS scheduleTimes,m.start_on AS startOn,m.end_on AS endOn,m.active,m.visibility,(m.user_id=?) AS owned,u.display_name AS ownerName FROM medications m JOIN users u ON u.id=m.user_id WHERE m.user_id=? OR m.visibility='shared' ORDER BY m.active DESC,m.name,m.id DESC",
      )
      .bind(user.id, user.id)
      .all(),
    db
      .prepare(
        "SELECT d.id,d.medication_id AS medicationId,d.scheduled_for AS scheduledFor,d.taken_at AS takenAt,u.display_name AS takenByName FROM medication_doses d JOIN medications m ON m.id=d.medication_id JOIN users u ON u.id=d.user_id WHERE (m.user_id=? OR m.visibility='shared') AND d.scheduled_for>=date('now','-14 days') ORDER BY d.scheduled_for DESC",
      )
      .bind(user.id)
      .all(),
    db
      .prepare(
        "SELECT p.id,p.title,p.description,p.estimated_cost AS estimatedCost,p.status,p.created_at AS createdAt,(p.user_id=?) AS owned,u.display_name AS createdByName,u.initials,u.color,u.avatar_data AS avatar FROM purchase_ideas p JOIN users u ON u.id=p.user_id WHERE p.status!='archived' ORDER BY CASE p.status WHEN 'open' THEN 0 ELSE 1 END,p.id DESC",
      )
      .bind(user.id)
      .all(),
    db
      .prepare(
        "SELECT v.id,v.idea_id AS ideaId,v.vote,v.updated_at AS updatedAt,(v.user_id=?) AS mine,u.display_name AS name,u.initials,u.color,u.avatar_data AS avatar FROM purchase_votes v JOIN purchase_ideas p ON p.id=v.idea_id JOIN users u ON u.id=v.user_id WHERE p.status!='archived' ORDER BY v.updated_at,v.id",
      )
      .bind(user.id)
      .all(),
    db
      .prepare(
        'SELECT m.id,m.body,m.created_at AS createdAt,u.display_name AS name,u.initials,u.color,u.avatar_data AS avatar,(m.user_id=?) AS mine FROM messages m JOIN users u ON u.id=m.user_id ORDER BY m.created_at',
      )
      .bind(user.id)
      .all(),
    db
      .prepare(
        'SELECT h.id,h.user_id AS userId,h.habit,h.occurrences,h.cost,h.occurred_on AS occurredOn,h.created_at AS createdAt,u.display_name AS name,u.initials,u.color,u.avatar_data AS avatar,(h.user_id=?) AS mine FROM habit_entries h JOIN users u ON u.id=h.user_id WHERE h.occurred_on>=? ORDER BY h.occurred_on DESC,h.id DESC',
      )
      .bind(user.id, since.toISOString().slice(0, 10))
      .all(),
    db
      .prepare(
        'SELECT id,amount_ml AS amountMl,drunk_on AS drunkOn,created_at AS createdAt FROM water_entries WHERE user_id=? AND drunk_on=? ORDER BY id DESC',
      )
      .bind(user.id, today())
      .all(),
    db
      .prepare(
        'SELECT f.id,f.name,f.normalized_name AS normalizedName,f.quantity,f.unit,f.category,f.expires_on AS expiresOn,f.updated_at AS updatedAt,u.display_name AS updatedByName FROM food_items f JOIN users u ON u.id=f.updated_by ORDER BY CASE WHEN f.expires_on IS NULL THEN 1 ELSE 0 END,f.expires_on,f.name',
      )
      .all(),
    db
      .prepare(
        'SELECT r.id,r.name,r.course,r.servings,r.instructions,r.created_at AS createdAt,u.display_name AS createdByName FROM recipes r JOIN users u ON u.id=r.created_by ORDER BY r.id DESC',
      )
      .all(),
    db
      .prepare(
        'SELECT id,recipe_id AS recipeId,name,normalized_name AS normalizedName,quantity,unit FROM recipe_ingredients ORDER BY id',
      )
      .all(),
    db
      .prepare(
        "SELECT id,week_start AS weekStart,day_index AS dayIndex,course,recipe_id AS recipeId,servings FROM weekly_meal_plan WHERE week_start>=date('now','-14 days') AND week_start<=date('now','+14 days') ORDER BY week_start,day_index,id",
      )
      .all(),
    db.prepare('SELECT COUNT(*) AS count FROM users WHERE ai_consent=1').first<{
      count: number;
    }>(),
  ]);
  const recipes = recipeRows.results.map((recipe) => ({
    ...recipe,
    ingredients: ingredientRows.results.filter(
      (ingredient) =>
        (ingredient as { recipeId: number }).recipeId ===
        (recipe as { id: number }).id,
    ),
  }));
  const medications = medicationRows.results.map((medication) => ({
    ...medication,
    scheduleTimes: JSON.parse(String(medication.scheduleTimes)) as string[],
  }));
  return {
    currentUser: currentUser ?? user,
    members: members.results,
    home: home ?? { name: 'Our home', address: '', photo: null },
    nutrition: nutrition.results,
    tasks: tasks.results,
    expenses: expenses.results,
    recurringPayments: recurringPayments.results,
    organisers: organisers.results,
    reminders: reminders.results,
    medications,
    medicationDoses: medicationDoses.results,
    purchaseIdeas: purchaseIdeas.results,
    purchaseVotes: purchaseVotes.results,
    messages: messages.results,
    habits: habits.results,
    water: water.results,
    foods: foods.results,
    recipes,
    weeklyPlan: weeklyPlan.results,
    aiConfigured: isAiConfigured(),
    aiConsentingMembers: Number(aiConsentCount?.count || 0),
  };
}

export async function writeHouseholdData(userId: number, body: DataAction) {
  await ensureDatabase();
  const db = env.DB;
  const legacyId = String(userId);
  if (body.type === 'nutrition') {
    const label = cleanText(body.label, 80);
    if (!label) throw new DataError('Meal name is required.');
    return db
      .prepare(
        'INSERT INTO nutrition_entries (user_id,member_id,visibility,label,calories,protein,carbs,fat,eaten_on) VALUES (?,?,?,?,?,?,?,?,?)',
      )
      .bind(
        userId,
        legacyId,
        cleanVisibility(body.visibility),
        label,
        cleanNumber(body.calories, 20_000),
        cleanNumber(body.protein, 2_000),
        cleanNumber(body.carbs, 2_000),
        cleanNumber(body.fat, 2_000),
        today(),
      )
      .run();
  }
  if (body.type === 'task') {
    const title = cleanText(body.title, 120);
    if (!title) throw new DataError('Task title is required.');
    const dueOn = cleanPaymentDate(body.dueOn);
    return db
      .prepare(
        'INSERT INTO tasks (user_id,visibility,title,status,assignee_id,tag,due,due_on) VALUES (?,?,?,?,?,?,?,?)',
      )
      .bind(
        userId,
        cleanVisibility(body.visibility),
        title,
        'todo',
        legacyId,
        cleanText(body.tag, 30, 'Home') || 'Home',
        dueOn,
        dueOn,
      )
      .run();
  }
  if (body.type === 'task-status') {
    const status = ['todo', 'progress', 'done'].includes(String(body.status))
      ? String(body.status)
      : 'todo';
    const result = await db
      .prepare('UPDATE tasks SET status=? WHERE id=? AND user_id=?')
      .bind(status, cleanNumber(body.id), userId)
      .run();
    if (!result.meta.changes)
      throw new DataError('That task cannot be changed.', 403);
    return result;
  }
  if (body.type === 'expense') {
    const label = cleanText(body.label, 100);
    const amount = cleanNumber(body.amount);
    if (!label || amount <= 0)
      throw new DataError('Expense name and amount are required.');
    return db
      .prepare(
        'INSERT INTO expenses (user_id,visibility,label,amount,category,paid_by,spent_on) VALUES (?,?,?,?,?,?,?)',
      )
      .bind(
        userId,
        cleanVisibility(body.visibility),
        label,
        amount,
        cleanExpenseCategory(body.category),
        legacyId,
        today(),
      )
      .run();
  }
  if (body.type === 'recurring-payment') {
    const kind = cleanPaymentKind(body.kind);
    const label = cleanText(body.label, 100);
    const amount = cleanNumber(body.amount);
    const billingCycle = body.billingCycle === 'yearly' ? 'yearly' : 'monthly';
    const nextDueOn = cleanPaymentDate(body.nextDueOn);
    const remainingAmount =
      kind === 'loan' && cleanNumber(body.remainingAmount) > 0
        ? cleanNumber(body.remainingAmount)
        : null;
    if (!kind || !label || amount <= 0)
      throw new DataError(
        'Payment name, type, amount, and due date are required.',
      );
    return db
      .prepare(
        'INSERT INTO recurring_payments (user_id,visibility,kind,label,amount,billing_cycle,next_due_on,remaining_amount,active,created_at) VALUES (?,?,?,?,?,?,?,?,1,?)',
      )
      .bind(
        userId,
        cleanVisibility(body.visibility),
        kind,
        label,
        amount,
        billingCycle,
        nextDueOn,
        remainingAmount,
        new Date().toISOString(),
      )
      .run();
  }
  if (body.type === 'recurring-payment-pay') {
    const payment = await db
      .prepare(
        'SELECT id,visibility,kind,label,amount,billing_cycle AS billingCycle,next_due_on AS nextDueOn,remaining_amount AS remainingAmount,active FROM recurring_payments WHERE id=? AND user_id=?',
      )
      .bind(cleanNumber(body.id), userId)
      .first<{
        id: number;
        visibility: string;
        kind: PaymentKind;
        label: string;
        amount: number;
        billingCycle: string;
        nextDueOn: string;
        remainingAmount: number | null;
        active: number;
      }>();
    if (!payment || !payment.active)
      throw new DataError('That payment cannot be recorded.', 403);
    const scheduledAmount = Number(payment.amount);
    const amount =
      payment.kind === 'loan' && payment.remainingAmount !== null
        ? Math.min(scheduledAmount, Number(payment.remainingAmount))
        : scheduledAmount;
    const remainingAmount =
      payment.kind === 'loan' && payment.remainingAmount !== null
        ? Math.max(0, Number(payment.remainingAmount) - amount)
        : payment.remainingAmount;
    const active = remainingAmount !== null && remainingAmount <= 0 ? 0 : 1;
    const category: ExpenseCategory =
      payment.kind === 'subscription'
        ? 'subscriptions'
        : payment.kind === 'loan'
          ? 'loan'
          : 'rent';
    return db.batch([
      db
        .prepare(
          'INSERT INTO expenses (user_id,visibility,label,amount,category,paid_by,spent_on) VALUES (?,?,?,?,?,?,?)',
        )
        .bind(
          userId,
          payment.visibility,
          payment.label,
          amount,
          category,
          legacyId,
          today(),
        ),
      db
        .prepare(
          'UPDATE recurring_payments SET next_due_on=?,remaining_amount=?,active=? WHERE id=? AND user_id=?',
        )
        .bind(
          advancePaymentDate(payment.nextDueOn, payment.billingCycle),
          remainingAmount,
          active,
          payment.id,
          userId,
        ),
    ]);
  }
  if (body.type === 'recurring-payment-toggle') {
    const result = await db
      .prepare(
        'UPDATE recurring_payments SET active=? WHERE id=? AND user_id=?',
      )
      .bind(body.active ? 1 : 0, cleanNumber(body.id), userId)
      .run();
    if (!result.meta.changes)
      throw new DataError('That payment cannot be changed.', 403);
    return result;
  }
  if (body.type === 'organiser') {
    const label = cleanText(body.label, 100);
    const list = cleanText(body.list, 50);
    if (!label || !list)
      throw new DataError('List and item names are required.');
    return db
      .prepare(
        'INSERT INTO organiser_items (user_id,visibility,list,label,done) VALUES (?,?,?,?,0)',
      )
      .bind(userId, cleanVisibility(body.visibility), list, label)
      .run();
  }
  if (body.type === 'organiser-toggle') {
    const result = await db
      .prepare('UPDATE organiser_items SET done=? WHERE id=? AND user_id=?')
      .bind(body.done ? 1 : 0, cleanNumber(body.id), userId)
      .run();
    if (!result.meta.changes)
      throw new DataError('That item cannot be changed.', 403);
    return result;
  }
  if (body.type === 'reminder') {
    const label = cleanText(body.label, 120);
    const remindAt = cleanDateTime(body.remindAt);
    if (!label) throw new DataError('Reminder name is required.');
    return db
      .prepare(
        'INSERT INTO reminders (user_id,visibility,label,remind_at,done,created_at) VALUES (?,?,?,?,0,?)',
      )
      .bind(
        userId,
        cleanVisibility(body.visibility),
        label,
        remindAt,
        new Date().toISOString(),
      )
      .run();
  }
  if (body.type === 'reminder-toggle') {
    const result = await db
      .prepare('UPDATE reminders SET done=? WHERE id=? AND user_id=?')
      .bind(body.done ? 1 : 0, cleanNumber(body.id), userId)
      .run();
    if (!result.meta.changes)
      throw new DataError('That reminder cannot be changed.', 403);
    return result;
  }
  if (body.type === 'medication') {
    const name = cleanText(body.name, 100);
    const dosage = cleanText(body.dosage, 80);
    const instructions = cleanText(body.instructions, 500);
    const scheduleTimes = cleanMedicationTimes(body.scheduleTimes);
    const startOn = cleanPaymentDate(body.startOn);
    const endOn = cleanOptionalDate(body.endOn);
    if (!name || !dosage)
      throw new DataError('Medication name and dosage are required.');
    if (endOn && endOn < startOn)
      throw new DataError('Medication end date cannot be before its start.');
    return db
      .prepare(
        'INSERT INTO medications (user_id,visibility,name,dosage,instructions,schedule_times,start_on,end_on,active,created_at) VALUES (?,?,?,?,?,?,?,?,1,?)',
      )
      .bind(
        userId,
        cleanVisibility(body.visibility),
        name,
        dosage,
        instructions,
        JSON.stringify(scheduleTimes),
        startOn,
        endOn,
        new Date().toISOString(),
      )
      .run();
  }
  if (body.type === 'medication-toggle') {
    const result = await db
      .prepare('UPDATE medications SET active=? WHERE id=? AND user_id=?')
      .bind(body.active ? 1 : 0, cleanNumber(body.id), userId)
      .run();
    if (!result.meta.changes)
      throw new DataError('That medication cannot be changed.', 403);
    return result;
  }
  if (body.type === 'medication-dose') {
    const medicationId = cleanNumber(body.id);
    const scheduledFor = cleanDateTime(body.scheduledFor);
    const medication = await db
      .prepare(
        'SELECT id FROM medications WHERE id=? AND user_id=? AND active=1',
      )
      .bind(medicationId, userId)
      .first();
    if (!medication)
      throw new DataError('That medication cannot be changed.', 403);
    return db
      .prepare(
        'INSERT OR IGNORE INTO medication_doses (medication_id,user_id,scheduled_for,taken_at) VALUES (?,?,?,?)',
      )
      .bind(medicationId, userId, scheduledFor, new Date().toISOString())
      .run();
  }
  if (body.type === 'purchase-idea') {
    const title = cleanText(body.title, 100);
    const description = cleanText(body.description, 800);
    const estimatedCost = cleanNumber(body.estimatedCost);
    if (!title) throw new DataError('Purchase idea name is required.');
    return db
      .prepare(
        "INSERT INTO purchase_ideas (user_id,title,description,estimated_cost,status,created_at) VALUES (?,?,?,?, 'open',?)",
      )
      .bind(
        userId,
        title,
        description,
        estimatedCost > 0 ? estimatedCost : null,
        new Date().toISOString(),
      )
      .run();
  }
  if (body.type === 'purchase-vote') {
    const ideaId = cleanNumber(body.id);
    const vote = Number(body.vote);
    const idea = await db
      .prepare("SELECT id FROM purchase_ideas WHERE id=? AND status='open'")
      .bind(ideaId)
      .first();
    if (!idea) throw new DataError('That purchase idea is closed.', 403);
    if (vote === 0)
      return db
        .prepare('DELETE FROM purchase_votes WHERE idea_id=? AND user_id=?')
        .bind(ideaId, userId)
        .run();
    if (vote !== 1 && vote !== -1)
      throw new DataError('Choose a vote for or against this purchase.');
    const now = new Date().toISOString();
    return db
      .prepare(
        'INSERT INTO purchase_votes (idea_id,user_id,vote,created_at,updated_at) VALUES (?,?,?,?,?) ON CONFLICT(idea_id,user_id) DO UPDATE SET vote=excluded.vote,updated_at=excluded.updated_at',
      )
      .bind(ideaId, userId, vote, now, now)
      .run();
  }
  if (body.type === 'purchase-status') {
    const status = ['open', 'bought', 'archived'].includes(String(body.status))
      ? String(body.status)
      : null;
    if (!status) throw new DataError('Choose a valid purchase status.');
    const result = await db
      .prepare('UPDATE purchase_ideas SET status=? WHERE id=? AND user_id=?')
      .bind(status, cleanNumber(body.id), userId)
      .run();
    if (!result.meta.changes)
      throw new DataError('That purchase idea cannot be changed.', 403);
    return result;
  }
  if (body.type === 'message') {
    const message = cleanText(body.body, 2_000);
    if (!message) throw new DataError('Message cannot be empty.');
    return db
      .prepare(
        'INSERT INTO messages (user_id,member_id,body,created_at) VALUES (?,?,?,?)',
      )
      .bind(userId, legacyId, message, new Date().toISOString())
      .run();
  }
  if (body.type === 'home') {
    const name = cleanText(body.name, 60);
    const address = cleanText(body.address, 180);
    if (!name) throw new DataError('Home name is required.');
    if (typeof body.photo === 'string')
      return db
        .prepare(
          'UPDATE household_settings SET name=?,address=?,photo_data=?,updated_at=?,updated_by=? WHERE id=1',
        )
        .bind(
          name,
          address,
          cleanImage(body.photo, 1_200_000),
          new Date().toISOString(),
          userId,
        )
        .run();
    return db
      .prepare(
        'UPDATE household_settings SET name=?,address=?,updated_at=?,updated_by=? WHERE id=1',
      )
      .bind(name, address, new Date().toISOString(), userId)
      .run();
  }
  if (body.type === 'avatar')
    return db
      .prepare('UPDATE users SET avatar_data=? WHERE id=?')
      .bind(cleanImage(body.avatar, 450_000), userId)
      .run();
  if (body.type === 'ai-consent')
    return db
      .prepare('UPDATE users SET ai_consent=? WHERE id=?')
      .bind(body.enabled ? 1 : 0, userId)
      .run();
  if (body.type === 'habit') {
    const habit =
      body.habit === 'alcohol'
        ? 'alcohol'
        : body.habit === 'vaping'
          ? 'vaping'
          : null;
    if (!habit) throw new DataError('Choose vaping or alcohol.');
    const occurrences = Math.max(
      1,
      Math.round(cleanNumber(body.occurrences, 1_000)),
    );
    const cost = cleanNumber(body.cost);
    const occurredOn = cleanDate(body.occurredOn);
    return db
      .prepare(
        'INSERT INTO habit_entries (user_id,habit,occurrences,cost,occurred_on,created_at) VALUES (?,?,?,?,?,?)',
      )
      .bind(
        userId,
        habit,
        occurrences,
        cost,
        occurredOn,
        new Date().toISOString(),
      )
      .run();
  }
  if (body.type === 'water') {
    const amountMl = Math.round(cleanNumber(body.amountMl, 10_000));
    if (amountMl < 1) throw new DataError('Water amount is required.');
    return db
      .prepare(
        'INSERT INTO water_entries (user_id,amount_ml,drunk_on,created_at) VALUES (?,?,?,?)',
      )
      .bind(userId, amountMl, cleanDate(body.drunkOn), new Date().toISOString())
      .run();
  }
  if (body.type === 'water-goal') {
    const goal = Math.round(cleanNumber(body.waterGoal, 10_000));
    if (goal < 250) throw new DataError('Water goal must be at least 250 ml.');
    return db
      .prepare('UPDATE users SET water_goal=? WHERE id=?')
      .bind(goal, userId)
      .run();
  }
  if (body.type === 'nutrition-profile') {
    const sex = body.sex === 'male' || body.sex === 'female' ? body.sex : null;
    const activity = ['inactive', 'low', 'active', 'very'].includes(
      String(body.activity),
    )
      ? (body.activity as NutritionActivity)
      : null;
    const plan = ['lose', 'maintain', 'gain'].includes(String(body.plan))
      ? (body.plan as NutritionPlan)
      : null;
    const diet = ['omnivore', 'vegetarian', 'vegan'].includes(String(body.diet))
      ? String(body.diet)
      : null;
    const age = Math.round(cleanNumber(body.age, 100));
    const heightCm = Math.round(cleanNumber(body.heightCm, 250) * 10) / 10;
    const weightKg = Math.round(cleanNumber(body.weightKg, 350) * 10) / 10;
    if (
      !sex ||
      !activity ||
      !plan ||
      !diet ||
      age < 19 ||
      heightCm < 120 ||
      weightKg < 35
    )
      throw new DataError('Enter valid adult profile details.');
    const goals = calculateNutrition(
      sex,
      activity,
      plan,
      age,
      heightCm,
      weightKg,
    );
    return db
      .prepare(
        'UPDATE users SET height_cm=?,weight_kg=?,age=?,sex=?,activity=?,nutrition_plan=?,diet=?,maintenance_calories=?,calorie_goal=?,protein_goal=?,carb_goal=?,fat_goal=? WHERE id=?',
      )
      .bind(
        heightCm,
        weightKg,
        age,
        sex,
        activity,
        plan,
        diet,
        goals.maintenance,
        goals.calories,
        goals.protein,
        goals.carbs,
        goals.fat,
        userId,
      )
      .run();
  }
  if (body.type === 'food-add') {
    const name = cleanText(body.name, 80);
    const quantity =
      Math.round(cleanNumber(body.quantity, 1_000_000) * 100) / 100;
    const unit = cleanFoodUnit(body.unit);
    const category = cleanText(body.category, 40, 'Other') || 'Other';
    if (!name || quantity <= 0 || !unit)
      throw new DataError('Food name, quantity, and unit are required.');
    return db
      .prepare(
        'INSERT INTO food_items (name,normalized_name,quantity,unit,category,expires_on,updated_by,updated_at) VALUES (?,?,?,?,?,?,?,?)',
      )
      .bind(
        name,
        normalizeFoodName(name),
        quantity,
        unit,
        category,
        cleanOptionalDate(body.expiresOn),
        userId,
        new Date().toISOString(),
      )
      .run();
  }
  if (body.type === 'food-adjust') {
    const delta = Math.max(
      -1_000_000,
      Math.min(1_000_000, Number(body.delta) || 0),
    );
    if (!delta) throw new DataError('Quantity change is required.');
    const result = await db
      .prepare(
        'UPDATE food_items SET quantity=MAX(0,quantity+?),updated_by=?,updated_at=? WHERE id=?',
      )
      .bind(delta, userId, new Date().toISOString(), cleanNumber(body.id))
      .run();
    if (!result.meta.changes)
      throw new DataError('Food item was not found.', 404);
    return result;
  }
  if (body.type === 'food-remove') {
    const result = await db
      .prepare('DELETE FROM food_items WHERE id=?')
      .bind(cleanNumber(body.id))
      .run();
    if (!result.meta.changes)
      throw new DataError('Food item was not found.', 404);
    return result;
  }
  if (body.type === 'recipe-add') {
    const name = cleanText(body.name, 100);
    const course = cleanRecipeCourse(body.course);
    const servings = Math.max(1, Math.round(cleanNumber(body.servings, 100)));
    const instructions = cleanText(body.instructions, 5_000);
    const rawIngredients = Array.isArray(body.ingredients)
      ? body.ingredients
      : [];
    if (
      !name ||
      !course ||
      !rawIngredients.length ||
      rawIngredients.length > 30
    )
      throw new DataError(
        'Recipe name, course, and 1–30 ingredients are required.',
      );
    const ingredients = rawIngredients.map((item) => {
      const record =
        item && typeof item === 'object'
          ? (item as Record<string, unknown>)
          : {};
      const ingredientName = cleanText(record.name, 80);
      const quantity =
        Math.round(cleanNumber(record.quantity, 1_000_000) * 100) / 100;
      const unit = cleanFoodUnit(record.unit);
      if (!ingredientName || quantity <= 0 || !unit)
        throw new DataError(
          'Every ingredient needs a name, quantity, and unit.',
        );
      return {
        name: ingredientName,
        normalizedName: normalizeFoodName(ingredientName),
        quantity,
        unit,
      };
    });
    const result = await db
      .prepare(
        'INSERT INTO recipes (name,course,servings,instructions,created_by,created_at) VALUES (?,?,?,?,?,?)',
      )
      .bind(
        name,
        course,
        servings,
        instructions,
        userId,
        new Date().toISOString(),
      )
      .run();
    const recipeId = Number(result.meta.last_row_id);
    await db.batch(
      ingredients.map((item) =>
        db
          .prepare(
            'INSERT INTO recipe_ingredients (recipe_id,name,normalized_name,quantity,unit) VALUES (?,?,?,?,?)',
          )
          .bind(
            recipeId,
            item.name,
            item.normalizedName,
            item.quantity,
            item.unit,
          ),
      ),
    );
    return result;
  }
  if (body.type === 'ai-plan-apply') {
    const weekStart = cleanOptionalDate(body.weekStart);
    const proposal =
      body.proposal && typeof body.proposal === 'object'
        ? (body.proposal as Record<string, unknown>)
        : {};
    const rawRecipes = Array.isArray(proposal.recipes) ? proposal.recipes : [];
    const rawSchedule = Array.isArray(proposal.schedule)
      ? proposal.schedule
      : [];
    if (
      !weekStart ||
      rawRecipes.length < 1 ||
      rawRecipes.length > 42 ||
      rawSchedule.length < 1 ||
      rawSchedule.length > 42
    )
      throw new DataError('The AI meal plan is incomplete.');
    const existingRows = await db
      .prepare('SELECT id,course FROM recipes')
      .all<{ id: number; course: string }>();
    const existingCourse = new Map(
      existingRows.results.map((recipe) => [recipe.id, recipe.course]),
    );
    const preparedRecipes = rawRecipes.map((item) => {
      const record =
        item && typeof item === 'object'
          ? (item as Record<string, unknown>)
          : {};
      const key = cleanText(record.key, 80);
      const name = cleanText(record.name, 100);
      const course = cleanRecipeCourse(record.course);
      const instructions = cleanText(record.instructions, 5_000);
      const sourceRecipeId = Math.round(cleanNumber(record.sourceRecipeId));
      const rawIngredients = Array.isArray(record.ingredients)
        ? record.ingredients
        : [];
      const ingredients = rawIngredients.map((ingredient) => {
        const ingredientRecord =
          ingredient && typeof ingredient === 'object'
            ? (ingredient as Record<string, unknown>)
            : {};
        const ingredientName = cleanText(ingredientRecord.name, 80);
        const quantity =
          Math.round(cleanNumber(ingredientRecord.quantity, 1_000_000) * 100) /
          100;
        const unit = cleanFoodUnit(ingredientRecord.unit);
        if (!ingredientName || quantity <= 0 || !unit)
          throw new DataError('An AI recipe contains an invalid ingredient.');
        return {
          name: ingredientName,
          normalizedName: normalizeFoodName(ingredientName),
          quantity,
          unit,
        };
      });
      if (
        !key ||
        !name ||
        !course ||
        ingredients.length < 1 ||
        ingredients.length > 30 ||
        (sourceRecipeId > 0 && existingCourse.get(sourceRecipeId) !== course)
      )
        throw new DataError('An AI recipe is invalid or no longer available.');
      return {
        key,
        name,
        course,
        instructions,
        sourceRecipeId,
        ingredients,
      };
    });
    if (
      new Set(preparedRecipes.map((recipe) => recipe.key)).size !==
      preparedRecipes.length
    )
      throw new DataError('AI recipe keys must be unique.');
    const recipeByKey = new Map(
      preparedRecipes.map((recipe) => [recipe.key, recipe]),
    );
    const preparedSchedule = rawSchedule.map((item) => {
      const record =
        item && typeof item === 'object'
          ? (item as Record<string, unknown>)
          : {};
      const dayIndex = Number(record.dayIndex);
      const course = cleanRecipeCourse(record.course);
      const recipeKey = cleanText(record.recipeKey, 80);
      const recipe = recipeByKey.get(recipeKey);
      if (
        !Number.isInteger(dayIndex) ||
        dayIndex < 0 ||
        dayIndex > 6 ||
        !course ||
        !recipe ||
        recipe.course !== course
      )
        throw new DataError('The AI schedule contains an invalid meal.');
      return { dayIndex, course, recipeKey };
    });
    if (
      new Set(preparedSchedule.map((meal) => `${meal.dayIndex}:${meal.course}`))
        .size !== preparedSchedule.length
    )
      throw new DataError('The AI schedule contains duplicate meals.');
    const recipeIds = new Map<string, number>();
    const now = new Date().toISOString();
    for (const recipe of preparedRecipes) {
      if (recipe.sourceRecipeId > 0) {
        recipeIds.set(recipe.key, recipe.sourceRecipeId);
        continue;
      }
      const result = await db
        .prepare(
          'INSERT INTO recipes (name,course,servings,instructions,created_by,created_at) VALUES (?,?,3,?,?,?)',
        )
        .bind(recipe.name, recipe.course, recipe.instructions, userId, now)
        .run();
      const recipeId = Number(result.meta.last_row_id);
      recipeIds.set(recipe.key, recipeId);
      await db.batch(
        recipe.ingredients.map((ingredient) =>
          db
            .prepare(
              'INSERT INTO recipe_ingredients (recipe_id,name,normalized_name,quantity,unit) VALUES (?,?,?,?,?)',
            )
            .bind(
              recipeId,
              ingredient.name,
              ingredient.normalizedName,
              ingredient.quantity,
              ingredient.unit,
            ),
        ),
      );
    }
    return db.batch([
      db
        .prepare('DELETE FROM weekly_meal_plan WHERE week_start=?')
        .bind(weekStart),
      ...preparedSchedule.map((meal) =>
        db
          .prepare(
            'INSERT INTO weekly_meal_plan (week_start,day_index,course,recipe_id,servings,created_by,created_at) VALUES (?,?,?,?,3,?,?)',
          )
          .bind(
            weekStart,
            meal.dayIndex,
            meal.course,
            recipeIds.get(meal.recipeKey),
            userId,
            now,
          ),
      ),
    ]);
  }
  if (body.type === 'meal-plan-save') {
    const weekStart = cleanOptionalDate(body.weekStart);
    const rawEntries = Array.isArray(body.entries) ? body.entries : [];
    if (!weekStart || rawEntries.length > 42)
      throw new DataError('Choose a valid week with no more than 42 meals.');
    const recipeRows = await db
      .prepare('SELECT id,course FROM recipes')
      .all<{ id: number; course: string }>();
    const recipeCourseById = new Map(
      recipeRows.results.map((recipe) => [recipe.id, recipe.course]),
    );
    const entries = rawEntries.map((item) => {
      const record =
        item && typeof item === 'object'
          ? (item as Record<string, unknown>)
          : {};
      const recipeId = Math.round(cleanNumber(record.recipeId));
      const dayIndex = Number(record.dayIndex);
      const course = cleanRecipeCourse(record.course);
      if (
        !recipeId ||
        !Number.isInteger(dayIndex) ||
        dayIndex < 0 ||
        dayIndex > 6 ||
        !course ||
        recipeCourseById.get(recipeId) !== course
      )
        throw new DataError('Every planned meal must reference its recipe.');
      return { recipeId, dayIndex, course };
    });
    const now = new Date().toISOString();
    return db.batch([
      db
        .prepare('DELETE FROM weekly_meal_plan WHERE week_start=?')
        .bind(weekStart),
      ...entries.map((entry) =>
        db
          .prepare(
            'INSERT INTO weekly_meal_plan (week_start,day_index,course,recipe_id,servings,created_by,created_at) VALUES (?,?,?,?,3,?,?)',
          )
          .bind(
            weekStart,
            entry.dayIndex,
            entry.course,
            entry.recipeId,
            userId,
            now,
          ),
      ),
    ]);
  }
  if (body.type === 'recipe-remove') {
    const recipeId = cleanNumber(body.id);
    const recipe = await db
      .prepare('SELECT id FROM recipes WHERE id=?')
      .bind(recipeId)
      .first();
    if (!recipe) throw new DataError('Recipe was not found.', 404);
    return db.batch([
      db
        .prepare('DELETE FROM weekly_meal_plan WHERE recipe_id=?')
        .bind(recipeId),
      db
        .prepare('DELETE FROM recipe_ingredients WHERE recipe_id=?')
        .bind(recipeId),
      db.prepare('DELETE FROM recipes WHERE id=?').bind(recipeId),
    ]);
  }
  throw new DataError('Unknown data action.');
}
