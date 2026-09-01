'use client';

import { useState } from 'react';
import {
  Activity,
  Calculator,
  Info,
  Lock,
  Plus,
  Salad,
  Scale,
  Users,
} from 'lucide-react';
import type { AuthUser } from '@/db/auth';
import { submitForm } from '../../client/forms';
import { Field } from '../../components/app-field';
import {
  Avatar,
  Empty,
  PageTitle,
  PrivacyBadge,
  PrivacySelect,
} from '../../components/app-ui';
import type { Language } from '../../i18n';
import type { Data, Nutrition, Post, T } from '../types';

export type NutritionTotals = {
  calories: number;
  protein: number;
  carbs: number;
  fat: number;
};
export function sumNutrition(items: Nutrition[]): NutritionTotals {
  return items.reduce(
    (sum, item) => ({
      calories: sum.calories + item.calories,
      protein: sum.protein + item.protein,
      carbs: sum.carbs + item.carbs,
      fat: sum.fat + item.fat,
    }),
    { calories: 0, protein: 0, carbs: 0, fat: 0 },
  );
}
export function Macro({
  name,
  value,
  goal,
  cls,
}: {
  name: string;
  value: number;
  goal: number;
  cls: string;
}) {
  return (
    <div>
      <span>
        <i className={`dot ${cls}`} />
        {name}
      </span>
      <b>
        {value} / {goal}g
      </b>
      <progress value={value} max={goal} />
    </div>
  );
}
function MacroCard({
  label,
  value,
  goal,
  t,
}: {
  label: string;
  value: number;
  goal: number;
  t: T;
}) {
  return (
    <div>
      <span>{label}</span>
      <strong>{value}g</strong>
      <progress value={value} max={goal} />
      <small>{t('goal', { count: goal })}</small>
    </div>
  );
}

