'use client';
/* oxlint-disable next(no-img-element) */

import {
  useEffect,
  useMemo,
  useState,
  type ReactNode,
  type SubmitEvent,
} from 'react';
import {
  Activity,
  ArrowRight,
  Calculator,
  Camera,
  Check,
  CheckCircle2,
  ChefHat,
  Cigarette,
  CircleDollarSign,
  ClipboardCheck,
  Droplets,
  Flame,
  Home,
  Image as ImageIcon,
  Info,
  Languages,
  ListTodo,
  LoaderCircle,
  Lock,
  LogOut,
  MessageCircle,
  Minus,
  PackageOpen,
  Plus,
  Salad,
  Scale,
  Search,
  Send,
  Settings,
  ShoppingBasket,
  Sparkles,
  Trash2,
  Utensils,
  Users,
  WalletCards,
  Wine,
} from 'lucide-react';
import type { AuthUser } from '@/db/auth';
import { useLanguage, type CopyKey, type Language } from './i18n';

type Visibility = 'private' | 'shared';
type Member = {
  id: number;
  name: string;
  initials: string;
  color: string;
  avatar: string | null;
};
type HomeProfile = { name: string; address: string; photo: string | null };
type Nutrition = {
  id: number;
  userId: number;
  label: string;
  calories: number;
  protein: number;
  carbs: number;
  fat: number;
  eatenOn: string;
  visibility: Visibility;
  owned: boolean | number;
  name: string;
  initials: string;
  color: string;
  avatar: string | null;
};
type Task = {
  id: number;
  title: string;
  status: string;
  tag: string;
  due: string;
  visibility: Visibility;
  owned: boolean | number;
};
type Expense = {
  id: number;
  label: string;
  amount: number;
  category: string;
  spentOn: string;
  visibility: Visibility;
  owned: boolean | number;
};
type Organiser = {
  id: number;
  list: string;
  label: string;
  done: boolean | number;
  visibility: Visibility;
  owned: boolean | number;
};
type Message = {
  id: number;
  body: string;
  createdAt: string;
  name: string;
  initials: string;
  color: string;
  avatar: string | null;
  mine: boolean | number;
};
type HabitKind = 'vaping' | 'alcohol';
type HabitEntry = {
  id: number;
  userId: number;
  habit: HabitKind;
  occurrences: number;
  cost: number;
  occurredOn: string;
  createdAt: string;
  name: string;
  initials: string;
  color: string;
  avatar: string | null;
  mine: boolean | number;
};
type WaterEntry = {
  id: number;
  amountMl: number;
  drunkOn: string;
  createdAt: string;
};
type FoodUnit = 'g' | 'kg' | 'ml' | 'l' | 'pcs';
type FoodItem = {
  id: number;
  name: string;
  normalizedName: string;
  quantity: number;
  unit: FoodUnit;
  category: string;
  expiresOn: string | null;
  updatedAt: string;
  updatedByName: string;
};
type RecipeIngredient = {
  id: number;
  recipeId: number;
  name: string;
  normalizedName: string;
  quantity: number;
  unit: FoodUnit;
};
type Recipe = {
  id: number;
  name: string;
  servings: number;
  instructions: string;
  createdAt: string;
  createdByName: string;
  ingredients: RecipeIngredient[];
};
type Data = {
  currentUser: AuthUser;
  members: Member[];
  home: HomeProfile;
  nutrition: Nutrition[];
  tasks: Task[];
  expenses: Expense[];
  organisers: Organiser[];
  messages: Message[];
  habits: HabitEntry[];
  water: WaterEntry[];
  foods: FoodItem[];
  recipes: Recipe[];
};
type Post = (payload: Record<string, unknown>) => Promise<boolean>;
type T = (key: CopyKey, variables?: Record<string, string | number>) => string;

const navigation = [
  { id: 'overview', key: 'overview', icon: Home },
  { id: 'nutrition', key: 'nutrition', icon: Utensils },
  { id: 'food', key: 'foodStorage', icon: PackageOpen },
  { id: 'water', key: 'water', icon: Droplets },
  { id: 'habits', key: 'habits', icon: Cigarette },
  { id: 'tasks', key: 'tasks', icon: ListTodo },
  { id: 'spending', key: 'spending', icon: WalletCards },
  { id: 'organisers', key: 'organisers', icon: ClipboardCheck },
  { id: 'chat', key: 'chat', icon: MessageCircle },
  { id: 'home', key: 'homeSettings', icon: Settings },
] as const;
const empty = (user: AuthUser): Data => ({
  currentUser: user,
  members: [user],
  home: { name: 'Our home', address: '', photo: null },
  nutrition: [],
  tasks: [],
  expenses: [],
  organisers: [],
  messages: [],
  habits: [],
  water: [],
  foods: [],
  recipes: [],
});

function Avatar({
  person,
  small = false,
}: {
  person: { initials?: string; color?: string; avatar?: string | null };
  small?: boolean;
}) {
  return (
    <span
      className={small ? 'avatar avatar-small' : 'avatar'}
      style={{ backgroundColor: person.color }}
    >
      {person.avatar ? <img src={person.avatar} alt="" /> : person.initials}
    </span>
  );
}
function Field({
  name,
  label,
  type = 'text',
  placeholder,
  defaultValue,
}: {
  name: string;
  label: string;
  type?: string;
  placeholder?: string;
  defaultValue?: string;
}) {
  return (
    <label className="form-field">
      <span>{label}</span>
      <input
        name={name}
        type={type}
        placeholder={placeholder}
        defaultValue={defaultValue}
        min={type === 'number' ? 0 : undefined}
        step={type === 'number' ? 'any' : undefined}
        required
      />
    </label>
  );
}
function PrivacySelect({
  t,
  defaultValue = 'private',
}: {
  t: T;
  defaultValue?: Visibility;
}) {
  return (
    <label className="form-field">
      <span>{t('privacy')}</span>
      <select name="visibility" defaultValue={defaultValue}>
        <option value="private">{t('private')}</option>
        <option value="shared">{t('shared')}</option>
      </select>
    </label>
  );
}
function PrivacyBadge({ visibility, t }: { visibility: Visibility; t: T }) {
  return (
    <span className={`privacy-badge ${visibility}`}>
      {visibility === 'private' ? <Lock size={11} /> : <Users size={11} />}{' '}
      {t(visibility)}
    </span>
  );
}
function Empty({ children }: { children: string }) {
  return <div className="empty-state">{children}</div>;
}
function PageTitle({
  eyebrow,
  title,
  copy,
  action,
}: {
  eyebrow: string;
  title: string;
  copy: string;
  action?: ReactNode;
}) {
  return (
    <div className="welcome">
      <div>
        <span className="eyebrow">{eyebrow}</span>
        <h1>
          {title} <span>✦</span>
        </h1>
        <p>{copy}</p>
      </div>
      {action}
    </div>
  );
}
function LanguageSwitch({
  language,
  setLanguage,
}: {
  language: Language;
  setLanguage: (language: Language) => void;
}) {
  return (
    <label className="language-switch">
      <Languages size={15} />
      <select
        value={language}
        onChange={(event) => setLanguage(event.target.value as Language)}
        aria-label="Language"
      >
        <option value="en">EN</option>
        <option value="ru">RU</option>
      </select>
    </label>
  );
}

