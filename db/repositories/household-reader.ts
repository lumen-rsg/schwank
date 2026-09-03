import { env } from 'cloudflare:workers';
import { isAiConfigured } from '../ai-config';
import type { AuthUser } from '../auth';
import { readChatSnapshot } from '../chat';
import { readPrivateHistoryPage } from '../private-history';
import { readExpensePage } from '../spending';
import { ensureDatabase } from '../setup';

const today = () => new Date().toISOString().slice(0, 10);

export const householdDataSections = [
  'account',
  'members',
  'home',
  'nutrition',
  'tasks',
  'spending',
  'organisers',
  'medications',
  'wishlist',
  'notifications',
  'habits',
  'water',
  'food',
] as const;

export type HouseholdDataSection = (typeof householdDataSections)[number];

export function isHouseholdDataSection(
  value: string,
): value is HouseholdDataSection {
  return householdDataSections.includes(value as HouseholdDataSection);
}

async function readCurrentUser(user: AuthUser) {
  return (
    (await env.DB.prepare(
      'SELECT id,email,display_name AS name,initials,color,avatar_data AS avatar,role,calorie_goal AS calorieGoal,protein_goal AS proteinGoal,carb_goal AS carbGoal,fat_goal AS fatGoal,water_goal AS waterGoal,maintenance_calories AS maintenanceCalories,height_cm AS heightCm,weight_kg AS weightKg,age,sex,activity,nutrition_plan AS nutritionPlan,diet,ai_consent AS aiConsent FROM users WHERE id=? AND deleted_at IS NULL',
    )
      .bind(user.id)
      .first<AuthUser>()) ?? user
  );
}

async function readMembers() {
  const rows = await env.DB.prepare(
    'SELECT id,display_name AS name,initials,color,avatar_data AS avatar,role FROM users WHERE deleted_at IS NULL ORDER BY display_name',
  ).all();
  return { members: rows.results };
}

async function readAccount(user: AuthUser) {
  const [currentUser, members] = await Promise.all([
    readCurrentUser(user),
    readMembers(),
  ]);
  return { currentUser, ...members };
}

async function readHome() {
  const home = await env.DB.prepare(
    'SELECT name,address,photo_data AS photo FROM household_settings WHERE id=1',
  ).first();
  return { home: home ?? { name: 'Our home', address: '', photo: null } };
}

async function readNutrition(user: AuthUser) {
  const [currentUser, nutrition, nutritionHistory, aiConsentCount] =
    await Promise.all([
      readCurrentUser(user),
      env.DB.prepare(
        "SELECT n.id,n.label,n.calories,n.protein,n.carbs,n.fat,n.eaten_on AS eatenOn,n.visibility,(n.user_id=?) AS owned,u.id AS userId,u.display_name AS name,u.initials,u.color,u.avatar_data AS avatar FROM nutrition_entries n JOIN users u ON u.id=n.user_id WHERE n.eaten_on=? AND (n.user_id=? OR n.visibility='shared') ORDER BY n.id DESC",
      )
        .bind(user.id, today(), user.id)
        .all(),
      readPrivateHistoryPage(user, 'nutrition'),
      env.DB.prepare(
        'SELECT COUNT(*) AS count FROM users WHERE ai_consent=1 AND deleted_at IS NULL',
      ).first<{ count: number }>(),
    ]);
  return {
    currentUser,
    nutrition: nutrition.results,
    nutritionHistory: nutritionHistory.items,
    nutritionHistoryCount: nutritionHistory.count,
    nutritionHistoryHasMore: nutritionHistory.hasMore,
    nutritionHistoryDays: nutritionHistory.daily,
    aiConfigured: isAiConfigured(),
    aiConsentingMembers: Number(aiConsentCount?.count || 0),
  };
}

async function readTasks(user: AuthUser) {
  const rows = await env.DB.prepare(
    "SELECT t.id,t.title,t.status,t.tag,t.due,t.due_on AS dueOn,t.source_reminder_id AS sourceReminderId,t.visibility,(t.user_id=?) AS owned,(CAST(t.assignee_id AS INTEGER)=?) AS assignedToMe,CAST(t.assignee_id AS INTEGER) AS assigneeId,a.display_name AS assigneeName,a.initials AS assigneeInitials,a.color AS assigneeColor,a.avatar_data AS assigneeAvatar FROM tasks t LEFT JOIN users a ON a.id=CAST(t.assignee_id AS INTEGER) AND a.deleted_at IS NULL WHERE t.user_id=? OR t.visibility='shared' ORDER BY t.id DESC",
  )
    .bind(user.id, user.id, user.id)
    .all();
  return { tasks: rows.results };
}

