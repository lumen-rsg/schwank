import { env } from 'cloudflare:workers';
import { ApiError } from '@/lib/api-errors';
import { assertCurrentUserPassword, type AuthUser } from './auth';
import { ensureDatabase } from './setup';

function record(input: unknown) {
  return (input && typeof input === 'object' ? input : {}) as Record<
    string,
    unknown
  >;
}

async function userRows(sql: string, userId: number) {
  const result = await env.DB.prepare(sql)
    .bind(userId)
    .all<Record<string, unknown>>();
  return result.results;
}

export async function exportAccountData(user: AuthUser) {
  await ensureDatabase();
  const [
    account,
    nutrition,
    tasks,
    expenses,
    spendingBudgets,
    recurringPayments,
    organisers,
    reminders,
    medications,
    medicationDoses,
    water,
    habits,
    messages,
    purchaseIdeas,
    purchaseVotes,
    recipes,
    recipeIngredients,
    weeklyPlanEntries,
    pantryItemsLastUpdated,
    householdProfileLastUpdated,
  ] = await Promise.all([
    env.DB.prepare(
      'SELECT email,display_name AS displayName,initials,color,avatar_data AS avatar,role,calorie_goal AS calorieGoal,protein_goal AS proteinGoal,carb_goal AS carbGoal,fat_goal AS fatGoal,water_goal AS waterGoal,maintenance_calories AS maintenanceCalories,height_cm AS heightCm,weight_kg AS weightKg,age,sex,activity,nutrition_plan AS nutritionPlan,diet,ai_consent AS aiConsent,created_at AS createdAt FROM users WHERE id=? AND deleted_at IS NULL',
    )
      .bind(user.id)
      .first<Record<string, unknown>>(),
    userRows(
      'SELECT id,visibility,label,calories,protein,carbs,fat,eaten_on AS eatenOn FROM nutrition_entries WHERE user_id=? ORDER BY id',
      user.id,
    ),
    userRows(
      'SELECT id,visibility,title,status,tag,due,due_on AS dueOn,source_reminder_id AS sourceReminderId FROM tasks WHERE user_id=? ORDER BY id',
      user.id,
    ),
    userRows(
      'SELECT id,visibility,label,amount,category,spent_on AS spentOn,recurring_payment_id AS recurringPaymentId FROM expenses WHERE user_id=? ORDER BY id',
      user.id,
    ),
    userRows(
      'SELECT id,category,monthly_limit AS monthlyLimit,updated_at AS updatedAt FROM spending_budgets WHERE user_id=? ORDER BY id',
      user.id,
    ),
    userRows(
      'SELECT id,visibility,kind,label,amount,billing_cycle AS billingCycle,next_due_on AS nextDueOn,remaining_amount AS remainingAmount,active,created_at AS createdAt FROM recurring_payments WHERE user_id=? ORDER BY id',
      user.id,
    ),
    userRows(
      'SELECT id,visibility,list,label,done FROM organiser_items WHERE user_id=? ORDER BY id',
      user.id,
    ),
    userRows(
      'SELECT id,visibility,label,remind_at AS remindAt,recurrence,done,created_at AS createdAt FROM reminders WHERE user_id=? ORDER BY id',
      user.id,
    ),
    userRows(
      'SELECT id,visibility,name,dosage,instructions,schedule_times AS scheduleTimes,start_on AS startOn,end_on AS endOn,supply_remaining AS supplyRemaining,refill_threshold AS refillThreshold,active,created_at AS createdAt FROM medications WHERE user_id=? ORDER BY id',
      user.id,
    ),
    userRows(
      'SELECT id,medication_id AS medicationId,scheduled_for AS scheduledFor,taken_at AS takenAt FROM medication_doses WHERE user_id=? ORDER BY id',
      user.id,
    ),
    userRows(
      'SELECT id,amount_ml AS amountMl,drunk_on AS drunkOn,created_at AS createdAt FROM water_entries WHERE user_id=? ORDER BY id',
      user.id,
    ),
    userRows(
      'SELECT id,habit,occurrences,cost,occurred_on AS occurredOn,created_at AS createdAt FROM habit_entries WHERE user_id=? ORDER BY id',
      user.id,
    ),
    userRows(
      'SELECT id,body,created_at AS createdAt FROM messages WHERE user_id=? ORDER BY id',
      user.id,
    ),
    userRows(
      'SELECT id,title,description,estimated_cost AS estimatedCost,status,created_at AS createdAt,COALESCE(updated_at,created_at) AS updatedAt FROM purchase_ideas WHERE user_id=? ORDER BY id',
      user.id,
    ),
    userRows(
      'SELECT id,idea_id AS ideaId,vote,created_at AS createdAt,updated_at AS updatedAt FROM purchase_votes WHERE user_id=? ORDER BY id',
      user.id,
    ),
    userRows(
      'SELECT id,name,course,servings,instructions,created_at AS createdAt FROM recipes WHERE created_by=? ORDER BY id',
      user.id,
    ),
    userRows(
      'SELECT i.id,i.recipe_id AS recipeId,i.name,i.quantity,i.unit FROM recipe_ingredients i JOIN recipes r ON r.id=i.recipe_id WHERE r.created_by=? ORDER BY i.id',
      user.id,
    ),
    userRows(
      'SELECT id,week_start AS weekStart,day_index AS dayIndex,course,recipe_id AS recipeId,servings,created_at AS createdAt FROM weekly_meal_plan WHERE created_by=? ORDER BY id',
      user.id,
    ),
    userRows(
      'SELECT id,name,quantity,unit,category,expires_on AS expiresOn,updated_at AS updatedAt FROM food_items WHERE updated_by=? ORDER BY id',
      user.id,
    ),
    userRows(
      'SELECT name,address,photo_data AS photo,updated_at AS updatedAt FROM household_settings WHERE updated_by=?',
      user.id,
    ),
  ]);
  if (!account) throw new ApiError('Account not found.', 404, 'not_found');
  return {
    schemaVersion: 1,
    exportedAt: new Date().toISOString(),
    account,
    records: {
      nutrition,
      tasks,
      expenses,
      recurringPayments,
      spendingBudgets,
      organisers,
      reminders,
      medications,
      medicationDoses,
      water,
      habits,
      messages,
      purchaseIdeas,
      purchaseVotes,
      recipes,
      recipeIngredients,
      weeklyPlanEntries,
      pantryItemsLastUpdated,
      householdProfileLastUpdated,
    },
  };
}