export function NutritionView({
  data,
  user,
  totals,
  post,
  t,
  language,
}: {
  data: Data;
  user: AuthUser;
  totals: NutritionTotals;
  post: Post;
  t: T;
  language: Language;
}) {
  const [scope, setScope] = useState<'mine' | 'calculator' | 'shared'>('mine');
  const shared = data.nutrition.filter((item) => !item.owned);
  const sharedMembers = data.members
    .map((member) => ({
      member,
      items: shared.filter((item) => item.userId === member.id),
    }))
    .filter((group) => group.items.length);
  return (
    <>
      <PageTitle
        eyebrow={t('nutritionEyebrow')}
        title={t('nutrition')}
        copy={t('nutritionCopy')}
      />
      <fieldset className="member-tabs">
        <legend className="sr-only">{t('nutrition')}</legend>
        <button
          type="button"
          className={scope === 'mine' ? 'selected' : ''}
          aria-pressed={scope === 'mine'}
          onClick={() => setScope('mine')}
        >
          <Avatar person={user} small />
          {t('yourNutrition')}
        </button>
        <button
          type="button"
          className={scope === 'calculator' ? 'selected' : ''}
          aria-pressed={scope === 'calculator'}
          onClick={() => setScope('calculator')}
        >
          <Calculator size={16} />
          {t('nutritionCalculator')}
        </button>
        <button
          type="button"
          className={scope === 'shared' ? 'selected' : ''}
          aria-pressed={scope === 'shared'}
          onClick={() => setScope('shared')}
        >
          <Users size={16} />
          {t('sharedNutrition')}
        </button>
      </fieldset>
      {scope === 'mine' ? (
        <>
          <div className="feature-grid">
            <article className="panel nutrition-summary">
              <div
                className="calorie-ring large"
                style={{
                  background: `conic-gradient(var(--orange) 0 ${Math.min(100, (totals.calories / user.calorieGoal) * 100)}%,#eeeae2 0)`,
                }}
              >
                <span>
                  <strong>{totals.calories}</strong>
                  <small>
                    {t('kcalRemaining', {
                      count: Math.max(0, user.calorieGoal - totals.calories),
                    })}
                  </small>
                </span>
              </div>
              <div className="macro-cards">
                <MacroCard
                  label={t('protein')}
                  value={totals.protein}
                  goal={user.proteinGoal}
                  t={t}
                />
                <MacroCard
                  label={t('carbs')}
                  value={totals.carbs}
                  goal={user.carbGoal}
                  t={t}
                />
                <MacroCard
                  label={t('fats')}
                  value={totals.fat}
                  goal={user.fatGoal}
                  t={t}
                />
              </div>
            </article>
            <article className="panel entry-panel">
              <h2>{t('logMeal')}</h2>
              <p>{t('shareMealHint')}</p>
              <form
                className="form-grid"
                onSubmit={(event) => submitForm(event, post, 'nutrition')}
              >
                <Field
                  name="label"
                  label={t('meal')}
                  placeholder={t('dinner')}
                />
                <Field
                  name="calories"
                  label={t('calories')}
                  type="number"
                  min={0}
                  max={20_000}
                  step={1}
                />
                <Field
                  name="protein"
                  label={`${t('protein')} (g)`}
                  type="number"
                  min={0}
                  max={2_000}
                  step={1}
                />
                <Field
                  name="carbs"
                  label={`${t('carbs')} (g)`}
                  type="number"
                  min={0}
                  max={2_000}
                  step={1}
                />
                <Field
                  name="fat"
                  label={`${t('fats')} (g)`}
                  type="number"
                  min={0}
                  max={2_000}
                  step={1}
                />
                <PrivacySelect t={t} defaultValue="shared" />
                <button className="primary-button">
                  <Plus size={16} />
                  {t('addMeal')}
                </button>
              </form>
            </article>
          </div>
          <NutritionTable
            items={data.nutrition.filter((item) => item.owned)}
            title={t('todaysMeals')}
            subtitle={t('yourLog')}
            empty={t('noMeals')}
            t={t}
          />
        </>
      ) : scope === 'calculator' ? (
        <NutritionCalculator
          user={user}
          post={post}
          t={t}
          language={language}
        />
      ) : (
        <div className="shared-nutrition-grid">
          {sharedMembers.length ? (
            sharedMembers.map(({ member, items }) => (
              <article className="panel shared-nutrition-card" key={member.id}>
                <div className="member-heading">
                  <Avatar person={member} />
                  <div>
                    <h2>{member.name}</h2>
                    <span>{t('messagesCount', { count: items.length })}</span>
                  </div>
                </div>
                <NutritionTotalsView totals={sumNutrition(items)} t={t} />
                <div className="shared-meals">
                  {items.map((item) => (
                    <div key={item.id}>
                      <strong>{item.label}</strong>
                      <span>
                        {item.calories} kcal · {item.protein}P · {item.carbs}C ·{' '}
                        {item.fat}F
                      </span>
                    </div>
                  ))}
                </div>
              </article>
            ))
          ) : (
            <article className="panel">
              <Empty>{t('noSharedMeals')}</Empty>
            </article>
          )}
        </div>
      )}
    </>
  );
}
function NutritionTotalsView({ totals, t }: { totals: NutritionTotals; t: T }) {
  return (
    <div className="nutrition-total-row">
      <span>
        <strong>{totals.calories}</strong> kcal
      </span>
      <span>
        {t('protein')} <b>{totals.protein}g</b>
      </span>
      <span>
        {t('carbs')} <b>{totals.carbs}g</b>
      </span>
      <span>
        {t('fats')} <b>{totals.fat}g</b>
      </span>
    </div>
  );
}
function NutritionTable({
  items,
  title,
  subtitle,
  empty,
  t,
}: {
  items: Nutrition[];
  title: string;
  subtitle: string;
  empty: string;
  t: T;
}) {
  return (
    <article className="panel table-panel">
      <div className="panel-heading">
        <div>
          <h2>{title}</h2>
          <span>{subtitle}</span>
        </div>
      </div>
      <div className="data-table nutrition-table">
        {items.length ? (
          items.map((item) => (
            <div key={item.id}>
              <strong>{item.label}</strong>
              <span>{item.calories} kcal</span>
              <span>{item.protein}P</span>
              <span>{item.carbs}C</span>
              <span>{item.fat}F</span>
              <PrivacyBadge visibility={item.visibility} t={t} />
            </div>
          ))
        ) : (
          <Empty>{empty}</Empty>
        )}
      </div>
    </article>
  );
}