export default function HouseholdApp({
  initialUser,
}: {
  initialUser: AuthUser;
}) {
  const { language, setLanguage, t } = useLanguage();
  const [active, setActive] = useState('overview');
  const [data, setData] = useState<Data>(empty(initialUser));
  const [loading, setLoading] = useState(true);
  const [notice, setNotice] = useState('');
  async function load() {
    try {
      const response = await fetch('/api/schwank', { cache: 'no-store' });
      if (response.status === 401) {
        window.location.assign('/login');
        return;
      }
      if (!response.ok) throw new Error();
      setData(await response.json());
    } catch {
      setNotice(t('storageFailed'));
    } finally {
      setLoading(false);
    }
  }
  useEffect(() => {
    void load();
  }, []);
  const post: Post = async (payload) => {
    setNotice(t('saving'));
    const response = await fetch('/api/schwank', {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify(payload),
    });
    if (response.status === 401) {
      window.location.assign('/login');
      return false;
    }
    const result = (await response.json().catch(() => ({}))) as {
      error?: string;
    };
    if (response.ok) {
      await load();
      setNotice(
        payload.visibility === 'private' ? t('savedPrivately') : t('saved'),
      );
      setTimeout(() => setNotice(''), 1600);
      return true;
    }
    setNotice(result.error || t('saveFailed'));
    return false;
  };
  async function logout() {
    await fetch('/api/auth/logout', { method: 'POST' });
    window.location.assign('/login');
  }
  const user = data.currentUser;
  const ownNutrition = data.nutrition.filter((item) => item.owned);
  const totals = sumNutrition(ownNutrition);
  const totalSpend = data.expenses.reduce(
    (sum, item) => sum + Number(item.amount),
    0,
  );
  const completed = data.tasks.filter((item) => item.status === 'done').length;
  const taskPercent = data.tasks.length
    ? Math.round((completed / data.tasks.length) * 100)
    : 0;
  const common = { data, t, language, post };
  const view =
    active === 'overview' ? (
      <Overview
        {...common}
        user={user}
        totals={totals}
        totalSpend={totalSpend}
        taskPercent={taskPercent}
        setActive={setActive}
      />
    ) : active === 'nutrition' ? (
      <NutritionView {...common} user={user} totals={totals} />
    ) : active === 'food' ? (
      <FoodStorageView {...common} />
    ) : active === 'water' ? (
      <WaterView {...common} user={user} />
    ) : active === 'habits' ? (
      <HabitsView {...common} />
    ) : active === 'tasks' ? (
      <TasksView {...common} />
    ) : active === 'spending' ? (
      <SpendingView {...common} total={totalSpend} />
    ) : active === 'organisers' ? (
      <OrganisersView {...common} />
    ) : active === 'chat' ? (
      <ChatView {...common} user={user} />
    ) : (
      <HomeView {...common} user={user} />
    );
  return (
    <main className="app-shell">
      <aside className="sidebar">
        <div className="brand">
          <span className="brand-mark">
            <Sparkles size={18} />
          </span>
          <div>
            <strong>schwank</strong>
            <span>{t('sharedSpace')}</span>
          </div>
        </div>
        <nav className="side-nav" aria-label="Main navigation">
          {navigation.map((item) => {
            const Icon = item.icon;
            const count =
              item.id === 'tasks'
                ? data.tasks.filter((task) => task.status !== 'done').length
                : item.id === 'chat'
                  ? Math.min(data.messages.length, 9)
                  : 0;
            return (
              <button
                type="button"
                onClick={() => setActive(item.id)}
                className={active === item.id ? 'nav-item active' : 'nav-item'}
                key={item.id}
              >
                <Icon size={18} />
                <span>{t(item.key)}</span>
                {count > 0 && <em>{count}</em>}
              </button>
            );
          })}
        </nav>
        <button
          className="house-card house-button"
          onClick={() => setActive('home')}
        >
          <div
            className="house-illustration"
            style={
              data.home.photo
                ? {
                    backgroundImage: `linear-gradient(#0002,#0002),url(${data.home.photo})`,
                  }
                : undefined
            }
          >
            {!data.home.photo && <Home size={24} />}
          </div>
          <strong>{data.home.name}</strong>
          <span>{data.home.address || t('noAddress')}</span>
          <div className="avatar-stack">
            {data.members.slice(0, 5).map((member) => (
              <Avatar key={member.id} person={member} small />
            ))}
          </div>
        </button>
        <div className="profile-row">
          <Avatar person={user} />
          <span>
            <strong>{user.name}</strong>
            <small>{user.email}</small>
          </span>
          <button
            className="logout-button"
            onClick={logout}
            aria-label={t('signOut')}
          >
            <LogOut size={17} />
          </button>
        </div>
      </aside>
      <section className="workspace">
        <header className="topbar">
          <button
            className="mobile-brand"
            onClick={() => setActive('overview')}
          >
            <span className="brand-mark">
              <Sparkles size={17} />
            </span>
            schwank
          </button>
          <span className="privacy-note">
            <Lock size={14} />
            {t('privacyNote')}
          </span>
          <div className="topbar-actions">
            <LanguageSwitch language={language} setLanguage={setLanguage} />
            <button
              className="icon-button"
              aria-label={t('addTask')}
              onClick={() => setActive('tasks')}
            >
              <Plus size={19} />
            </button>
            <button className="person-picker" onClick={() => setActive('home')}>
              <Avatar person={user} small />
              <span>{user.name}</span>
            </button>
          </div>
        </header>
        {notice && <output className="toast">{notice}</output>}
        <div className="content">
          {loading ? (
            <div className="loading-state">
              <LoaderCircle className="spin" />
              {t('opening')}
            </div>
          ) : (
            view
          )}
        </div>
      </section>
    </main>
  );
}

