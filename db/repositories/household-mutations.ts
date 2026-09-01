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
import { advanceReminderDate, type ReminderRecurrence } from '@/lib/reminders';
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
  cleanReminderRecurrence,
  cleanText,
  cleanVisibility,
  today,
  type DataAction,
  type ExpenseCategory,
  type PaymentKind,
} from '../services/data-validation';

async function cleanTaskFields(
  db: D1Database,
  userId: number,
  body: DataAction,
) {
  const title = cleanText(body.title, 120);
  if (!title) throw new DataError('Task title is required.');
  const visibility = cleanVisibility(body.visibility);
  const assigneeId = cleanNumber(body.assigneeId || userId);
  const assignee = await db
    .prepare('SELECT id FROM users WHERE id=? AND deleted_at IS NULL')
    .bind(assigneeId)
    .first<{ id: number }>();
  if (!assignee) throw new DataError('Choose a household member.');
  if (assigneeId !== userId && visibility !== 'shared')
    throw new DataError('A task assigned to a housemate must be shared.');
  const dueOn = cleanPaymentDate(body.dueOn);
  return {
    title,
    visibility,
    assigneeId: String(assigneeId),
    tag: cleanText(body.tag, 30, 'Home') || 'Home',
    dueOn,
  };
}

function cleanExpenseFields(body: DataAction) {
  const label = cleanText(body.label, 100);
  const amount = cleanNumber(body.amount);
  if (!label || amount <= 0)
    throw new DataError('Expense name and amount are required.');
  return {
    label,
    amount,
    category: cleanExpenseCategory(body.category),
    spentOn: cleanDate(body.spentOn),
    visibility: cleanVisibility(body.visibility),
  };
}

function cleanNutritionFields(body: DataAction) {
  const label = cleanText(body.label, 80);
  if (!label) throw new DataError('Meal name is required.');
  return {
    label,
    calories: cleanNumber(body.calories, 20_000),
    protein: cleanNumber(body.protein, 2_000),
    carbs: cleanNumber(body.carbs, 2_000),
    fat: cleanNumber(body.fat, 2_000),
    eatenOn: cleanDate(body.eatenOn),
    visibility: cleanVisibility(body.visibility),
  };
}

function optionalCount(value: unknown, maximum = 100_000) {
  if (value === null || value === undefined || value === '') return null;
  return Math.round(cleanNumber(value, maximum));
}

function cleanMedicationFields(body: DataAction) {
  const name = cleanText(body.name, 100);
  const dosage = cleanText(body.dosage, 80);
  const instructions = cleanText(body.instructions, 500);
  const scheduleTimes = cleanMedicationTimes(body.scheduleTimes);
  const startOn = cleanPaymentDate(body.startOn);
  const endOn = cleanOptionalDate(body.endOn);
  const supplyRemaining = optionalCount(body.supplyRemaining);
  const refillThreshold =
    supplyRemaining === null
      ? null
      : (optionalCount(body.refillThreshold) ?? 0);
  if (!name || !dosage)
    throw new DataError('Medication name and dosage are required.');
  if (endOn && endOn < startOn)
    throw new DataError('Medication end date cannot be before its start.');
  return {
    name,
    dosage,
    instructions,
    scheduleTimes,
    startOn,
    endOn,
    supplyRemaining,
    refillThreshold,
    visibility: cleanVisibility(body.visibility),
  };
}

function cleanRecurringPaymentFields(body: DataAction) {
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
  return {
    kind,
    label,
    amount,
    billingCycle,
    nextDueOn,
    remainingAmount,
    visibility: cleanVisibility(body.visibility),
  };
}

