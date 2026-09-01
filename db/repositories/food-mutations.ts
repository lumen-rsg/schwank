import { env } from 'cloudflare:workers';
import {
  planPantryDeduction,
  type FoodUnit,
  type PantryNeed,
  type PantryStock,
} from '@/lib/food-calculations';
import {
  DataError,
  cleanFoodCategory,
  cleanFoodUnit,
  cleanNumber,
  cleanOptionalDate,
  cleanRecipeCourse,
  cleanText,
  normalizeFoodName,
  type DataAction,
} from '../services/data-validation';

export const foodActionTypes = new Set([
  'food-add',
  'food-adjust',
  'food-update',
  'food-remove',
  'recipe-add',
  'recipe-update',
  'recipe-cook',
  'recipe-remove',
  'ai-plan-apply',
  'meal-plan-save',
]);

function cleanFoodFields(body: DataAction) {
  const name = cleanText(body.name, 80);
  const quantity =
    Math.round(cleanNumber(body.quantity, 1_000_000) * 100) / 100;
  const unit = cleanFoodUnit(body.unit) as FoodUnit | null;
  if (!name || quantity < 0 || !unit)
    throw new DataError('Food name, quantity, and unit are required.');
  return {
    name,
    normalizedName: normalizeFoodName(name),
    quantity,
    unit,
    category: cleanFoodCategory(body.category),
    expiresOn: cleanOptionalDate(body.expiresOn),
  };
}

function cleanRecipeFields(body: DataAction) {
  const name = cleanText(body.name, 100);
  const course = cleanRecipeCourse(body.course);
  const servings = Math.max(1, Math.round(cleanNumber(body.servings, 100)));
  const instructions = cleanText(body.instructions, 5_000);
  const rawIngredients = Array.isArray(body.ingredients)
    ? body.ingredients
    : [];
  if (!name || !course || !rawIngredients.length || rawIngredients.length > 30)
    throw new DataError(
      'Recipe name, course, and 1–30 ingredients are required.',
    );
  const ingredients = rawIngredients.map((item) => {
    const record =
      item && typeof item === 'object' ? (item as Record<string, unknown>) : {};
    const ingredientName = cleanText(record.name, 80);
    const quantity =
      Math.round(cleanNumber(record.quantity, 1_000_000) * 100) / 100;
    const unit = cleanFoodUnit(record.unit) as FoodUnit | null;
    if (!ingredientName || quantity <= 0 || !unit)
      throw new DataError('Every ingredient needs a name, quantity, and unit.');
    return {
      name: ingredientName,
      normalizedName: normalizeFoodName(ingredientName),
      quantity,
      unit,
    };
  });
  return { name, course, servings, instructions, ingredients };
}