function Overview({
  data,
  user,
  totals,
  totalSpend,
  taskPercent,
  setActive,
  t,
  language,
}: {
  data: Data;
  user: AuthUser;
  totals: NutritionTotals;
  totalSpend: number;
  taskPercent: number;
  setActive: (value: string) => void;
  t: T;
  language: Language;
  post: Post;
}) {
  const recent = data.tasks
    .filter((task) => task.status !== 'done')
    .slice(0, 4);
  const groceries = data.organisers
    .filter((item) => item.list === 'Groceries' && !item.done)
    .slice(0, 4);
  const done = data.tasks.filter((task) => task.status === 'done').length;
  return (
    <>
      <PageTitle
        eyebrow={data.home.name}
        title={t('hello', { name: user.name })}
        copy={data.home.address || t('overviewCopy')}
        action={
          <button className="primary-button" onClick={() => setActive('tasks')}>
            <Plus size={18} />
            {t('addTask')}
          </button>
        }
      />
      <div className="stats-grid">
        <article className="stat-card nutrition-card">
          <div className="stat-heading">
            <span className="tinted-icon orange">
              <Flame size={19} />
            </span>
            <span>{t('todayNutrition')}</span>
            <button onClick={() => setActive('nutrition')}>
              <ArrowRight size={17} />
            </button>
          </div>
          <div className="nutrition-body">
            <div
              className="calorie-ring"
              style={{
                background: `conic-gradient(var(--orange) 0 ${Math.min(100, (totals.calories / user.calorieGoal) * 100)}%,#eeeae2 0)`,
              }}
            >
              <span>
                <strong>{totals.calories}</strong>
                <small>{t('ofKcal', { goal: user.calorieGoal })}</small>
              </span>
            </div>
            <div className="macro-list">
              <Macro
                name={t('protein')}
                value={totals.protein}
                goal={user.proteinGoal}
                cls="protein"
              />
              <Macro
                name={t('carbs')}
                value={totals.carbs}
                goal={user.carbGoal}
                cls="carbs"
              />
              <Macro
                name={t('fats')}
                value={totals.fat}
                goal={user.fatGoal}
                cls="fats"
              />
            </div>
          </div>
          <button
            onClick={() => setActive('nutrition')}
            className="text-button"
          >
            {t('logMeal')} <ArrowRight size={15} />
          </button>
        </article>
        <article className="stat-card spending-card">
          <div className="stat-heading">
            <span className="tinted-icon green">
              <CircleDollarSign size={19} />
            </span>
            <span>{t('visibleSpending')}</span>
            <button onClick={() => setActive('spending')}>
              <ArrowRight size={17} />
            </button>
          </div>
          <div className="spend-total">
            <strong>{money(totalSpend, language)}</strong>
            <span>
              {t('recordedExpenses', { count: data.expenses.length })}
            </span>
          </div>
          <div className="clean-summary">
            <WalletCards size={24} />
            <span>{t('visibleSpendingCopy')}</span>
          </div>
        </article>
        <article className="stat-card progress-card">
          <div className="stat-heading">
            <span className="tinted-icon blue">
              <CheckCircle2 size={19} />
            </span>
            <span>{t('taskProgress')}</span>
            <button onClick={() => setActive('tasks')}>
              <ArrowRight size={17} />
            </button>
          </div>
          <div className="progress-number">
            <strong>{taskPercent}%</strong>
            <span>
              {t('tasksComplete', { done, total: data.tasks.length })}
            </span>
          </div>
          <div className="big-progress">
            <i style={{ width: `${taskPercent}%` }} />
          </div>
        </article>
      </div>
      <div className="lower-grid">
        <article className="panel task-panel">
          <div className="panel-heading">
            <div>
              <h2>{t('upNext')}</h2>
              <span>{t('activeTasks', { count: recent.length })}</span>
            </div>
            <button className="link-button" onClick={() => setActive('tasks')}>
              {t('viewBoard')} <ArrowRight size={15} />
            </button>
          </div>
          <div className="task-list">
            {recent.length ? (
              recent.map((task) => (
                <div className="task-row" key={task.id}>
                  <span className="check" />
                  <div className="task-copy">
                    <strong>{task.title}</strong>
                    <span>{task.due}</span>
                  </div>
                  <PrivacyBadge visibility={task.visibility} t={t} />
                </div>
              ))
            ) : (
              <Empty>{t('noTasks')}</Empty>
            )}
          </div>
        </article>
        <div className="right-stack">
          <article className="panel groceries-panel">
            <div className="panel-heading">
              <div>
                <h2>{t('groceryList')}</h2>
                <span>{t('visibleItems', { count: groceries.length })}</span>
              </div>
              <span className="tinted-icon peach">
                <ShoppingBasket size={18} />
              </span>
            </div>
            <div className="grocery-list">
              {groceries.length ? (
                groceries.map((item) => <span key={item.id}>{item.label}</span>)
              ) : (
                <Empty>{t('noGroceries')}</Empty>
              )}
            </div>
            <button
              onClick={() => setActive('organisers')}
              className="add-row compact"
            >
              {t('openOrganisers')}
            </button>
          </article>
          <article className="panel chat-panel">
            <div className="panel-heading">
              <div>
                <h2>{t('houseChat')}</h2>
                <span>
                  {t('messagesCount', { count: data.messages.length })}
                </span>
              </div>
              <button onClick={() => setActive('chat')} className="link-button">
                {t('openChat')}
              </button>
            </div>
            {data.messages.length ? (
              data.messages.slice(-2).map((message) => (
                <div className="message-preview" key={message.id}>
                  <Avatar person={message} />
                  <div>
                    <strong>{message.name}</strong>
                    <p>{message.body}</p>
                  </div>
                </div>
              ))
            ) : (
              <Empty>{t('noMessages')}</Empty>
            )}
          </article>
        </div>
      </div>
    </>
  );
}