export async function writeHouseholdData(userId: number, body: DataAction) {
  await ensureDatabase();
  const db = env.DB;
  const legacyId = String(userId);
  if (body.type === 'nutrition') {
    const meal = cleanNutritionFields(body);
    return db
      .prepare(
        'INSERT INTO nutrition_entries (user_id,member_id,visibility,label,calories,protein,carbs,fat,eaten_on) VALUES (?,?,?,?,?,?,?,?,?)',
      )
      .bind(
        userId,
        legacyId,
        meal.visibility,
        meal.label,
        meal.calories,
        meal.protein,
        meal.carbs,
        meal.fat,
        meal.eatenOn,
      )
      .run();
  }
  if (body.type === 'nutrition-update') {
    const meal = cleanNutritionFields(body);
    const result = await db
      .prepare(
        'UPDATE nutrition_entries SET visibility=?,label=?,calories=?,protein=?,carbs=?,fat=?,eaten_on=? WHERE id=? AND user_id=?',
      )
      .bind(
        meal.visibility,
        meal.label,
        meal.calories,
        meal.protein,
        meal.carbs,
        meal.fat,
        meal.eatenOn,
        cleanNumber(body.id),
        userId,
      )
      .run();
    if (!result.meta.changes)
      throw new DataError('That meal cannot be changed.', 403);
    return result;
  }
  if (body.type === 'nutrition-remove') {
    const result = await db
      .prepare('DELETE FROM nutrition_entries WHERE id=? AND user_id=?')
      .bind(cleanNumber(body.id), userId)
      .run();
    if (!result.meta.changes)
      throw new DataError('That meal cannot be removed.', 403);
    return result;
  }
  if (body.type === 'task') {
    const task = await cleanTaskFields(db, userId, body);
    return db
      .prepare(
        'INSERT INTO tasks (user_id,visibility,title,status,assignee_id,tag,due,due_on) VALUES (?,?,?,?,?,?,?,?)',
      )
      .bind(
        userId,
        task.visibility,
        task.title,
        'todo',
        task.assigneeId,
        task.tag,
        task.dueOn,
        task.dueOn,
      )
      .run();
  }
  if (body.type === 'task-update') {
    const task = await cleanTaskFields(db, userId, body);
    const result = await db
      .prepare(
        'UPDATE tasks SET visibility=?,title=?,assignee_id=?,tag=?,due=?,due_on=? WHERE id=? AND user_id=?',
      )
      .bind(
        task.visibility,
        task.title,
        task.assigneeId,
        task.tag,
        task.dueOn,
        task.dueOn,
        cleanNumber(body.id),
        userId,
      )
      .run();
    if (!result.meta.changes)
      throw new DataError('That task cannot be changed.', 403);
    return result;
  }
  if (body.type === 'task-remove') {
    const result = await db
      .prepare('DELETE FROM tasks WHERE id=? AND user_id=?')
      .bind(cleanNumber(body.id), userId)
      .run();
    if (!result.meta.changes)
      throw new DataError('That task cannot be removed.', 403);
    return result;
  }
  if (body.type === 'task-status') {
    const status = ['todo', 'progress', 'done'].includes(String(body.status))
      ? String(body.status)
      : 'todo';
    const result = await db
      .prepare(
        "UPDATE tasks SET status=? WHERE id=? AND (user_id=? OR (visibility='shared' AND assignee_id=?))",
      )
      .bind(status, cleanNumber(body.id), userId, legacyId)
      .run();
    if (!result.meta.changes)
      throw new DataError('That task cannot be changed.', 403);
    return result;
  }
  if (body.type === 'expense') {
    const expense = cleanExpenseFields(body);
    return db
      .prepare(
        'INSERT INTO expenses (user_id,visibility,label,amount,category,paid_by,spent_on) VALUES (?,?,?,?,?,?,?)',
      )
      .bind(
        userId,
        expense.visibility,
        expense.label,
        expense.amount,
        expense.category,
        legacyId,
        expense.spentOn,
      )
      .run();
  }
  if (body.type === 'expense-update') {
    const expense = cleanExpenseFields(body);
    const result = await db
      .prepare(
        'UPDATE expenses SET visibility=?,label=?,amount=?,category=?,spent_on=? WHERE id=? AND user_id=?',
      )
      .bind(
        expense.visibility,
        expense.label,
        expense.amount,
        expense.category,
        expense.spentOn,
        cleanNumber(body.id),
        userId,
      )
      .run();
    if (!result.meta.changes)
      throw new DataError('That expense cannot be changed.', 403);
    return result;
  }
  if (body.type === 'expense-remove') {
    const result = await db
      .prepare('DELETE FROM expenses WHERE id=? AND user_id=?')
      .bind(cleanNumber(body.id), userId)
      .run();
    if (!result.meta.changes)
      throw new DataError('That expense cannot be removed.', 403);
    return result;
  }
  if (body.type === 'recurring-payment') {
    const payment = cleanRecurringPaymentFields(body);
    return db
      .prepare(
        'INSERT INTO recurring_payments (user_id,visibility,kind,label,amount,billing_cycle,next_due_on,remaining_amount,active,created_at) VALUES (?,?,?,?,?,?,?,?,1,?)',
      )
      .bind(
        userId,
        payment.visibility,
        payment.kind,
        payment.label,
        payment.amount,
        payment.billingCycle,
        payment.nextDueOn,
        payment.remainingAmount,
        new Date().toISOString(),
      )
      .run();
  }
  if (body.type === 'recurring-payment-update') {
    const payment = cleanRecurringPaymentFields(body);
    const result = await db
      .prepare(
        'UPDATE recurring_payments SET visibility=?,kind=?,label=?,amount=?,billing_cycle=?,next_due_on=?,remaining_amount=? WHERE id=? AND user_id=?',
      )
      .bind(
        payment.visibility,
        payment.kind,
        payment.label,
        payment.amount,
        payment.billingCycle,
        payment.nextDueOn,
        payment.remainingAmount,
        cleanNumber(body.id),
        userId,
      )
      .run();
    if (!result.meta.changes)
      throw new DataError('That payment cannot be changed.', 403);
    return result;
  }
  if (body.type === 'recurring-payment-remove') {
    const result = await db
      .prepare('DELETE FROM recurring_payments WHERE id=? AND user_id=?')
      .bind(cleanNumber(body.id), userId)
      .run();
    if (!result.meta.changes)
      throw new DataError('That payment cannot be removed.', 403);
    return result;
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
          'INSERT INTO expenses (user_id,visibility,label,amount,category,paid_by,spent_on,recurring_payment_id) VALUES (?,?,?,?,?,?,?,?)',
        )
        .bind(
          userId,
          payment.visibility,
          payment.label,
          amount,
          category,
          legacyId,
          today(),
          payment.id,
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
  if (body.type === 'spending-budget') {
    const requestedCategory = cleanText(body.category, 30);
    const category =
      requestedCategory === 'all'
        ? 'all'
        : cleanExpenseCategory(requestedCategory);
    const monthlyLimit = cleanNumber(body.monthlyLimit);
    if (monthlyLimit <= 0)
      throw new DataError('Enter a monthly budget greater than zero.');
    return db
      .prepare(
        'INSERT INTO spending_budgets (user_id,category,monthly_limit,updated_at) VALUES (?,?,?,?) ON CONFLICT(user_id,category) DO UPDATE SET monthly_limit=excluded.monthly_limit,updated_at=excluded.updated_at',
      )
      .bind(userId, category, monthlyLimit, new Date().toISOString())
      .run();
  }
  if (body.type === 'spending-budget-remove') {
    const result = await db
      .prepare('DELETE FROM spending_budgets WHERE id=? AND user_id=?')
      .bind(cleanNumber(body.id), userId)
      .run();
    if (!result.meta.changes)
      throw new DataError('That budget cannot be removed.', 403);
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
  if (body.type === 'organiser-update') {
    const itemId = cleanNumber(body.id);
    const label = cleanText(body.label, 100);
    const list = cleanText(body.list, 50);
    if (!label || !list)
      throw new DataError('List and item names are required.');
    const result = await db
      .prepare(
        'UPDATE organiser_items SET list=?,label=?,visibility=? WHERE id=? AND user_id=?',
      )
      .bind(list, label, cleanVisibility(body.visibility), itemId, userId)
      .run();
    if (!result.meta.changes)
      throw new DataError('That item cannot be changed.', 403);
    return result;
  }
  if (body.type === 'organiser-remove') {
    const result = await db
      .prepare('DELETE FROM organiser_items WHERE id=? AND user_id=?')
      .bind(cleanNumber(body.id), userId)
      .run();
    if (!result.meta.changes)
      throw new DataError('That item cannot be removed.', 403);
    return result;
  }
  if (body.type === 'reminder') {
    const label = cleanText(body.label, 120);
    const remindAt = cleanDateTime(body.remindAt);
    const recurrence = cleanReminderRecurrence(body.recurrence);
    if (!label) throw new DataError('Reminder name is required.');
    return db
      .prepare(
        'INSERT INTO reminders (user_id,visibility,label,remind_at,recurrence,done,created_at) VALUES (?,?,?,?,?,0,?)',
      )
      .bind(
        userId,
        cleanVisibility(body.visibility),
        label,
        remindAt,
        recurrence,
        new Date().toISOString(),
      )
      .run();
  }
  if (body.type === 'reminder-toggle') {
    const reminderId = cleanNumber(body.id);
    const reminder = await db
      .prepare(
        'SELECT id,remind_at AS remindAt,recurrence FROM reminders WHERE id=? AND user_id=?',
      )
      .bind(reminderId, userId)
      .first<{
        id: number;
        remindAt: string;
        recurrence: ReminderRecurrence;
      }>();
    if (!reminder) throw new DataError('That reminder cannot be changed.', 403);
    if (body.done && reminder.recurrence !== 'none')
      return db
        .prepare(
          'UPDATE reminders SET remind_at=?,done=0 WHERE id=? AND user_id=?',
        )
        .bind(
          advanceReminderDate(reminder.remindAt, reminder.recurrence),
          reminderId,
          userId,
        )
        .run();
    const result = await db
      .prepare('UPDATE reminders SET done=? WHERE id=? AND user_id=?')
      .bind(body.done ? 1 : 0, reminderId, userId)
      .run();
    if (!result.meta.changes)
      throw new DataError('That reminder cannot be changed.', 403);
    return result;
  }
  if (body.type === 'reminder-update') {
    const reminderId = cleanNumber(body.id);
    const label = cleanText(body.label, 120);
    const remindAt = cleanDateTime(body.remindAt);
    if (!label) throw new DataError('Reminder name is required.');
    const result = await db
      .prepare(
        'UPDATE reminders SET label=?,remind_at=?,recurrence=?,visibility=? WHERE id=? AND user_id=?',
      )
      .bind(
        label,
        remindAt,
        cleanReminderRecurrence(body.recurrence),
        cleanVisibility(body.visibility),
        reminderId,
        userId,
      )
      .run();
    if (!result.meta.changes)
      throw new DataError('That reminder cannot be changed.', 403);
    return result;
  }
  if (body.type === 'reminder-snooze') {
    const minutes = cleanNumber(body.minutes, 1_440);
    if (![15, 60, 1_440].includes(minutes))
      throw new DataError('Choose a valid snooze time.');
    const snoozeUntil = cleanDateTime(body.snoozeUntil);
    const result = await db
      .prepare(
        'UPDATE reminders SET remind_at=?,done=0 WHERE id=? AND user_id=? AND done=0',
      )
      .bind(snoozeUntil, cleanNumber(body.id), userId)
      .run();
    if (!result.meta.changes)
      throw new DataError('That reminder cannot be snoozed.', 403);
    return result;
  }
  if (body.type === 'reminder-to-task') {
    const reminderId = cleanNumber(body.id);
    const reminder = await db
      .prepare('SELECT id,recurrence FROM reminders WHERE id=? AND user_id=?')
      .bind(reminderId, userId)
      .first<{ id: number; recurrence: ReminderRecurrence }>();
    if (!reminder)
      throw new DataError('That reminder cannot be converted.', 403);
    if (reminder.recurrence !== 'none')
      throw new DataError('Only one-time reminders can become tasks.');
    return db.batch([
      db
        .prepare(
          "INSERT OR IGNORE INTO tasks (user_id,visibility,title,status,assignee_id,tag,due,due_on,source_reminder_id) SELECT user_id,visibility,label,'todo',CAST(user_id AS TEXT),'Reminder',substr(remind_at,1,10),substr(remind_at,1,10),id FROM reminders WHERE id=? AND user_id=?",
        )
        .bind(reminderId, userId),
      db
        .prepare('UPDATE reminders SET done=1 WHERE id=? AND user_id=?')
        .bind(reminderId, userId),
    ]);
  }
  if (body.type === 'reminder-remove') {
    const result = await db
      .prepare('DELETE FROM reminders WHERE id=? AND user_id=?')
      .bind(cleanNumber(body.id), userId)
      .run();
    if (!result.meta.changes)
      throw new DataError('That reminder cannot be removed.', 403);
    return result;
  }
  if (body.type === 'medication') {
    const medication = cleanMedicationFields(body);
    return db
      .prepare(
        'INSERT INTO medications (user_id,visibility,name,dosage,instructions,schedule_times,start_on,end_on,supply_remaining,refill_threshold,active,created_at) VALUES (?,?,?,?,?,?,?,?,?,?,1,?)',
      )
      .bind(
        userId,
        medication.visibility,
        medication.name,
        medication.dosage,
        medication.instructions,
        JSON.stringify(medication.scheduleTimes),
        medication.startOn,
        medication.endOn,
        medication.supplyRemaining,
        medication.refillThreshold,
        new Date().toISOString(),
      )
      .run();
  }
  if (body.type === 'medication-update') {
    const medication = cleanMedicationFields(body);
    const result = await db
      .prepare(
        'UPDATE medications SET visibility=?,name=?,dosage=?,instructions=?,schedule_times=?,start_on=?,end_on=?,supply_remaining=?,refill_threshold=? WHERE id=? AND user_id=?',
      )
      .bind(
        medication.visibility,
        medication.name,
        medication.dosage,
        medication.instructions,
        JSON.stringify(medication.scheduleTimes),
        medication.startOn,
        medication.endOn,
        medication.supplyRemaining,
        medication.refillThreshold,
        cleanNumber(body.id),
        userId,
      )
      .run();
    if (!result.meta.changes)
      throw new DataError('That medication cannot be changed.', 403);
    return result;
  }
  if (body.type === 'medication-remove') {
    const medicationId = cleanNumber(body.id);
    const medication = await db
      .prepare('SELECT id FROM medications WHERE id=? AND user_id=?')
      .bind(medicationId, userId)
      .first();
    if (!medication)
      throw new DataError('That medication cannot be removed.', 403);
    return db.batch([
      db
        .prepare('DELETE FROM medication_doses WHERE medication_id=?')
        .bind(medicationId),
      db
        .prepare('DELETE FROM medications WHERE id=? AND user_id=?')
        .bind(medicationId, userId),
    ]);
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
        'SELECT id,schedule_times AS scheduleTimes,start_on AS startOn,end_on AS endOn FROM medications WHERE id=? AND user_id=? AND active=1',
      )
      .bind(medicationId, userId)
      .first<{
        id: number;
        scheduleTimes: string;
        startOn: string;
        endOn: string | null;
      }>();
    if (!medication)
      throw new DataError('That medication cannot be changed.', 403);
    const [scheduledDate, scheduledTime] = scheduledFor.split('T');
    const scheduleTimes = JSON.parse(medication.scheduleTimes) as string[];
    if (
      !scheduleTimes.includes(scheduledTime) ||
      scheduledDate < medication.startOn ||
      (medication.endOn && scheduledDate > medication.endOn)
    )
      throw new DataError('Choose a scheduled dose within this course.');
    return db.batch([
      db
        .prepare(
          'UPDATE medications SET supply_remaining=MAX(0,supply_remaining-1) WHERE id=? AND user_id=? AND supply_remaining IS NOT NULL AND NOT EXISTS (SELECT 1 FROM medication_doses WHERE medication_id=? AND user_id=? AND scheduled_for=?)',
        )
        .bind(medicationId, userId, medicationId, userId, scheduledFor),
      db
        .prepare(
          'INSERT OR IGNORE INTO medication_doses (medication_id,user_id,scheduled_for,taken_at) VALUES (?,?,?,?)',
        )
        .bind(medicationId, userId, scheduledFor, new Date().toISOString()),
    ]);
  }
  if (body.type === 'medication-dose-remove') {
    const doseId = cleanNumber(body.id);
    const dose = await db
      .prepare(
        'SELECT d.id,d.medication_id AS medicationId FROM medication_doses d JOIN medications m ON m.id=d.medication_id WHERE d.id=? AND d.user_id=? AND m.user_id=?',
      )
      .bind(doseId, userId, userId)
      .first<{ id: number; medicationId: number }>();
    if (!dose) throw new DataError('That dose cannot be changed.', 403);
    return db.batch([
      db
        .prepare(
          'UPDATE medications SET supply_remaining=supply_remaining+1 WHERE id=? AND user_id=? AND supply_remaining IS NOT NULL AND EXISTS (SELECT 1 FROM medication_doses WHERE id=? AND user_id=?)',
        )
        .bind(dose.medicationId, userId, doseId, userId),
      db
        .prepare('DELETE FROM medication_doses WHERE id=? AND user_id=?')
        .bind(doseId, userId),
    ]);
  }
  if (body.type === 'purchase-idea') {
    const title = cleanText(body.title, 100);
    const description = cleanText(body.description, 800);
    const estimatedCost = cleanNumber(body.estimatedCost);
    if (!title) throw new DataError('Purchase idea name is required.');
    const now = new Date().toISOString();
    return db
      .prepare(
        "INSERT INTO purchase_ideas (user_id,title,description,estimated_cost,status,created_at,updated_at) VALUES (?,?,?,?, 'open',?,?)",
      )
      .bind(
        userId,
        title,
        description,
        estimatedCost > 0 ? estimatedCost : null,
        now,
        now,
      )
      .run();
  }
  if (body.type === 'purchase-idea-update') {
    const ideaId = cleanNumber(body.id);
    const title = cleanText(body.title, 100);
    const description = cleanText(body.description, 800);
    const estimatedCost = cleanNumber(body.estimatedCost);
    if (!title) throw new DataError('Purchase idea name is required.');
    const result = await db
      .prepare(
        'UPDATE purchase_ideas SET title=?,description=?,estimated_cost=?,updated_at=? WHERE id=? AND user_id=?',
      )
      .bind(
        title,
        description,
        estimatedCost > 0 ? estimatedCost : null,
        new Date().toISOString(),
        ideaId,
        userId,
      )
      .run();
    if (!result.meta.changes)
      throw new DataError('That purchase idea cannot be changed.', 403);
    return result;
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
      .prepare(
        'UPDATE purchase_ideas SET status=?,updated_at=? WHERE id=? AND user_id=?',
      )
      .bind(status, new Date().toISOString(), cleanNumber(body.id), userId)
      .run();
    if (!result.meta.changes)
      throw new DataError('That purchase idea cannot be changed.', 403);
    return result;
  }
  if (body.type === 'message') {
    const message = cleanText(body.body, 2_000);
    if (!message) throw new DataError('Message cannot be empty.');
    const createdAt = new Date().toISOString();
    const result = await db
      .prepare(
        'INSERT INTO messages (user_id,member_id,body,created_at) VALUES (?,?,?,?)',
      )
      .bind(userId, legacyId, message, createdAt)
      .run();
    await db
      .prepare(
        'INSERT INTO chat_read_state (user_id,last_read_message_id,updated_at) VALUES (?,?,?) ON CONFLICT(user_id) DO UPDATE SET last_read_message_id=MAX(last_read_message_id,excluded.last_read_message_id),updated_at=excluded.updated_at',
      )
      .bind(userId, Number(result.meta.last_row_id), createdAt)
      .run();
    return result;
  }
  if (body.type === 'message-read') {
    const latest = await db
      .prepare('SELECT COALESCE(MAX(id),0) AS id FROM messages')
      .first<{ id: number }>();
    return db
      .prepare(
        'INSERT INTO chat_read_state (user_id,last_read_message_id,updated_at) VALUES (?,?,?) ON CONFLICT(user_id) DO UPDATE SET last_read_message_id=MAX(last_read_message_id,excluded.last_read_message_id),updated_at=excluded.updated_at',
      )
      .bind(userId, Number(latest?.id ?? 0), new Date().toISOString())
      .run();
  }
  if (body.type === 'message-update') {
    const message = cleanText(body.body, 2_000);
    if (!message) throw new DataError('Message cannot be empty.');
    const result = await db
      .prepare(
        'UPDATE messages SET body=?,edited_at=? WHERE id=? AND user_id=?',
      )
      .bind(message, new Date().toISOString(), cleanNumber(body.id), userId)
      .run();
    if (!result.meta.changes)
      throw new DataError('That message cannot be changed.', 403);
    return result;
  }
  if (body.type === 'message-remove') {
    const result = await db
      .prepare('DELETE FROM messages WHERE id=? AND user_id=?')
      .bind(cleanNumber(body.id), userId)
      .run();
    if (!result.meta.changes)
      throw new DataError('That message cannot be removed.', 403);
    return result;
  }
  if (body.type === 'home') {
    const owner = await db
      .prepare(
        "SELECT id FROM users WHERE id=? AND role='owner' AND deleted_at IS NULL",
      )
      .bind(userId)
      .first();
    if (!owner)
      throw new DataError(
        'Only the household owner can change the home profile.',
        403,
        'owner_required',
      );
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
  if (body.type === 'habit-update') {
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
    const result = await db
      .prepare(
        'UPDATE habit_entries SET habit=?,occurrences=?,cost=?,occurred_on=? WHERE id=? AND user_id=?',
      )
      .bind(
        habit,
        occurrences,
        cleanNumber(body.cost),
        cleanDate(body.occurredOn),
        cleanNumber(body.id),
        userId,
      )
      .run();
    if (!result.meta.changes)
      throw new DataError('That habit record cannot be changed.', 403);
    return result;
  }
  if (body.type === 'habit-remove') {
    const result = await db
      .prepare('DELETE FROM habit_entries WHERE id=? AND user_id=?')
      .bind(cleanNumber(body.id), userId)
      .run();
    if (!result.meta.changes)
      throw new DataError('That habit record cannot be removed.', 403);
    return result;
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
  if (body.type === 'water-update') {
    const amountMl = Math.round(cleanNumber(body.amountMl, 10_000));
    if (amountMl < 1) throw new DataError('Water amount is required.');
    const result = await db
      .prepare(
        'UPDATE water_entries SET amount_ml=?,drunk_on=? WHERE id=? AND user_id=?',
      )
      .bind(amountMl, cleanDate(body.drunkOn), cleanNumber(body.id), userId)
      .run();
    if (!result.meta.changes)
      throw new DataError('That water entry cannot be changed.', 403);
    return result;
  }
  if (body.type === 'water-remove') {
    const result = await db
      .prepare('DELETE FROM water_entries WHERE id=? AND user_id=?')
      .bind(cleanNumber(body.id), userId)
      .run();
    if (!result.meta.changes)
      throw new DataError('That water entry cannot be removed.', 403);
    return result;
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