type NutritionPlan = 'lose' | 'maintain' | 'gain';
type DietPreference = 'omnivore' | 'vegetarian' | 'vegan';
function foodGroups(
  language: Language,
  plan: NutritionPlan,
  diet: DietPreference,
) {
  const ru = language === 'ru';
  const protein =
    diet === 'vegan'
      ? ru
        ? ['Тофу и темпе', 'Чечевица', 'Фасоль', 'Соевый йогурт']
        : ['Tofu & tempeh', 'Lentils', 'Beans', 'Soy yogurt']
      : diet === 'vegetarian'
        ? ru
          ? ['Яйца', 'Творог', 'Греческий йогурт', 'Чечевица']
          : ['Eggs', 'Cottage cheese', 'Greek yogurt', 'Lentils']
        : ru
          ? ['Курица и индейка', 'Рыба', 'Яйца', 'Творог']
          : ['Chicken & turkey', 'Fish', 'Eggs', 'Cottage cheese'];
  const carbs =
    plan === 'gain'
      ? ru
        ? ['Рис', 'Макароны', 'Овсянка', 'Цельнозерновой хлеб']
        : ['Rice', 'Pasta', 'Oats', 'Whole-grain bread']
      : plan === 'lose'
        ? ru
          ? ['Картофель', 'Гречка', 'Овсянка', 'Бобовые']
          : ['Potatoes', 'Buckwheat', 'Oats', 'Legumes']
        : ru
          ? ['Гречка', 'Рис', 'Овсянка', 'Картофель']
          : ['Buckwheat', 'Rice', 'Oats', 'Potatoes'];
  const fats =
    plan === 'gain'
      ? ru
        ? ['Ореховая паста', 'Авокадо', 'Оливковое масло', 'Орехи']
        : ['Nut butter', 'Avocado', 'Olive oil', 'Nuts']
      : ru
        ? ['Оливковое масло', 'Орехи', 'Семечки', 'Авокадо']
        : ['Olive oil', 'Nuts', 'Seeds', 'Avocado'];
  const produce =
    plan === 'gain'
      ? ru
        ? ['Бананы', 'Сухофрукты', 'Ягоды', 'Замороженные овощи']
        : ['Bananas', 'Dried fruit', 'Berries', 'Frozen vegetables']
      : ru
        ? ['Листовая зелень', 'Овощи', 'Ягоды', 'Яблоки']
        : ['Leafy greens', 'Vegetables', 'Berries', 'Apples'];
  return [
    { key: 'foodProtein' as const, items: protein },
    { key: 'foodCarbs' as const, items: carbs },
    { key: 'foodFats' as const, items: fats },
    { key: 'foodProduce' as const, items: produce },
  ];
}