type NutritionTotals = {
  calories: number;
  protein: number;
  carbs: number;
  fat: number;
};
function sumNutrition(items: Nutrition[]): NutritionTotals {
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
function Macro({
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

function NutritionView({
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
      <div className="member-tabs">
        <button
          className={scope === 'mine' ? 'selected' : ''}
          onClick={() => setScope('mine')}
        >
          <Avatar person={user} small />
          {t('yourNutrition')}
        </button>
        <button
          className={scope === 'calculator' ? 'selected' : ''}
          onClick={() => setScope('calculator')}
        >
          <Calculator size={16} />
          {t('nutritionCalculator')}
        </button>
        <button
          className={scope === 'shared' ? 'selected' : ''}
          onClick={() => setScope('shared')}
        >
          <Users size={16} />
          {t('sharedNutrition')}
        </button>
      </div>
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
                <Field name="calories" label={t('calories')} type="number" />
                <Field
                  name="protein"
                  label={`${t('protein')} (g)`}
                  type="number"
                />
                <Field name="carbs" label={`${t('carbs')} (g)`} type="number" />
                <Field name="fat" label={`${t('fats')} (g)`} type="number" />
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
              defaultValue={
                user.heightCm === null ? undefined : String(user.heightCm)
              }
            />
            <Field
              name="weightKg"
              label={t('weightKg')}
              type="number"
              defaultValue={
                user.weightKg === null ? undefined : String(user.weightKg)
              }
            />
            <Field
              name="age"
              label={t('ageYears')}
              type="number"
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

const foodUnitDimension: Record<FoodUnit, 'mass' | 'volume' | 'count'> = {
  g: 'mass',
  kg: 'mass',
  ml: 'volume',
  l: 'volume',
  pcs: 'count',
};
const foodUnitScale: Record<FoodUnit, number> = {
  g: 1,
  kg: 1000,
  ml: 1,
  l: 1000,
  pcs: 1,
};
const normalizedFoodName = (value: string) =>
  value.normalize('NFKC').trim().toLocaleLowerCase('en').replace(/\s+/g, ' ');
const foodStep = (unit: FoodUnit) =>
  unit === 'pcs' ? 1 : unit === 'kg' || unit === 'l' ? 0.1 : 100;
function formatFoodQuantity(value: number, unit: FoodUnit, t: T) {
  return `${new Intl.NumberFormat(undefined, { maximumFractionDigits: 2 }).format(value)} ${unit === 'pcs' ? t('pieces') : unit}`;
}
function recipeAvailability(recipe: Recipe, foods: FoodItem[]) {
  const todayKey = dateKey(new Date());
  return recipe.ingredients.map((ingredient) => {
    const matching = foods.filter(
      (food) =>
        (!food.expiresOn || food.expiresOn >= todayKey) &&
        food.normalizedName === ingredient.normalizedName &&
        foodUnitDimension[food.unit] === foodUnitDimension[ingredient.unit],
    );
    const availableBase = matching.reduce(
      (sum, food) => sum + Number(food.quantity) * foodUnitScale[food.unit],
      0,
    );
    const neededBase =
      Number(ingredient.quantity) * foodUnitScale[ingredient.unit];
    const available = availableBase / foodUnitScale[ingredient.unit];
    const missing =
      Math.max(0, neededBase - availableBase) / foodUnitScale[ingredient.unit];
    return { ingredient, available, missing, ready: missing <= 0.0001 };
  });
}

function RecipeBuilder({
  foods,
  post,
  t,
}: {
  foods: FoodItem[];
  post: Post;
  t: T;
}) {
  const [ingredients, setIngredients] = useState([
    { name: '', quantity: '', unit: 'g' as FoodUnit },
  ]);
  function updateIngredient(
    index: number,
    key: 'name' | 'quantity' | 'unit',
    value: string,
  ) {
    setIngredients((current) =>
      current.map((item, itemIndex) =>
        itemIndex === index ? { ...item, [key]: value } : item,
      ),
    );
  }
  async function save(event: SubmitEvent<HTMLFormElement>) {
    event.preventDefault();
    const form = event.currentTarget;
    const values = new FormData(form);
    const nameValue = values.get('name');
    const instructionsValue = values.get('instructions');
    const name = typeof nameValue === 'string' ? nameValue : '';
    const servings = Number(values.get('servings'));
    const instructions =
      typeof instructionsValue === 'string' ? instructionsValue : '';
    const cleanIngredients = ingredients.map((item) => ({
      name: item.name,
      quantity: Number(item.quantity),
      unit: item.unit,
    }));
    if (
      await post({
        type: 'recipe-add',
        name,
        servings,
        instructions,
        ingredients: cleanIngredients,
      })
    ) {
      form.reset();
      setIngredients([{ name: '', quantity: '', unit: 'g' }]);
    }
  }
  return (
    <article className="panel recipe-builder">
      <div className="panel-heading">
        <div>
          <h2>{t('recipeBuilder')}</h2>
          <span>{t('matchingHint')}</span>
        </div>
        <ChefHat size={20} />
      </div>
      <datalist id="food-inventory-names">
        {Array.from(new Set(foods.map((food) => food.name))).map((name) => (
          <option value={name} key={name}>
            {name}
          </option>
        ))}
      </datalist>
      <form onSubmit={save}>
        <div className="recipe-basics">
          <Field name="name" label={t('recipeName')} />
          <Field
            name="servings"
            label={t('servings')}
            type="number"
            defaultValue="2"
          />
        </div>
        <label className="form-field recipe-instructions">
          <span>{t('instructions')}</span>
          <textarea
            name="instructions"
            placeholder={t('instructionsPlaceholder')}
            maxLength={5000}
          />
        </label>
        <div className="ingredient-heading">
          <strong>{t('ingredients')}</strong>
          <button
            type="button"
            onClick={() =>
              setIngredients((current) => [
                ...current,
                { name: '', quantity: '', unit: 'g' },
              ])
            }
          >
            <Plus size={14} />
            {t('addIngredient')}
          </button>
        </div>
        <div className="ingredient-editor">
          {ingredients.map((ingredient, index) => (
            <div key={index}>
              <label>
                <span>{t('ingredient')}</span>
                <input
                  list="food-inventory-names"
                  value={ingredient.name}
                  onChange={(event) =>
                    updateIngredient(index, 'name', event.target.value)
                  }
                  required
                />
              </label>
              <label>
                <span>{t('quantity')}</span>
                <input
                  type="number"
                  min="0.01"
                  step="any"
                  value={ingredient.quantity}
                  onChange={(event) =>
                    updateIngredient(index, 'quantity', event.target.value)
                  }
                  required
                />
              </label>
              <label>
                <span>{t('unit')}</span>
                <select
                  value={ingredient.unit}
                  onChange={(event) =>
                    updateIngredient(index, 'unit', event.target.value)
                  }
                >
                  {(['g', 'kg', 'ml', 'l', 'pcs'] as FoodUnit[]).map((unit) => (
                    <option value={unit} key={unit}>
                      {unit === 'pcs' ? t('pieces') : unit}
                    </option>
                  ))}
                </select>
              </label>
              {ingredients.length > 1 && (
                <button
                  type="button"
                  className="remove-ingredient"
                  onClick={() =>
                    setIngredients((current) =>
                      current.filter((_, itemIndex) => itemIndex !== index),
                    )
                  }
                  aria-label={t('remove')}
                >
                  <Trash2 size={15} />
                </button>
              )}
            </div>
          ))}
        </div>
        <button className="primary-button recipe-save">
          <ChefHat size={16} />
          {t('saveRecipe')}
        </button>
      </form>
    </article>
  );
}

function FoodStorageView({ data, post, t }: { data: Data; post: Post; t: T }) {
  const [scope, setScope] = useState<'inventory' | 'recipes'>('inventory');
  const [search, setSearch] = useState('');
  const todayKey = dateKey(new Date());
  const soon = new Date();
  soon.setDate(soon.getDate() + 3);
  const soonKey = dateKey(soon);
  const expiring = data.foods.filter(
    (food) =>
      food.expiresOn && food.expiresOn >= todayKey && food.expiresOn <= soonKey,
  ).length;
  const readyRecipes = data.recipes.filter((recipe) =>
    recipeAvailability(recipe, data.foods).every((item) => item.ready),
  ).length;
  const visibleFoods = data.foods.filter((food) =>
    normalizedFoodName(food.name).includes(normalizedFoodName(search)),
  );
  return (
    <>
      <PageTitle
        eyebrow={t('storageEyebrow')}
        title={t('foodStorage')}
        copy={t('storageCopy')}
        action={
          <span className="public-banner">
            <Users size={15} />
            {t('alwaysHouseholdShared')}
          </span>
        }
      />
      <div className="storage-stats">
        <span>
          <PackageOpen size={18} />
          <strong>{data.foods.length}</strong>
          {t('itemsStored', { count: data.foods.length })}
        </span>
        <span>
          <ChefHat size={18} />
          <strong>{readyRecipes}</strong>
          {t('recipesReady', { count: readyRecipes })}
        </span>
        <span>
          <Info size={18} />
          <strong>{expiring}</strong>
          {t('expiringSoon', { count: expiring })}
        </span>
      </div>
      <div className="member-tabs storage-tabs">
        <button
          className={scope === 'inventory' ? 'selected' : ''}
          onClick={() => setScope('inventory')}
        >
          <PackageOpen size={16} />
          {t('inventory')}
        </button>
        <button
          className={scope === 'recipes' ? 'selected' : ''}
          onClick={() => setScope('recipes')}
        >
          <ChefHat size={16} />
          {t('recipes')}
        </button>
      </div>
      {scope === 'inventory' ? (
        <>
          <article className="panel food-add-card">
            <div className="panel-heading">
              <div>
                <h2>{t('addFood')}</h2>
                <span>{t('alwaysHouseholdShared')}</span>
              </div>
              <PackageOpen size={19} />
            </div>
            <form
              className="food-add-form"
              onSubmit={(event) => submitForm(event, post, 'food-add')}
            >
              <Field
                name="name"
                label={t('foodName')}
                placeholder={t('foodNamePlaceholder')}
              />
              <Field name="quantity" label={t('quantity')} type="number" />
              <label className="form-field">
                <span>{t('unit')}</span>
                <select name="unit" defaultValue="g">
                  {(['g', 'kg', 'ml', 'l', 'pcs'] as FoodUnit[]).map((unit) => (
                    <option value={unit} key={unit}>
                      {unit === 'pcs' ? t('pieces') : unit}
                    </option>
                  ))}
                </select>
              </label>
              <label className="form-field">
                <span>{t('category')}</span>
                <select name="category">
                  <option>{t('pantry')}</option>
                  <option>{t('fridge')}</option>
                  <option>{t('freezer')}</option>
                  <option>{t('produce')}</option>
                  <option>{t('drinks')}</option>
                  <option>{t('other')}</option>
                </select>
              </label>
              <label className="form-field">
                <span>{t('expiryOptional')}</span>
                <input name="expiresOn" type="date" />
              </label>
              <button className="primary-button">
                <Plus size={16} />
                {t('addFood')}
              </button>
            </form>
          </article>
          <div className="storage-toolbar">
            <label>
              <Search size={15} />
              <input
                value={search}
                onChange={(event) => setSearch(event.target.value)}
                placeholder={t('searchFood')}
              />
            </label>
            <span>{t('itemsStored', { count: visibleFoods.length })}</span>
          </div>
          <article className="panel food-table">
            {visibleFoods.length ? (
              <div className="food-list">
                {visibleFoods.map((food) => {
                  const step = foodStep(food.unit);
                  const expired = Boolean(
                    food.expiresOn && food.expiresOn < todayKey,
                  );
                  return (
                    <div key={food.id}>
                      <span className="food-category-icon">
                        <PackageOpen size={17} />
                      </span>
                      <div className="food-copy">
                        <strong>{food.name}</strong>
                        <span>
                          {food.category} ·{' '}
                          {food.expiresOn
                            ? expired
                              ? t('expired', { date: food.expiresOn })
                              : t('expires', { date: food.expiresOn })
                            : t('noExpiry')}
                        </span>
                        <small>
                          {t('updatedBy', { name: food.updatedByName })}
                        </small>
                      </div>
                      <div className="quantity-control">
                        <button
                          onClick={() =>
                            post({
                              type: 'food-adjust',
                              id: food.id,
                              delta: -step,
                            })
                          }
                          aria-label="-"
                        >
                          <Minus size={14} />
                        </button>
                        <b>
                          {formatFoodQuantity(
                            Number(food.quantity),
                            food.unit,
                            t,
                          )}
                        </b>
                        <button
                          onClick={() =>
                            post({
                              type: 'food-adjust',
                              id: food.id,
                              delta: step,
                            })
                          }
                          aria-label="+"
                        >
                          <Plus size={14} />
                        </button>
                      </div>
                      <button
                        className="row-remove"
                        onClick={() => {
                          if (window.confirm(`${t('remove')}?`))
                            void post({ type: 'food-remove', id: food.id });
                        }}
                        aria-label={t('remove')}
                      >
                        <Trash2 size={15} />
                      </button>
                    </div>
                  );
                })}
              </div>
            ) : (
              <Empty>{t('emptyStorage')}</Empty>
            )}
          </article>
        </>
      ) : (
        <>
          <RecipeBuilder foods={data.foods} post={post} t={t} />
          <div className="recipe-grid">
            {data.recipes.length ? (
              data.recipes.map((recipe) => {
                const status = recipeAvailability(recipe, data.foods);
                const ready = status.every((item) => item.ready);
                return (
                  <article
                    className={`panel recipe-card ${ready ? 'ready' : 'missing'}`}
                    key={recipe.id}
                  >
                    <header>
                      <span className="recipe-icon">
                        <ChefHat size={19} />
                      </span>
                      <div>
                        <h2>{recipe.name}</h2>
                        <span>
                          {t('servings')}: {recipe.servings} ·{' '}
                          {t('recipeBy', { name: recipe.createdByName })}
                        </span>
                      </div>
                      <button
                        onClick={() => {
                          if (window.confirm(`${t('remove')}?`))
                            void post({ type: 'recipe-remove', id: recipe.id });
                        }}
                        aria-label={t('remove')}
                      >
                        <Trash2 size={14} />
                      </button>
                    </header>
                    <div
                      className={`recipe-status ${ready ? 'ready' : 'missing'}`}
                    >
                      {ready ? (
                        <CheckCircle2 size={15} />
                      ) : (
                        <ShoppingBasket size={15} />
                      )}{' '}
                      {ready ? t('readyToCook') : t('missingItems')}
                    </div>
                    <div className="recipe-ingredients">
                      {status.map((item) => (
                        <div
                          className={item.ready ? 'available' : 'missing'}
                          key={item.ingredient.id}
                        >
                          <span>{item.ingredient.name}</span>
                          <small>
                            {t('needed')}:{' '}
                            {formatFoodQuantity(
                              item.ingredient.quantity,
                              item.ingredient.unit,
                              t,
                            )}{' '}
                            · {t('available')}:{' '}
                            {formatFoodQuantity(
                              item.available,
                              item.ingredient.unit,
                              t,
                            )}
                          </small>
                          {!item.ready && (
                            <b>
                              {t('missing')}:{' '}
                              {formatFoodQuantity(
                                item.missing,
                                item.ingredient.unit,
                                t,
                              )}
                            </b>
                          )}
                        </div>
                      ))}
                    </div>
                    {recipe.instructions && <p>{recipe.instructions}</p>}
                  </article>
                );
              })
            ) : (
              <article className="panel">
                <Empty>{t('emptyRecipes')}</Empty>
              </article>
            )}
          </div>
        </>
      )}
    </>
  );
}

function dateKey(date: Date) {
  const month = String(date.getMonth() + 1).padStart(2, '0');
  const day = String(date.getDate()).padStart(2, '0');
  return `${date.getFullYear()}-${month}-${day}`;
}
function recentDates(count: number) {
  const dates: Date[] = [];
  const current = new Date();
  current.setHours(12, 0, 0, 0);
  for (let offset = count - 1; offset >= 0; offset -= 1) {
    const date = new Date(current);
    date.setDate(current.getDate() - offset);
    dates.push(date);
  }
  return dates;
}

function WaterView({
  data,
  user,
  post,
  t,
}: {
  data: Data;
  user: AuthUser;
  post: Post;
  t: T;
  language: Language;
}) {
  const total = data.water.reduce(
    (sum, item) => sum + Number(item.amountMl),
    0,
  );
  const remaining = Math.max(0, user.waterGoal - total);
  const percent = Math.min(100, (total / user.waterGoal) * 100);
  return (
    <>
      <PageTitle
        eyebrow={t('waterEyebrow')}
        title={t('water')}
        copy={t('waterCopy')}
      />
      <div className="water-grid">
        <article className="panel water-hero">
          <span className="tinted-icon blue">
            <Droplets size={22} />
          </span>
          <div className="water-number">
            <strong>{total}</strong>
            <span>ml</span>
          </div>
          <p>{t('mlRemaining', { count: remaining })}</p>
          <div className="water-progress">
            <i style={{ width: `${percent}%` }} />
          </div>
          <div className="water-goal-label">
            <span>{t('todayWater')}</span>
            <b>{user.waterGoal} ml</b>
          </div>
          <div className="quick-water">
            <span>{t('quickAdd')}</span>
            <div>
              {[250, 500, 750].map((amount) => (
                <button
                  type="button"
                  key={amount}
                  onClick={() => post({ type: 'water', amountMl: amount })}
                >
                  +{amount} ml
                </button>
              ))}
            </div>
          </div>
        </article>
        <article className="panel entry-panel">
          <h2>{t('addWater')}</h2>
          <p>
            <Lock size={12} />
            {t('privateWater')}
          </p>
          <form
            className="form-grid water-form"
            onSubmit={(event) => submitForm(event, post, 'water')}
          >
            <Field name="amountMl" label={t('customAmount')} type="number" />
            <button className="primary-button">
              <Plus size={16} />
              {t('addWater')}
            </button>
          </form>
          <form
            key={user.waterGoal}
            className="goal-form"
            onSubmit={(event) => submitForm(event, post, 'water-goal')}
          >
            <Field
              name="waterGoal"
              label={t('waterGoal')}
              type="number"
              defaultValue={String(user.waterGoal)}
            />
            <button className="secondary-button">{t('setGoal')}</button>
          </form>
        </article>
      </div>
      <article className="panel table-panel">
        <div className="panel-heading">
          <div>
            <h2>{t('waterEntries')}</h2>
            <span>{t('privateWater')}</span>
          </div>
          <Lock size={17} />
        </div>
        <div className="water-entry-list">
          {data.water.length ? (
            data.water.map((item) => (
              <div key={item.id}>
                <span className="tinted-icon blue">
                  <Droplets size={15} />
                </span>
                <strong>{item.amountMl} ml</strong>
                <small>
                  {new Date(item.createdAt).toLocaleTimeString([], {
                    hour: '2-digit',
                    minute: '2-digit',
                  })}
                </small>
              </div>
            ))
          ) : (
            <Empty>{t('noWater')}</Empty>
          )}
        </div>
      </article>
    </>
  );
}

function HabitHeatmap({
  habit,
  items,
  t,
}: {
  habit: HabitKind;
  items: HabitEntry[];
  t: T;
}) {
  const dates = useMemo(() => recentDates(84), []);
  const totals = items
    .filter((item) => item.habit === habit)
    .reduce<Record<string, number>>((all, item) => {
      all[item.occurredOn] =
        (all[item.occurredOn] || 0) + Number(item.occurrences);
      return all;
    }, {});
  const daysClear = dates.filter((date) => !totals[dateKey(date)]).length;
  const occurrences = Object.values(totals).reduce(
    (sum, value) => sum + value,
    0,
  );
  const Icon = habit === 'vaping' ? Cigarette : Wine;
  return (
    <article className="panel habit-heatmap-card">
      <div className="habit-card-heading">
        <span className={`habit-icon ${habit}`}>
          <Icon size={19} />
        </span>
        <div>
          <h2>{t(habit)}</h2>
          <span>{t('last12Weeks')}</span>
        </div>
      </div>
      <div className="heatmap-scroll">
        <div className="habit-heatmap">
          {dates.map((date) => {
            const key = dateKey(date);
            const value = totals[key] || 0;
            const level =
              value === 0 ? 0 : value === 1 ? 1 : value <= 3 ? 2 : 3;
            return (
              <span
                key={key}
                className={`heat-cell level-${level}`}
                title={`${key}: ${value}`}
                aria-label={`${key}: ${value}`}
              />
            );
          })}
        </div>
      </div>
      <div className="heatmap-legend">
        <span>{t('noUseLogged')}</span>
        <i className="level-0" />
        <i className="level-1" />
        <i className="level-2" />
        <i className="level-3" />
        <span>{t('highUse')}</span>
      </div>
      <div className="habit-stats">
        <span>
          <strong>{daysClear}</strong>
          {t('daysClear', { count: daysClear })}
        </span>
        <span>
          <strong>{occurrences}</strong>
          {t('totalOccurrences', { count: occurrences })}
        </span>
      </div>
    </article>
  );
}

function HabitsView({
  data,
  post,
  t,
  language,
}: {
  data: Data;
  post: Post;
  t: T;
  language: Language;
}) {
  const spending = data.habits.reduce(
    (sum, item) => sum + Number(item.cost),
    0,
  );
  const vapingSpend = data.habits
    .filter((item) => item.habit === 'vaping')
    .reduce((sum, item) => sum + Number(item.cost), 0);
  const alcoholSpend = spending - vapingSpend;
  return (
    <>
      <PageTitle
        eyebrow={t('habitEyebrow')}
        title={t('habits')}
        copy={t('habitCopy')}
        action={
          <span className="public-banner">
            <Users size={15} />
            {t('alwaysPublic')}
          </span>
        }
      />
      <div className="habit-layout">
        <div className="habit-heatmaps">
          <HabitHeatmap habit="vaping" items={data.habits} t={t} />
          <HabitHeatmap habit="alcohol" items={data.habits} t={t} />
        </div>
        <article className="panel entry-panel habit-entry">
          <h2>{t('logHabit')}</h2>
          <p>
            <Users size={12} />
            {t('alwaysPublic')}
          </p>
          <form
            className="form-grid"
            onSubmit={(event) => submitForm(event, post, 'habit')}
          >
            <label className="form-field">
              <span>{t('habitType')}</span>
              <select name="habit" defaultValue="vaping">
                <option value="vaping">{t('vaping')}</option>
                <option value="alcohol">{t('alcohol')}</option>
              </select>
            </label>
            <Field
              name="occurrences"
              label={t('occurrences')}
              type="number"
              defaultValue="1"
            />
            <Field
              name="cost"
              label={t('costRub')}
              type="number"
              defaultValue="0"
            />
            <Field
              name="occurredOn"
              label={t('date')}
              type="date"
              defaultValue={dateKey(new Date())}
            />
            <button className="primary-button">
              <Plus size={16} />
              {t('addRecord')}
            </button>
          </form>
        </article>
      </div>
      <div className="habit-bottom">
        <article className="panel habit-spending">
          <div className="panel-heading">
            <div>
              <h2>{t('publicHabitSpending')}</h2>
              <span>{t('alwaysPublic')}</span>
            </div>
            <CircleDollarSign size={19} />
          </div>
          <strong>{money(spending, language)}</strong>
          <div>
            <span>
              <Cigarette size={15} />
              {t('vaping')}
              <b>{money(vapingSpend, language)}</b>
            </span>
            <span>
              <Wine size={15} />
              {t('alcohol')}
              <b>{money(alcoholSpend, language)}</b>
            </span>
          </div>
        </article>
        <article className="panel habit-activity">
          <div className="panel-heading">
            <div>
              <h2>{t('recentHabitActivity')}</h2>
              <span>{t('alwaysPublic')}</span>
            </div>
          </div>
          {data.habits.length ? (
            <div className="habit-activity-list">
              {data.habits.slice(0, 8).map((item) => (
                <div key={item.id}>
                  <Avatar person={item} />
                  <div>
                    <strong>
                      {item.name} · {t(item.habit)}
                    </strong>
                    <span>{item.occurredOn}</span>
                  </div>
                  <b>
                    {t('habitRecord', {
                      count: item.occurrences,
                      cost: money(Number(item.cost), language),
                    })}
                  </b>
                </div>
              ))}
            </div>
          ) : (
            <Empty>{t('noHabitActivity')}</Empty>
          )}
        </article>
      </div>
    </>
  );
}

function TasksView({
  data,
  post,
  t,
}: {
  data: Data;
  post: Post;
  t: T;
  language: Language;
}) {
  const columns = [
    ['todo', t('toDo')],
    ['progress', t('inProgress')],
    ['done', t('done')],
  ];
  return (
    <>
      <PageTitle
        eyebrow={t('taskEyebrow')}
        title={t('taskBoard')}
        copy={t('taskCopy')}
      />
      <form
        className="quick-form privacy-form panel"
        onSubmit={(event) => submitForm(event, post, 'task')}
      >
        <Field
          name="title"
          label={t('newTask')}
          placeholder={t('whatNeedsDoing')}
        />
        <Field name="tag" label={t('group')} defaultValue="Home" />
        <Field name="due" label={t('due')} defaultValue={t('thisWeek')} />
        <PrivacySelect t={t} />
        <button className="primary-button">
          <Plus size={16} />
          {t('addTask')}
        </button>
      </form>
      <div className="kanban">
        {columns.map(([status, label]) => (
          <section className="kanban-column" key={status}>
            <header>
              <div>
                <i className={status} />
                <strong>{label}</strong>
              </div>
              <span>
                {data.tasks.filter((task) => task.status === status).length}
              </span>
            </header>
            {data.tasks
              .filter((task) => task.status === status)
              .map((task) => {
                const next =
                  status === 'todo'
                    ? 'progress'
                    : status === 'progress'
                      ? 'done'
                      : 'todo';
                return (
                  <article className="task-card" key={task.id}>
                    <div className="card-meta">
                      <span className="task-tag">{task.tag}</span>
                      <PrivacyBadge visibility={task.visibility} t={t} />
                    </div>
                    <h3>{task.title}</h3>
                    <footer>
                      <span>
                        {task.due}
                        {!task.owned ? ` · ${t('sharedHousemate')}` : ''}
                      </span>
                      {Boolean(task.owned) && (
                        <button
                          onClick={() =>
                            post({
                              type: 'task-status',
                              id: task.id,
                              status: next,
                            })
                          }
                          aria-label={task.title}
                        >
                          <ArrowRight size={15} />
                        </button>
                      )}
                    </footer>
                  </article>
                );
              })}
          </section>
        ))}
      </div>
    </>
  );
}

function SpendingView({
  data,
  total,
  post,
  t,
  language,
}: {
  data: Data;
  total: number;
  post: Post;
  t: T;
  language: Language;
}) {
  const categories = useMemo(
    () =>
      Object.entries(
        data.expenses.reduce<Record<string, number>>((all, item) => {
          all[item.category] = (all[item.category] || 0) + Number(item.amount);
          return all;
        }, {}),
      ).sort((a, b) => b[1] - a[1]),
    [data.expenses],
  );
  return (
    <>
      <PageTitle
        eyebrow={t('spendingEyebrow')}
        title={t('spending')}
        copy={t('spendingCopy')}
      />
      <div className="feature-grid">
        <article className="panel spend-hero">
          <span>{t('totalVisible')}</span>
          <strong>{money(total, language)}</strong>
          <div className="category-bars">
            {categories.length ? (
              categories.map(([name, value]) => (
                <div key={name}>
                  <span>
                    {name}
                    <b>{money(value, language)}</b>
                  </span>
                  <i>
                    <em
                      style={{ width: `${total ? (value / total) * 100 : 0}%` }}
                    />
                  </i>
                </div>
              ))
            ) : (
              <Empty>{t('noExpenses')}</Empty>
            )}
          </div>
        </article>
        <article className="panel entry-panel">
          <h2>{t('addExpense')}</h2>
          <p>{t('expenseHint')}</p>
          <form
            className="form-grid"
            onSubmit={(event) => submitForm(event, post, 'expense')}
          >
            <Field
              name="label"
              label={t('whatWasIt')}
              placeholder={t('cleaningSupplies')}
            />
            <Field name="amount" label={t('amountRub')} type="number" />
            <label className="form-field">
              <span>{t('category')}</span>
              <select name="category">
                <option>{t('groceries')}</option>
                <option>{t('housing')}</option>
                <option>{t('utilities')}</option>
                <option>{t('furniture')}</option>
                <option>{t('transport')}</option>
                <option>{t('other')}</option>
              </select>
            </label>
            <PrivacySelect t={t} />
            <button className="primary-button">
              <Plus size={16} />
              {t('addExpense')}
            </button>
          </form>
        </article>
      </div>
      <article className="panel table-panel">
        <div className="panel-heading">
          <div>
            <h2>{t('recentExpenses')}</h2>
            <span>{t('visibleEntries', { count: data.expenses.length })}</span>
          </div>
        </div>
        <div className="expense-list">
          {data.expenses.length ? (
            data.expenses.map((item) => (
              <div key={item.id}>
                <span className="expense-icon">
                  <WalletCards size={16} />
                </span>
                <div>
                  <strong>{item.label}</strong>
                  <small>
                    {item.category}
                    {!item.owned ? ` · ${t('sharedHousemate')}` : ''}
                  </small>
                </div>
                <PrivacyBadge visibility={item.visibility} t={t} />
                <b>{money(Number(item.amount), language)}</b>
              </div>
            ))
          ) : (
            <Empty>{t('noExpenses')}</Empty>
          )}
        </div>
      </article>
    </>
  );
}

function OrganisersView({
  data,
  post,
  t,
}: {
  data: Data;
  post: Post;
  t: T;
  language: Language;
}) {
  const lists = Array.from(new Set(data.organisers.map((item) => item.list)));
  return (
    <>
      <PageTitle
        eyebrow={t('organiserEyebrow')}
        title={t('organisers')}
        copy={t('organiserCopy')}
      />
      <form
        className="quick-form privacy-form panel"
        onSubmit={(event) => submitForm(event, post, 'organiser')}
      >
        <Field name="list" label={t('listName')} placeholder={t('groceries')} />
        <Field name="label" label={t('firstItem')} placeholder={t('oatMilk')} />
        <PrivacySelect t={t} />
        <button className="primary-button">
          <Plus size={16} />
          {t('addItem')}
        </button>
      </form>
      {lists.length ? (
        <div className="organiser-grid">
          {lists.map((list) => (
            <article className="panel organiser-card" key={list}>
              <div className="panel-heading">
                <div>
                  <h2>{list}</h2>
                  <span>
                    {t('remaining', {
                      count: data.organisers.filter(
                        (item) => item.list === list && !item.done,
                      ).length,
                    })}
                  </span>
                </div>
                <span className="tinted-icon peach">
                  <ClipboardCheck size={18} />
                </span>
              </div>
              <div className="check-list">
                {data.organisers
                  .filter((item) => item.list === list)
                  .map((item) => (
                    <div
                      className={`check-item ${item.done ? 'complete' : ''}`}
                      key={item.id}
                    >
                      {item.owned ? (
                        <button
                          onClick={() =>
                            post({
                              type: 'organiser-toggle',
                              id: item.id,
                              done: !item.done,
                            })
                          }
                        >
                          <i>{item.done && <Check size={12} />}</i>
                          <span>{item.label}</span>
                        </button>
                      ) : (
                        <span className="readonly-item">
                          <i>{item.done && <Check size={12} />}</i>
                          {item.label}
                        </span>
                      )}
                      <PrivacyBadge visibility={item.visibility} t={t} />
                    </div>
                  ))}
              </div>
              <form
                className="inline-add organiser-add"
                onSubmit={(event) =>
                  submitForm(event, post, 'organiser', { list })
                }
              >
                <input name="label" placeholder={t('addAnItem')} required />
                <select name="visibility" defaultValue="private">
                  <option value="private">{t('private')}</option>
                  <option value="shared">{t('shared')}</option>
                </select>
                <button aria-label={t('addItem')}>
                  <Plus size={16} />
                </button>
              </form>
            </article>
          ))}
        </div>
      ) : (
        <article className="panel">
          <Empty>{t('noLists')}</Empty>
        </article>
      )}
    </>
  );
}

function ChatView({
  data,
  user,
  post,
  t,
  language,
}: {
  data: Data;
  user: AuthUser;
  post: Post;
  t: T;
  language: Language;
}) {
  return (
    <>
      <PageTitle
        eyebrow={t('chatEyebrow')}
        title={t('houseChat')}
        copy={t('chatCopy')}
      />
      <article className="chat-room panel">
        <header>
          {data.home.photo ? (
            <img className="chat-home-photo" src={data.home.photo} alt="" />
          ) : (
            <span className="tinted-icon green">
              <MessageCircle size={18} />
            </span>
          )}
          <div>
            <strong>{data.home.name}</strong>
            <span>{t('sharedChat', { count: data.messages.length })}</span>
          </div>
        </header>
        <div className="messages">
          {data.messages.length ? (
            data.messages.map((message) => (
              <div
                className={message.mine ? 'message mine' : 'message'}
                key={message.id}
              >
                <Avatar person={message} />
                <div>
                  <span>
                    {message.name} ·{' '}
                    {new Date(message.createdAt).toLocaleTimeString(
                      language === 'ru' ? 'ru-RU' : 'en-US',
                      { hour: '2-digit', minute: '2-digit' },
                    )}
                  </span>
                  <p>{message.body}</p>
                </div>
              </div>
            ))
          ) : (
            <Empty>{t('sayHello')}</Empty>
          )}
        </div>
        <form
          className="chat-compose"
          onSubmit={async (event) => {
            event.preventDefault();
            const form = event.currentTarget;
            const messageValue = new FormData(form).get('body');
            const body =
              typeof messageValue === 'string' ? messageValue.trim() : '';
            if (body && (await post({ type: 'message', body }))) form.reset();
          }}
        >
          <Avatar person={user} />
          <input
            name="body"
            placeholder={t('messageAs', { name: user.name })}
            autoComplete="off"
            maxLength={2000}
          />
          <button aria-label={t('chat')}>
            <Send size={18} />
          </button>
        </form>
      </article>
    </>
  );
}

function HomeView({
  data,
  user,
  post,
  t,
}: {
  data: Data;
  user: AuthUser;
  post: Post;
  t: T;
  language: Language;
}) {
  const [homePhoto, setHomePhoto] = useState<string | null>(data.home.photo);
  const [photoChanged, setPhotoChanged] = useState(false);
  const [preparing, setPreparing] = useState(false);
  async function pickHome(file?: File) {
    if (!file) return;
    setPreparing(true);
    try {
      setHomePhoto(await resizeImage(file, 1400, 900, 0.8));
      setPhotoChanged(true);
    } finally {
      setPreparing(false);
    }
  }
  async function pickAvatar(file?: File) {
    if (!file) return;
    setPreparing(true);
    try {
      await post({
        type: 'avatar',
        avatar: await resizeImage(file, 512, 512, 0.84),
      });
    } finally {
      setPreparing(false);
    }
  }
  return (
    <>
      <PageTitle
        eyebrow={t('homeEyebrow')}
        title={t('homeTitle')}
        copy={t('homeCopy')}
      />
      <div className="settings-grid">
        <article className="panel home-settings-card">
          <div
            className="home-photo-editor"
            style={
              homePhoto
                ? {
                    backgroundImage: `linear-gradient(#0003,#0003),url(${homePhoto})`,
                  }
                : undefined
            }
          >
            {!homePhoto && <ImageIcon size={30} />}
            <label className="photo-button">
              <Camera size={15} />
              {homePhoto ? t('replacePhoto') : t('choosePhoto')}
              <input
                type="file"
                accept="image/png,image/jpeg,image/webp"
                onChange={(event) => void pickHome(event.target.files?.[0])}
              />
            </label>
          </div>
          <form
            className="settings-form"
            onSubmit={async (event) => {
              event.preventDefault();
              const form = event.currentTarget;
              const values = new FormData(form);
              const nameValue = values.get('name');
              const addressValue = values.get('address');
              const payload: Record<string, string | boolean> = {
                type: 'home',
                name: typeof nameValue === 'string' ? nameValue : '',
                address: typeof addressValue === 'string' ? addressValue : '',
              };
              if (photoChanged) payload.photo = homePhoto || '';
              if (await post(payload)) setPhotoChanged(false);
            }}
          >
            <Field
              name="name"
              label={t('homeName')}
              placeholder={t('homeNamePlaceholder')}
              defaultValue={data.home.name}
            />
            <Field
              name="address"
              label={t('address')}
              placeholder={t('addressPlaceholder')}
              defaultValue={data.home.address}
            />
            {homePhoto && (
              <button
                type="button"
                className="danger-text-button"
                onClick={() => {
                  setHomePhoto(null);
                  setPhotoChanged(true);
                }}
              >
                {t('removePhoto')}
              </button>
            )}
            <button className="primary-button">
              <Home size={16} />
              {t('saveHome')}
            </button>
          </form>
        </article>
        <div className="settings-stack">
          <article className="panel profile-settings">
            <div className="profile-avatar-large">
              <Avatar person={user} />
              <label className="avatar-upload">
                <Camera size={15} />
                <span>
                  {user.avatar ? t('replaceAvatar') : t('chooseAvatar')}
                </span>
                <input
                  type="file"
                  accept="image/png,image/jpeg,image/webp"
                  onChange={(event) => void pickAvatar(event.target.files?.[0])}
                />
              </label>
            </div>
            <div>
              <h2>{t('profileTitle')}</h2>
              <p>{t('profileCopy')}</p>
              <strong>{user.name}</strong>
              <span>{user.email}</span>
              {user.avatar && (
                <button
                  className="danger-text-button"
                  onClick={() => post({ type: 'avatar', avatar: '' })}
                >
                  {t('removeAvatar')}
                </button>
              )}
            </div>
          </article>
          <article className="panel members-panel">
            <div className="panel-heading">
              <div>
                <h2>{t('housemates')}</h2>
                <span>{t('membersCount', { count: data.members.length })}</span>
              </div>
              <Users size={18} />
            </div>
            <div className="member-list">
              {data.members.map((member) => (
                <div key={member.id}>
                  <Avatar person={member} />
                  <strong>{member.name}</strong>
                </div>
              ))}
            </div>
          </article>
          <p className="image-hint">
            {preparing ? (
              <>
                <LoaderCircle className="spin" size={14} />
                {t('uploading')}
              </>
            ) : (
              <>
                <ImageIcon size={14} />
                {t('imageHint')}
              </>
            )}
          </p>
        </div>
      </div>
    </>
  );
}

async function submitForm(
  event: SubmitEvent<HTMLFormElement>,
  post: Post,
  type: string,
  extra: Record<string, string> = {},
) {
  event.preventDefault();
  const form = event.currentTarget;
  const values = Object.fromEntries(new FormData(form).entries());
  const payload: Record<string, string | number | boolean> = { type, ...extra };
  for (const [key, value] of Object.entries(values)) {
    if (typeof value !== 'string') continue;
    payload[key] = [
      'calories',
      'protein',
      'carbs',
      'fat',
      'amount',
      'amountMl',
      'waterGoal',
      'occurrences',
      'cost',
      'heightCm',
      'weightKg',
      'age',
    ].includes(key)
      ? Number(value)
      : value;
  }
  if (await post(payload)) form.reset();
}
function money(value: number, language: Language) {
  return new Intl.NumberFormat(language === 'ru' ? 'ru-RU' : 'en-US', {
    style: 'currency',
    currency: 'RUB',
    maximumFractionDigits: 2,
  }).format(value);
}
function resizeImage(
  file: File,
  maxWidth: number,
  maxHeight: number,
  quality: number,
): Promise<string> {
  return new Promise((resolve, reject) => {
    if (!['image/jpeg', 'image/png', 'image/webp'].includes(file.type)) {
      reject(new Error('Unsupported image'));
      return;
    }
    const url = URL.createObjectURL(file);
    const image = new window.Image();
    image.onload = () => {
      const scale = Math.min(
        1,
        maxWidth / image.width,
        maxHeight / image.height,
      );
      const canvas = document.createElement('canvas');
      canvas.width = Math.max(1, Math.round(image.width * scale));
      canvas.height = Math.max(1, Math.round(image.height * scale));
      const context = canvas.getContext('2d');
      if (!context) {
        URL.revokeObjectURL(url);
        reject(new Error('Canvas unavailable'));
        return;
      }
      context.drawImage(image, 0, 0, canvas.width, canvas.height);
      URL.revokeObjectURL(url);
      resolve(canvas.toDataURL('image/webp', quality));
    };
    image.onerror = () => {
      URL.revokeObjectURL(url);
      reject(new Error('Image could not be read'));
    };
    image.src = url;
  });
}