export async function writeFoodData(userId: number, body: DataAction) {
  const db = env.DB;
  if (body.type === 'food-add') {
    const food = cleanFoodFields(body);
    if (food.quantity <= 0)
      throw new DataError('Food name, quantity, and unit are required.');
    return db
      .prepare(
        'INSERT INTO food_items (name,normalized_name,quantity,unit,category,expires_on,updated_by,updated_at) VALUES (?,?,?,?,?,?,?,?)',
      )
      .bind(
        food.name,
        food.normalizedName,
        food.quantity,
        food.unit,
        food.category,
        food.expiresOn,
        userId,
        new Date().toISOString(),
      )
      .run();
  }
  if (body.type === 'food-update') {
    const food = cleanFoodFields(body);
    const result = await db
      .prepare(
        'UPDATE food_items SET name=?,normalized_name=?,quantity=?,unit=?,category=?,expires_on=?,updated_by=?,updated_at=? WHERE id=?',
      )
      .bind(
        food.name,
        food.normalizedName,
        food.quantity,
        food.unit,
        food.category,
        food.expiresOn,
        userId,
        new Date().toISOString(),
        cleanNumber(body.id),
      )
      .run();
    if (!result.meta.changes)
      throw new DataError('Food item was not found.', 404);
    return result;
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
    const recipe = cleanRecipeFields(body);
    const result = await db
      .prepare(
        'INSERT INTO recipes (name,course,servings,instructions,created_by,created_at) VALUES (?,?,?,?,?,?)',
      )
      .bind(
        recipe.name,
        recipe.course,
        recipe.servings,
        recipe.instructions,
        userId,
        new Date().toISOString(),
      )
      .run();
    const recipeId = Number(result.meta.last_row_id);
    await db.batch(
      recipe.ingredients.map((item) =>
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
  if (body.type === 'recipe-update') {
    const recipeId = cleanNumber(body.id);
    const existing = await db
      .prepare('SELECT id,course FROM recipes WHERE id=?')
      .bind(recipeId)
      .first<{ id: number; course: string }>();
    if (!existing) throw new DataError('Recipe was not found.', 404);
    const recipe = cleanRecipeFields(body);
    return db.batch([
      ...(existing.course !== recipe.course
        ? [
            db
              .prepare(
                'DELETE FROM weekly_meal_plan AS target WHERE target.course=? AND target.recipe_id<>? AND EXISTS (SELECT 1 FROM weekly_meal_plan AS source WHERE source.recipe_id=? AND source.week_start=target.week_start AND source.day_index=target.day_index)',
              )
              .bind(recipe.course, recipeId, recipeId),
            db
              .prepare('UPDATE weekly_meal_plan SET course=? WHERE recipe_id=?')
              .bind(recipe.course, recipeId),
          ]
        : []),
      db
        .prepare(
          'UPDATE recipes SET name=?,course=?,servings=?,instructions=? WHERE id=?',
        )
        .bind(
          recipe.name,
          recipe.course,
          recipe.servings,
          recipe.instructions,
          recipeId,
        ),
      db
        .prepare('DELETE FROM recipe_ingredients WHERE recipe_id=?')
        .bind(recipeId),
      ...recipe.ingredients.map((item) =>
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
    ]);
  }
  if (body.type === 'recipe-cook') {
    const recipeId = cleanNumber(body.id);
    const targetServings = Math.max(
      1,
      Math.round(cleanNumber(body.servings, 100)),
    );
    const recipe = await db
      .prepare('SELECT id,servings FROM recipes WHERE id=?')
      .bind(recipeId)
      .first<{ id: number; servings: number }>();
    if (!recipe) throw new DataError('Recipe was not found.', 404);
    const [ingredientRows, stockRows] = await Promise.all([
      db
        .prepare(
          'SELECT name,normalized_name AS normalizedName,quantity,unit FROM recipe_ingredients WHERE recipe_id=? ORDER BY id',
        )
        .bind(recipeId)
        .all<PantryNeed>(),
      db
        .prepare(
          'SELECT id,normalized_name AS normalizedName,quantity,unit,expires_on AS expiresOn FROM food_items ORDER BY CASE WHEN expires_on IS NULL THEN 1 ELSE 0 END,expires_on,id',
        )
        .all<PantryStock>(),
    ]);
    const deduction = planPantryDeduction(
      stockRows.results,
      ingredientRows.results,
      targetServings / Math.max(1, recipe.servings),
      new Date().toISOString().slice(0, 10),
    );
    if (deduction.missing.length)
      throw new DataError(
        'There is not enough unexpired food to cook this recipe.',
      );
    const now = new Date().toISOString();
    return db.batch(
      deduction.deductions.map((item) =>
        db
          .prepare(
            'UPDATE food_items SET quantity=MAX(0,quantity-?),updated_by=?,updated_at=? WHERE id=?',
          )
          .bind(item.amount, userId, now, item.id),
      ),
    );
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
      const servings = Math.max(
        1,
        Math.round(cleanNumber(record.servings || 3, 100)),
      );
      if (
        !recipeId ||
        !Number.isInteger(dayIndex) ||
        dayIndex < 0 ||
        dayIndex > 6 ||
        !course ||
        recipeCourseById.get(recipeId) !== course
      )
        throw new DataError('Every planned meal must reference its recipe.');
      return { recipeId, dayIndex, course, servings };
    });
    if (
      new Set(entries.map((entry) => `${entry.dayIndex}:${entry.course}`))
        .size !== entries.length
    )
      throw new DataError('The weekly menu contains duplicate meals.');
    const now = new Date().toISOString();
    return db.batch([
      db
        .prepare('DELETE FROM weekly_meal_plan WHERE week_start=?')
        .bind(weekStart),
      ...entries.map((entry) =>
        db
          .prepare(
            'INSERT INTO weekly_meal_plan (week_start,day_index,course,recipe_id,servings,created_by,created_at) VALUES (?,?,?,?,?,?,?)',
          )
          .bind(
            weekStart,
            entry.dayIndex,
            entry.course,
            entry.recipeId,
            entry.servings,
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
  throw new DataError('Unknown food action.', 400, 'unknown_action');
}