function NutritionCalculator({
  user,
  post,
  t,
  language,
}: {
  user: AuthUser;
  post: Post;
  t: T;
  language: Language;
}) {
  const configured =
    user.heightCm !== null &&
    user.weightKg !== null &&
    user.age !== null &&
    user.sex !== null &&
    user.activity !== null &&
    user.nutritionPlan !== null &&
    user.diet !== null &&
    user.maintenanceCalories !== null;
  const plan = (user.nutritionPlan || 'maintain') as NutritionPlan;
  const diet = (user.diet || 'omnivore') as DietPreference;
  const groups = foodGroups(language, plan, diet);
  const planLabel =
    plan === 'lose'
      ? t('loseWeight')
      : plan === 'gain'
        ? t('gainWeight')
        : t('maintainWeight');
  return (
    <div className="calculator-stack">
      <div className="calculator-grid">
        <article className="panel calculator-form-card">
          <div className="calculator-heading">
            <span className="tinted-icon orange">
              <Calculator size={19} />
            </span>
            <div>
              <h2>{t('nutritionCalculator')}</h2>
              <p>{t('calculatorIntro')}</p>
            </div>
          </div>
          <div className="private-calculator-note">
            <Lock size={13} />
            {t('profilePrivate')}
          </div>
          <form
            key={`${user.heightCm}-${user.weightKg}-${user.age}-${user.sex}-${user.activity}-${user.nutritionPlan}-${user.diet}`}
            className="calculator-form"
            onSubmit={(event) => submitForm(event, post, 'nutrition-profile')}
          >
            <Field
              name="heightCm"
              label={t('heightCm')}
              type="number"
              min={120}
              max={250}
              step="0.1"
              defaultValue={
                user.heightCm === null ? undefined : String(user.heightCm)
              }
            />
            <Field
              name="weightKg"
              label={t('weightKg')}
              type="number"
              min={35}
              max={350}
              step="0.1"
              defaultValue={
                user.weightKg === null ? undefined : String(user.weightKg)
              }
            />
            <Field
              name="age"
              label={t('ageYears')}
              type="number"
              min={19}
              max={100}
              step={1}
              defaultValue={user.age === null ? undefined : String(user.age)}
            />
            <label className="form-field">
              <span>{t('formulaSex')}</span>
              <select name="sex" defaultValue={user.sex || 'male'}>
                <option value="male">{t('male')}</option>
                <option value="female">{t('female')}</option>
              </select>
            </label>
            <label className="form-field">
              <span>{t('activityLevel')}</span>
              <select
                name="activity"
                defaultValue={user.activity || 'inactive'}
              >
                <option value="inactive">{t('inactive')}</option>
                <option value="low">{t('lowActive')}</option>
                <option value="active">{t('activeLevel')}</option>
                <option value="very">{t('veryActive')}</option>
              </select>
            </label>
            <label className="form-field">
              <span>{t('weightPlan')}</span>
              <select
                name="plan"
                defaultValue={user.nutritionPlan || 'maintain'}
              >
                <option value="lose">{t('loseWeight')}</option>
                <option value="maintain">{t('maintainWeight')}</option>
                <option value="gain">{t('gainWeight')}</option>
              </select>
            </label>
            <label className="form-field">
              <span>{t('dietPreference')}</span>
              <select name="diet" defaultValue={user.diet || 'omnivore'}>
                <option value="omnivore">{t('omnivore')}</option>
                <option value="vegetarian">{t('vegetarian')}</option>
                <option value="vegan">{t('vegan')}</option>
              </select>
            </label>
            <button className="primary-button calculator-submit">
              <Scale size={16} />
              {t('calculatePlan')}
            </button>
          </form>
        </article>
        <article
          className={`panel plan-results ${configured ? 'configured' : ''}`}
        >
          <div className="calculator-heading">
            <span className="tinted-icon green">
              <Activity size={19} />
            </span>
            <div>
              <h2>{t('yourPlan')}</h2>
              <p>{configured ? planLabel : t('calculatorIntro')}</p>
            </div>
          </div>
          {configured ? (
            <>
              <div className="calorie-targets">
                <div>
                  <span>{t('dailyTarget')}</span>
                  <strong>{user.calorieGoal}</strong>
                  <small>kcal</small>
                </div>
                <div>
                  <span>{t('maintenanceEstimate')}</span>
                  <strong>{user.maintenanceCalories}</strong>
                  <small>kcal</small>
                </div>
              </div>
              <p className="plan-adjustment">
                {plan === 'maintain'
                  ? t('maintenanceEstimate')
                  : t('planAdjustment', { percent: 10 })}
              </p>
              <div className="plan-macros">
                <span>
                  <i className="dot protein" />
                  <b>{user.proteinGoal}g</b>
                  {t('protein')}
                </span>
                <span>
                  <i className="dot carbs" />
                  <b>{user.carbGoal}g</b>
                  {t('carbs')}
                </span>
                <span>
                  <i className="dot fats" />
                  <b>{user.fatGoal}g</b>
                  {t('fats')}
                </span>
              </div>
            </>
          ) : (
            <div className="calculator-placeholder">
              <Scale size={38} />
              <p>{t('calculatorIntro')}</p>
            </div>
          )}
        </article>
      </div>
      {configured && (
        <article className="panel food-suggestions">
          <div className="panel-heading">
            <div>
              <h2>{t('foodSuggestions')}</h2>
              <span>{t('foodSuggestionCopy')}</span>
            </div>
            <Salad size={20} />
          </div>
          <div className="food-groups">
            {groups.map((group) => (
              <section key={group.key}>
                <h3>{t(group.key)}</h3>
                <div>
                  {group.items.map((item) => (
                    <span key={item}>{item}</span>
                  ))}
                </div>
              </section>
            ))}
          </div>
        </article>
      )}
      <article className="panel method-card">
        <Info size={20} />
        <div>
          <h2>{t('methodTitle')}</h2>
          <p>{t('methodCopy')}</p>
          <p>
            {t('estimateWarning')} {t('adultOnly')}
          </p>
          <div>
            <a
              href="https://www.nationalacademies.org/read/26818/chapter/2"
              target="_blank"
              rel="noreferrer"
            >
              2023 Energy DRI
            </a>
            <a
              href="https://www.nationalacademies.org/index.php/cdn/materials/9fb9fae6-337c-4b7c-9821-2c81d1f65ad0"
              target="_blank"
              rel="noreferrer"
            >
              Adult AMDR
            </a>
          </div>
        </div>
      </article>
    </div>
  );
}