export async function deleteAccount(user: AuthUser, input: unknown) {
  await ensureDatabase();
  const values = record(input);
  const confirmation =
    typeof values.confirmation === 'string'
      ? values.confirmation.trim().toLowerCase()
      : '';
  if (confirmation !== user.email.toLowerCase())
    throw new ApiError(
      'Type your email address to confirm account deletion.',
      400,
      'validation_failed',
    );
  await assertCurrentUserPassword(user, values.currentPassword);
  const activeUsers = await env.DB.prepare(
    'SELECT COUNT(*) AS count FROM users WHERE deleted_at IS NULL',
  ).first<{ count: number }>();
  const finalAccount = Number(activeUsers?.count ?? 0) <= 1;
  const now = new Date().toISOString();
  const deletedEmail = `deleted-${user.id}-${crypto.randomUUID()}@invalid.local`;
  const statements = [
    env.DB.prepare(
      'DELETE FROM medication_doses WHERE user_id=? OR medication_id IN (SELECT id FROM medications WHERE user_id=?)',
    ).bind(user.id, user.id),
    env.DB.prepare(
      'DELETE FROM purchase_votes WHERE user_id=? OR idea_id IN (SELECT id FROM purchase_ideas WHERE user_id=?)',
    ).bind(user.id, user.id),
    ...[
      'sessions',
      'nutrition_entries',
      'tasks',
      'expenses',
      'recurring_payments',
      'spending_budgets',
      'organiser_items',
      'reminders',
      'medications',
      'water_entries',
      'habit_entries',
      'messages',
      'purchase_ideas',
    ].map((table) =>
      env.DB.prepare(`DELETE FROM ${table} WHERE user_id=?`).bind(user.id),
    ),
  ];
  if (finalAccount) {
    statements.push(
      env.DB.prepare('DELETE FROM auth_rate_limits'),
      env.DB.prepare('DELETE FROM weekly_meal_plan'),
      env.DB.prepare('DELETE FROM recipe_ingredients'),
      env.DB.prepare('DELETE FROM recipes'),
      env.DB.prepare('DELETE FROM food_items'),
      env.DB.prepare(
        "UPDATE household_settings SET name='Our home',address='',photo_data=NULL,updated_at=?,updated_by=NULL,registration_open=0,invite_code_hash=NULL,invite_expires_at=NULL WHERE id=1",
      ).bind(now),
    );
  } else if (user.role === 'owner') {
    statements.push(
      env.DB.prepare(
        "UPDATE users SET role='owner' WHERE id=(SELECT id FROM users WHERE id<>? AND deleted_at IS NULL ORDER BY created_at,id LIMIT 1)",
      ).bind(user.id),
      env.DB.prepare(
        'UPDATE household_settings SET registration_open=0,invite_code_hash=NULL,invite_expires_at=NULL',
      ),
    );
  }
  statements.push(
    env.DB.prepare(
      "UPDATE users SET email=?,display_name='Former member',initials='—',color='#737373',avatar_data=NULL,password_hash='deleted',password_salt='deleted',role='member',calorie_goal=2200,protein_goal=140,carb_goal=250,fat_goal=70,water_goal=2000,maintenance_calories=NULL,height_cm=NULL,weight_kg=NULL,age=NULL,sex=NULL,activity=NULL,nutrition_plan=NULL,diet=NULL,ai_consent=0,deleted_at=? WHERE id=? AND deleted_at IS NULL",
    ).bind(deletedEmail, now, user.id),
  );
  await env.DB.batch(statements);
  return { finalAccount };
}