async function readSpending(user: AuthUser) {
  const [expensePage, spendingBudgets, recurringPayments] = await Promise.all([
    readExpensePage(user),
    env.DB.prepare(
      'SELECT id,category,monthly_limit AS monthlyLimit,updated_at AS updatedAt FROM spending_budgets WHERE user_id=? ORDER BY category',
    )
      .bind(user.id)
      .all(),
    env.DB.prepare(
      "SELECT id,kind,label,amount,billing_cycle AS billingCycle,next_due_on AS nextDueOn,remaining_amount AS remainingAmount,active,visibility,(user_id=?) AS owned FROM recurring_payments WHERE user_id=? OR visibility='shared' ORDER BY active DESC,next_due_on,id DESC",
    )
      .bind(user.id, user.id)
      .all(),
  ]);
  return {
    expenses: expensePage.expenses,
    expenseCount: expensePage.expenseCount,
    expenseTotal: expensePage.expenseTotal,
    expensesHasMore: expensePage.hasMore,
    spendingBudgets: spendingBudgets.results,
    recurringPayments: recurringPayments.results,
  };
}

async function readOrganisers(user: AuthUser) {
  const [organisers, reminders, tasks] = await Promise.all([
    env.DB.prepare(
      "SELECT id,list,label,done,visibility,(user_id=?) AS owned FROM organiser_items WHERE user_id=? OR visibility='shared' ORDER BY id DESC",
    )
      .bind(user.id, user.id)
      .all(),
    env.DB.prepare(
      "SELECT r.id,r.label,r.remind_at AS remindAt,r.recurrence,r.done,r.visibility,(r.user_id=?) AS owned,t.id AS convertedTaskId FROM reminders r LEFT JOIN tasks t ON t.source_reminder_id=r.id WHERE r.user_id=? OR r.visibility='shared' ORDER BY r.done,r.remind_at,r.id DESC",
    )
      .bind(user.id, user.id)
      .all(),
    readTasks(user),
  ]);
  return {
    organisers: organisers.results,
    reminders: reminders.results,
    tasks: tasks.tasks,
  };
}

async function readMedications(user: AuthUser) {
  const [medicationRows, medicationDoses] = await Promise.all([
    env.DB.prepare(
      "SELECT m.id,m.name,m.dosage,m.instructions,m.schedule_times AS scheduleTimes,m.start_on AS startOn,m.end_on AS endOn,m.supply_remaining AS supplyRemaining,m.refill_threshold AS refillThreshold,m.active,m.visibility,(m.user_id=?) AS owned,u.display_name AS ownerName FROM medications m JOIN users u ON u.id=m.user_id WHERE m.user_id=? OR m.visibility='shared' ORDER BY m.active DESC,m.name,m.id DESC",
    )
      .bind(user.id, user.id)
      .all(),
    env.DB.prepare(
      "SELECT d.id,d.medication_id AS medicationId,d.scheduled_for AS scheduledFor,d.taken_at AS takenAt,u.display_name AS takenByName FROM medication_doses d JOIN medications m ON m.id=d.medication_id JOIN users u ON u.id=d.user_id WHERE (m.user_id=? OR m.visibility='shared') AND d.scheduled_for>=date('now','-89 days') ORDER BY d.scheduled_for DESC,d.id DESC",
    )
      .bind(user.id)
      .all(),
  ]);
  return {
    medications: medicationRows.results.map((medication) => ({
      ...medication,
      scheduleTimes: JSON.parse(String(medication.scheduleTimes)) as string[],
    })),
    medicationDoses: medicationDoses.results,
  };
}

async function readWishlist(user: AuthUser) {
  const [purchaseIdeas, purchaseVotes] = await Promise.all([
    env.DB.prepare(
      "SELECT p.id,p.title,p.description,p.estimated_cost AS estimatedCost,p.status,p.created_at AS createdAt,COALESCE(p.updated_at,p.created_at) AS updatedAt,(p.user_id=?) AS owned,u.display_name AS createdByName,u.initials,u.color,u.avatar_data AS avatar FROM purchase_ideas p JOIN users u ON u.id=p.user_id ORDER BY CASE p.status WHEN 'open' THEN 0 WHEN 'bought' THEN 1 ELSE 2 END,COALESCE(p.updated_at,p.created_at) DESC,p.id DESC",
    )
      .bind(user.id)
      .all(),
    env.DB.prepare(
      'SELECT v.id,v.idea_id AS ideaId,v.vote,v.updated_at AS updatedAt,(v.user_id=?) AS mine,u.display_name AS name,u.initials,u.color,u.avatar_data AS avatar FROM purchase_votes v JOIN users u ON u.id=v.user_id ORDER BY v.updated_at,v.id',
    )
      .bind(user.id)
      .all(),
  ]);
  return {
    purchaseIdeas: purchaseIdeas.results,
    purchaseVotes: purchaseVotes.results,
  };
}

