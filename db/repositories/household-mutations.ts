import { env } from 'cloudflare:workers';
import { ensureDatabase } from '../setup';
import { foodActionTypes, writeFoodData } from './food-mutations';
import { validateDataImage } from '@/lib/image-data';
import {
  advancePaymentDate,
  calculateNutrition,
  type BillingCycle,
  type NutritionActivity,
  type NutritionPlan,
} from '@/lib/household-calculations';
import {
  DataError,
  cleanDate,
  cleanDateTime,
  cleanExpenseCategory,
  cleanMedicationTimes,
  cleanNumber,
  cleanOptionalDate,
  cleanPaymentDate,
  cleanPaymentKind,
  cleanText,
  cleanVisibility,
  today,
  type DataAction,
  type ExpenseCategory,
  type PaymentKind,
} from '../services/data-validation';

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
        billingCycle: BillingCycle;
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
          validateDataImage(body.photo, {
            maximumBytes: 900_000,
            maximumWidth: 2400,
            maximumHeight: 1600,
            maximumPixels: 3_840_000,
          }),
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
      .bind(
        validateDataImage(body.avatar, {
          maximumBytes: 320_000,
          maximumWidth: 1024,
          maximumHeight: 1024,
          maximumPixels: 1_048_576,
        }),
        userId,
      )
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
  if (foodActionTypes.has(String(body.type)))
    return writeFoodData(userId, body);
  throw new DataError('Unknown data action.', 400, 'unknown_action');
}
