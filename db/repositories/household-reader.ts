import { env } from 'cloudflare:workers';
import { isAiConfigured } from '../ai-config';
import type { AuthUser } from '../auth';
import { ensureDatabase } from '../setup';

const today = () => new Date().toISOString().slice(0, 10);

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
        'SELECT id,email,display_name AS name,initials,color,avatar_data AS avatar,role,calorie_goal AS calorieGoal,protein_goal AS proteinGoal,carb_goal AS carbGoal,fat_goal AS fatGoal,water_goal AS waterGoal,maintenance_calories AS maintenanceCalories,height_cm AS heightCm,weight_kg AS weightKg,age,sex,activity,nutrition_plan AS nutritionPlan,diet,ai_consent AS aiConsent FROM users WHERE id=? AND deleted_at IS NULL',
      )
      .bind(user.id)
      .first<AuthUser>(),
    db
      .prepare(
        'SELECT id,display_name AS name,initials,color,avatar_data AS avatar FROM users WHERE deleted_at IS NULL ORDER BY display_name',
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
        "SELECT t.id,t.title,t.status,t.tag,t.due,t.due_on AS dueOn,t.visibility,(t.user_id=?) AS owned,(CAST(t.assignee_id AS INTEGER)=?) AS assignedToMe,CAST(t.assignee_id AS INTEGER) AS assigneeId,a.display_name AS assigneeName,a.initials AS assigneeInitials,a.color AS assigneeColor,a.avatar_data AS assigneeAvatar FROM tasks t LEFT JOIN users a ON a.id=CAST(t.assignee_id AS INTEGER) AND a.deleted_at IS NULL WHERE t.user_id=? OR t.visibility='shared' ORDER BY t.id DESC",
      )
      .bind(user.id, user.id, user.id)
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
    db
      .prepare(
        'SELECT COUNT(*) AS count FROM users WHERE ai_consent=1 AND deleted_at IS NULL',
      )
      .first<{
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