async function readNotifications(user: AuthUser) {
  const [notificationPreferences, notificationStates] = await Promise.all([
    env.DB.prepare(
      'SELECT enabled,medications_enabled AS medicationsEnabled,payments_enabled AS paymentsEnabled,tasks_enabled AS tasksEnabled,reminders_enabled AS remindersEnabled,chat_enabled AS chatEnabled,advance_minutes AS advanceMinutes,quiet_hours_enabled AS quietHoursEnabled,quiet_start AS quietStart,quiet_end AS quietEnd,timezone FROM notification_preferences WHERE user_id=?',
    )
      .bind(user.id)
      .first(),
    env.DB.prepare(
      "SELECT event_key AS eventKey,delivered_at AS deliveredAt,snoozed_until AS snoozedUntil FROM notification_states WHERE user_id=? AND updated_at>=date('now','-90 days') ORDER BY updated_at DESC LIMIT 500",
    )
      .bind(user.id)
      .all(),
  ]);
  return {
    notificationPreferences: notificationPreferences ?? {
      enabled: true,
      medicationsEnabled: true,
      paymentsEnabled: true,
      tasksEnabled: true,
      remindersEnabled: true,
      chatEnabled: true,
      advanceMinutes: 4320,
      quietHoursEnabled: false,
      quietStart: '22:00',
      quietEnd: '08:00',
      timezone: 'Europe/Moscow',
    },
    notificationStates: notificationStates.results,
  };
}

async function readHabits(user: AuthUser) {
  const since = new Date();
  since.setUTCDate(since.getUTCDate() - 83);
  const rows = await env.DB.prepare(
    'SELECT h.id,h.user_id AS userId,h.habit,h.occurrences,h.cost,h.occurred_on AS occurredOn,h.created_at AS createdAt,u.display_name AS name,u.initials,u.color,u.avatar_data AS avatar,(h.user_id=?) AS mine FROM habit_entries h JOIN users u ON u.id=h.user_id WHERE h.occurred_on>=? ORDER BY h.occurred_on DESC,h.id DESC',
  )
    .bind(user.id, since.toISOString().slice(0, 10))
    .all();
  return { habits: rows.results };
}

async function readWater(user: AuthUser) {
  const [currentUser, history] = await Promise.all([
    readCurrentUser(user),
    readPrivateHistoryPage(user, 'water'),
  ]);
  return {
    currentUser,
    water: history.items,
    waterHistoryCount: history.count,
    waterHistoryHasMore: history.hasMore,
    waterHistoryDays: history.daily,
  };
}

async function readFood() {
  const [foods, recipeRows, ingredientRows, weeklyPlan] = await Promise.all([
    env.DB.prepare(
      'SELECT f.id,f.name,f.normalized_name AS normalizedName,f.quantity,f.unit,f.category,f.expires_on AS expiresOn,f.updated_at AS updatedAt,u.display_name AS updatedByName FROM food_items f JOIN users u ON u.id=f.updated_by ORDER BY CASE WHEN f.expires_on IS NULL THEN 1 ELSE 0 END,f.expires_on,f.name',
    ).all(),
    env.DB.prepare(
      'SELECT r.id,r.name,r.course,r.servings,r.instructions,r.created_at AS createdAt,u.display_name AS createdByName FROM recipes r JOIN users u ON u.id=r.created_by ORDER BY r.id DESC',
    ).all(),
    env.DB.prepare(
      'SELECT id,recipe_id AS recipeId,name,normalized_name AS normalizedName,quantity,unit FROM recipe_ingredients ORDER BY id',
    ).all(),
    env.DB.prepare(
      "SELECT id,week_start AS weekStart,day_index AS dayIndex,course,recipe_id AS recipeId,servings FROM weekly_meal_plan WHERE week_start>=date('now','-14 days') AND week_start<=date('now','+14 days') ORDER BY week_start,day_index,id",
    ).all(),
  ]);
  const recipes = recipeRows.results.map((recipe) => ({
    ...recipe,
    ingredients: ingredientRows.results.filter(
      (ingredient) =>
        (ingredient as { recipeId: number }).recipeId ===
        (recipe as { id: number }).id,
    ),
  }));
  return {
    foods: foods.results,
    recipes,
    weeklyPlan: weeklyPlan.results,
  };
}

async function readSection(user: AuthUser, section: HouseholdDataSection) {
  if (section === 'account') return readAccount(user);
  if (section === 'members') return readMembers();
  if (section === 'home') return readHome();
  if (section === 'nutrition') return readNutrition(user);
  if (section === 'tasks') return readTasks(user);
  if (section === 'spending') return readSpending(user);
  if (section === 'organisers') return readOrganisers(user);
  if (section === 'medications') return readMedications(user);
  if (section === 'wishlist') return readWishlist(user);
  if (section === 'notifications') return readNotifications(user);
  if (section === 'habits') return readHabits(user);
  if (section === 'water') return readWater(user);
  return readFood();
}

export async function readHouseholdSections(
  user: AuthUser,
  requestedSections: readonly HouseholdDataSection[],
) {
  await ensureDatabase();
  const sections = Array.from(new Set(requestedSections));
  const results = await Promise.all(
    sections.map((section) => readSection(user, section)),
  );
  return Object.assign({}, ...results);
}

export async function readHouseholdData(user: AuthUser) {
  await ensureDatabase();
  const [sections, chat] = await Promise.all([
    Promise.all(
      householdDataSections.map((section) => readSection(user, section)),
    ),
    readChatSnapshot(user),
  ]);
  return Object.assign({}, ...sections, {
    messages: chat.messages,
    messageCount: chat.messageCount,
    messagesHasMore: chat.hasMore,
    unreadMessages: chat.unreadMessages,
  });
}
