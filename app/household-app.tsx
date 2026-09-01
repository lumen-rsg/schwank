'use client';

import Image from 'next/image';
import {
  useCallback,
  useEffect,
  useMemo,
  useRef,
  useState,
  type ReactNode,
  type SubmitEvent,
} from 'react';
import {
  Activity,
  Archive,
  ArrowRight,
  Bell,
  BellRing,
  BookOpen,
  Calculator,
  CalendarClock,
  CalendarDays,
  Camera,
  Check,
  CheckCircle2,
  ChefHat,
  Cigarette,
  CircleDollarSign,
  CreditCard,
  ClipboardCheck,
  Clock3,
  Droplets,
  Flame,
  Gift,
  Home,
  Image as ImageIcon,
  Info,
  KeyRound,
  Languages,
  ListChecks,
  ListTodo,
  LoaderCircle,
  Lock,
  LogOut,
  MessageCircle,
  Minus,
  Monitor,
  PackageOpen,
  PackageCheck,
  Pause,
  Pill,
  Play,
  Plus,
  RotateCcw,
  Salad,
  Scale,
  Search,
  Send,
  Settings,
  ShieldCheck,
  ShoppingBasket,
  Sparkles,
  Trash2,
  ThumbsDown,
  ThumbsUp,
  Utensils,
  Users,
  WalletCards,
  Wine,
} from 'lucide-react';
import type { AuthUser } from '@/db/auth';
import { deriveDueNotifications } from '@/lib/notifications';
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
  dueOn: string | null;
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
type RecurringPayment = {
  id: number;
  kind: 'subscription' | 'loan' | 'rent';
  label: string;
  amount: number;
  billingCycle: 'monthly' | 'yearly';
  nextDueOn: string;
  remainingAmount: number | null;
  active: boolean | number;
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
type Reminder = {
  id: number;
  label: string;
  remindAt: string;
  done: boolean | number;
  visibility: Visibility;
  owned: boolean | number;
};
type Medication = {
  id: number;
  name: string;
  dosage: string;
  instructions: string;
  scheduleTimes: string[];
  startOn: string;
  endOn: string | null;
  active: boolean | number;
  visibility: Visibility;
  owned: boolean | number;
  ownerName: string;
};
type MedicationDose = {
  id: number;
  medicationId: number;
  scheduledFor: string;
  takenAt: string;
  takenByName: string;
};
type PurchaseIdea = {
  id: number;
  title: string;
  description: string;
  estimatedCost: number | null;
  status: 'open' | 'bought';
  createdAt: string;
  owned: boolean | number;
  createdByName: string;
  initials: string;
  color: string;
  avatar: string | null;
};
type PurchaseVote = {
  id: number;
  ideaId: number;
  vote: 1 | -1;
  updatedAt: string;
  mine: boolean | number;
  name: string;
  initials: string;
  color: string;
  avatar: string | null;
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
type RecipeCourse =
  | 'breakfast'
  | 'starter'
  | 'main'
  | 'dinner'
  | 'salad'
  | 'dessert';
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
  course: RecipeCourse;
  servings: number;
  instructions: string;
  createdAt: string;
  createdByName: string;
  ingredients: RecipeIngredient[];
};
type WeeklyMeal = {
  id: number;
  weekStart: string;
  dayIndex: number;
  course: RecipeCourse;
  recipeId: number;
  servings: number;
};
type AiMealPlanProposal = {
  summary: string;
  nutritionRationale: string;
  recipes: Array<{
    key: string;
    sourceRecipeId: number;
    name: string;
    course: RecipeCourse;
    description: string;
    caloriesPerServing: number;
    proteinPerServing: number;
    carbsPerServing: number;
    fatPerServing: number;
    ingredients: Array<{
      name: string;
      quantity: number;
      unit: FoodUnit;
    }>;
    instructions: string;
  }>;
  schedule: Array<{
    dayIndex: number;
    course: RecipeCourse;
    recipeKey: string;
  }>;
};
type AiPlanResult = {
  proposal: AiMealPlanProposal;
  model: string;
  nutritionContributors: number;
};
type AiProgressStage =
  | 'starting'
  | 'preparing'
  | 'context'
  | 'requesting'
  | 'receiving'
  | 'validating';
type AiStreamEvent =
  | {
      type: 'status';
      stage: AiProgressStage;
      provider?: string;
      model?: string;
    }
  | { type: 'delta'; delta: string }
  | { type: 'result'; result: AiPlanResult }
  | { type: 'error'; error: string; status?: number };
type Data = {
  currentUser: AuthUser;
  members: Member[];
  home: HomeProfile;
  nutrition: Nutrition[];
  tasks: Task[];
  expenses: Expense[];
  recurringPayments: RecurringPayment[];
  organisers: Organiser[];
  reminders: Reminder[];
  medications: Medication[];
  medicationDoses: MedicationDose[];
  purchaseIdeas: PurchaseIdea[];
  purchaseVotes: PurchaseVote[];
  messages: Message[];
  habits: HabitEntry[];
  water: WaterEntry[];
  foods: FoodItem[];
  recipes: Recipe[];
  weeklyPlan: WeeklyMeal[];
  aiConfigured: boolean;
  aiConsentingMembers: number;
};
type Post = (payload: Record<string, unknown>) => Promise<boolean>;
type T = (key: CopyKey, variables?: Record<string, string | number>) => string;

const navigation = [
  { id: 'overview', key: 'overview', icon: Home },
  { id: 'nutrition', key: 'nutrition', icon: Utensils },
  { id: 'food', key: 'foodStorage', icon: PackageOpen },
  { id: 'medications', key: 'medications', icon: Pill },
  { id: 'water', key: 'water', icon: Droplets },
  { id: 'habits', key: 'habits', icon: Cigarette },
  { id: 'tasks', key: 'tasks', icon: ListTodo },
  { id: 'wishlist', key: 'wishlist', icon: Gift },
  { id: 'spending', key: 'spending', icon: WalletCards },
  { id: 'organisers', key: 'organisers', icon: ClipboardCheck },
  { id: 'chat', key: 'chat', icon: MessageCircle },
  { id: 'home', key: 'homeSettings', icon: Settings },
] as const;
const expenseCategoryOptions: Array<{ value: string; key: CopyKey }> = [
  { value: 'groceries', key: 'groceries' },
  { value: 'housing', key: 'housing' },
  { value: 'rent', key: 'rent' },
  { value: 'utilities', key: 'utilities' },
  { value: 'subscriptions', key: 'subscriptions' },
  { value: 'loan', key: 'loanPayments' },
  { value: 'furniture', key: 'furniture' },
  { value: 'transport', key: 'transport' },
  { value: 'health', key: 'health' },
  { value: 'leisure', key: 'leisure' },
  { value: 'other', key: 'other' },
];
const expenseCategoryAliases: Record<string, string> = {
  Groceries: 'groceries',
  Housing: 'housing',
  Utilities: 'utilities',
  Furniture: 'furniture',
  Transport: 'transport',
  Other: 'other',
  Продукты: 'groceries',
  Жильё: 'housing',
  'Коммунальные услуги': 'utilities',
  Мебель: 'furniture',
  Транспорт: 'transport',
  Другое: 'other',
};
const spendingColors = [
  '#e86b43',
  '#708c67',
  '#557ea4',
  '#a6769d',
  '#d6a24b',
  '#4f9187',
  '#b96969',
  '#7f76b5',
  '#8a7865',
  '#6f8fa8',
  '#91926b',
];
const normalizedExpenseCategory = (category: string) =>
  expenseCategoryOptions.some((option) => option.value === category)
    ? category
    : expenseCategoryAliases[category] || 'other';
const expenseCategoryLabel = (category: string, t: T) => {
  const normalized = normalizedExpenseCategory(category);
  const option = expenseCategoryOptions.find(
    (candidate) => candidate.value === normalized,
  );
  return option ? t(option.key) : category;
};
const empty = (user: AuthUser): Data => ({
  currentUser: user,
  members: [user],
  home: { name: 'Our home', address: '', photo: null },
  nutrition: [],
  tasks: [],
  expenses: [],
  recurringPayments: [],
  organisers: [],
  reminders: [],
  medications: [],
  medicationDoses: [],
  purchaseIdeas: [],
  purchaseVotes: [],
  messages: [],
  habits: [],
  water: [],
  foods: [],
  recipes: [],
  weeklyPlan: [],
  aiConfigured: false,
  aiConsentingMembers: 0,
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
      {person.avatar ? (
        <Image
          src={person.avatar}
          alt=""
          width={small ? 27 : 34}
          height={small ? 27 : 34}
          unoptimized
        />
      ) : (
        person.initials
      )}
    </span>
  );
}
function Field({
  name,
  label,
  type = 'text',
  placeholder,
  defaultValue,
  minLength,
  maxLength,
  autoComplete,
}: {
  name: string;
  label: string;
  type?: string;
  placeholder?: string;
  defaultValue?: string;
  minLength?: number;
  maxLength?: number;
  autoComplete?: string;
}) {
  return (
    <label className="form-field">
      <span>{label}</span>
      <input
        name={name}
        type={type}
        placeholder={placeholder}
        defaultValue={defaultValue}
        minLength={minLength}
        maxLength={maxLength}
        autoComplete={autoComplete}
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
  const [notificationsOpen, setNotificationsOpen] = useState(false);
  const [notificationPermission, setNotificationPermission] = useState<
    NotificationPermission | 'desktop' | 'in-app'
  >('in-app');
  const lastMessageId = useRef<number | null>(null);
  const loadInProgress = useRef(false);
  const deliveredNotificationKeys = useRef(new Set<string>());
  const load = useCallback(
    async (silent = false) => {
      if (loadInProgress.current) return;
      loadInProgress.current = true;
      try {
        const response = await fetch('/api/schwank', { cache: 'no-store' });
        if (response.status === 401) {
          window.location.assign('/login');
          return;
        }
        if (!response.ok) throw new Error();
        const nextData = (await response.json()) as Data;
        const newestMessageId = nextData.messages.reduce(
          (maximum, message) => Math.max(maximum, message.id),
          0,
        );
        if (lastMessageId.current !== null) {
          const newMessage = nextData.messages
            .filter(
              (message) =>
                message.id > (lastMessageId.current ?? 0) && !message.mine,
            )
            .at(-1);
          if (newMessage)
            void window.schwankDesktop?.notify(
              'schwank',
              `${newMessage.name}: ${newMessage.body}`,
            );
        }
        lastMessageId.current = newestMessageId;
        setData(nextData);
      } catch {
        if (!silent) setNotice(t('storageFailed'));
      } finally {
        setLoading(false);
        loadInProgress.current = false;
      }
    },
    [t],
  );
  useEffect(() => {
    const storageKey = `schwank-notifications:${initialUser.id}`;
    try {
      deliveredNotificationKeys.current = new Set(
        JSON.parse(window.localStorage.getItem(storageKey) || '[]') as string[],
      );
    } catch {
      deliveredNotificationKeys.current = new Set();
    }
    queueMicrotask(() => {
      if (window.schwankDesktop) setNotificationPermission('desktop');
      else if ('Notification' in window && window.isSecureContext)
        setNotificationPermission(Notification.permission);
    });
    queueMicrotask(() => void load());
    const interval = window.setInterval(() => void load(true), 30_000);
    const refreshVisible = () => {
      if (document.visibilityState === 'visible') void load(true);
    };
    document.addEventListener('visibilitychange', refreshVisible);
    return () => {
      window.clearInterval(interval);
      document.removeEventListener('visibilitychange', refreshVisible);
    };
  }, [initialUser.id, load]);
  const notifications = useMemo(
    () => deriveDueNotifications(data, t, language),
    [data, language, t],
  );
  useEffect(() => {
    const unseen = notifications.filter(
      (notification) =>
        !deliveredNotificationKeys.current.has(notification.key),
    );
    if (!unseen.length) return;
    for (const notification of unseen) {
      deliveredNotificationKeys.current.add(notification.key);
      const nativeTitle =
        notification.visibility === 'private' ? 'schwank' : notification.title;
      const nativeBody =
        notification.visibility === 'private'
          ? t('privateNotificationBody')
          : notification.body;
      if (window.schwankDesktop)
        void window.schwankDesktop.notify(nativeTitle, nativeBody);
      else if (
        'Notification' in window &&
        window.isSecureContext &&
        Notification.permission === 'granted'
      )
        new Notification(nativeTitle, { body: nativeBody });
    }
    window.localStorage.setItem(
      `schwank-notifications:${initialUser.id}`,
      JSON.stringify(Array.from(deliveredNotificationKeys.current).slice(-250)),
    );
  }, [initialUser.id, notifications, t]);
  async function enableNotifications() {
    if (window.schwankDesktop) {
      setNotificationPermission('desktop');
      return;
    }
    if (!('Notification' in window) || !window.isSecureContext) {
      setNotificationPermission('in-app');
      return;
    }
    setNotificationPermission(await Notification.requestPermission());
  }
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
    ) : active === 'medications' ? (
      <MedicationsView {...common} />
    ) : active === 'water' ? (
      <WaterView {...common} user={user} />
    ) : active === 'habits' ? (
      <HabitsView {...common} />
    ) : active === 'tasks' ? (
      <TasksView {...common} />
    ) : active === 'wishlist' ? (
      <WishlistView {...common} />
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
                : item.id === 'medications'
                  ? notifications.filter(
                      (notification) => notification.section === 'medications',
                    ).length
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
            <div className="notification-menu">
              <button
                className="icon-button notification-button"
                aria-label={t('notifications')}
                aria-expanded={notificationsOpen}
                onClick={() => setNotificationsOpen((open) => !open)}
              >
                {notifications.length ? (
                  <BellRing size={19} />
                ) : (
                  <Bell size={19} />
                )}
                {notifications.length > 0 && (
                  <em>{Math.min(99, notifications.length)}</em>
                )}
              </button>
              {notificationsOpen && (
                <section className="notification-popover">
                  <header>
                    <div>
                      <strong>{t('notifications')}</strong>
                      <span>
                        {t('dueNowCount', { count: notifications.length })}
                      </span>
                    </div>
                    {notificationPermission === 'default' && (
                      <button type="button" onClick={enableNotifications}>
                        {t('enableNotifications')}
                      </button>
                    )}
                  </header>
                  {notifications.length ? (
                    notifications.map((notification) => (
                      <button
                        type="button"
                        className="notification-item"
                        key={notification.key}
                        onClick={() => {
                          setActive(notification.section);
                          setNotificationsOpen(false);
                        }}
                      >
                        <span>
                          <Clock3 size={15} />
                        </span>
                        <div>
                          <strong>{notification.title}</strong>
                          <small>{notification.body}</small>
                        </div>
                        <ArrowRight size={14} />
                      </button>
                    ))
                  ) : (
                    <Empty>{t('noNotifications')}</Empty>
                  )}
                  {notificationPermission === 'in-app' && (
                    <p>{t('inAppNotificationsOnly')}</p>
                  )}
                </section>
              )}
            </div>
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
                    <span>
                      {task.dueOn
                        ? formatMoneyDate(task.dueOn, language)
                        : task.due}
                    </span>
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
const recipeCourses: RecipeCourse[] = [
  'breakfast',
  'starter',
  'main',
  'dinner',
  'salad',
  'dessert',
];
const recipeCourseCopy: Record<RecipeCourse, CopyKey> = {
  breakfast: 'breakfasts',
  starter: 'starters',
  main: 'mainCourses',
  dinner: 'dinners',
  salad: 'salads',
  dessert: 'desserts',
};
const weekdayCopy: CopyKey[] = [
  'monday',
  'tuesday',
  'wednesday',
  'thursday',
  'friday',
  'saturday',
  'sunday',
];
const defaultMealFrequencies: Record<RecipeCourse, number> = {
  breakfast: 7,
  starter: 3,
  main: 3,
  dinner: 7,
  salad: 7,
  dessert: 2,
};
const aiProgressCopy: Record<AiProgressStage, CopyKey> = {
  starting: 'aiOutputConnected',
  preparing: 'aiOutputPreparing',
  context: 'aiOutputContext',
  requesting: 'aiOutputRequesting',
  receiving: 'aiOutputReceiving',
  validating: 'aiOutputValidating',
};
function aiProgressTime(startedAt: number) {
  const seconds = Math.max(0, Math.floor((Date.now() - startedAt) / 1000));
  return `${String(Math.floor(seconds / 60)).padStart(2, '0')}:${String(seconds % 60).padStart(2, '0')}`;
}
const normalizedFoodName = (value: string) =>
  value.normalize('NFKC').trim().toLocaleLowerCase('en').replace(/\s+/g, ' ');
const foodStep = (unit: FoodUnit) =>
  unit === 'pcs' ? 1 : unit === 'kg' || unit === 'l' ? 0.1 : 100;
function formatFoodQuantity(value: number, unit: FoodUnit, t: T) {
  return `${new Intl.NumberFormat(undefined, { maximumFractionDigits: 2 }).format(value)} ${unit === 'pcs' ? t('pieces') : unit}`;
}
function recipeAvailability(
  recipe: Recipe,
  foods: FoodItem[],
  targetServings = 3,
) {
  const todayKey = dateKey(new Date());
  const servingFactor = targetServings / Math.max(1, recipe.servings);
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
    const needed = Number(ingredient.quantity) * servingFactor;
    const neededBase = needed * foodUnitScale[ingredient.unit];
    const available = availableBase / foodUnitScale[ingredient.unit];
    const missing =
      Math.max(0, neededBase - availableBase) / foodUnitScale[ingredient.unit];
    return {
      ingredient,
      needed,
      available,
      missing,
      ready: missing <= 0.0001,
    };
  });
}

function RecipeBuilder({
  foods,
  course,
  post,
  t,
}: {
  foods: FoodItem[];
  course: RecipeCourse;
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
        course,
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
          <label className="form-field">
            <span>{t('recipeCourse')}</span>
            <select name="course" value={course} disabled>
              <option value={course}>{t(recipeCourseCopy[course])}</option>
            </select>
          </label>
          <Field
            name="servings"
            label={t('servings')}
            type="number"
            defaultValue="3"
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

function localWeekStart() {
  const date = new Date();
  const daysFromMonday = (date.getDay() + 6) % 7;
  date.setDate(date.getDate() - daysFromMonday);
  return dateKey(date);
}

function evenlySpacedDays(count: number) {
  if (count <= 0) return [];
  if (count >= 7) return [0, 1, 2, 3, 4, 5, 6];
  if (count === 1) return [3];
  return Array.from({ length: count }, (_, index) =>
    Math.round((index * 6) / (count - 1)),
  );
}

function shuffled<T>(values: T[]) {
  const result = [...values];
  for (let index = result.length - 1; index > 0; index -= 1) {
    const swapIndex = Math.floor(Math.random() * (index + 1));
    [result[index], result[swapIndex]] = [result[swapIndex], result[index]];
  }
  return result;
}

function randomWeeklyMenu(
  recipes: Recipe[],
  frequencies: Record<RecipeCourse, number>,
) {
  const entries: Array<{
    dayIndex: number;
    course: RecipeCourse;
    recipeId: number;
  }> = [];
  for (const course of recipeCourses) {
    const candidates = shuffled(
      recipes.filter((recipe) => recipe.course === course),
    );
    if (!candidates.length) continue;
    evenlySpacedDays(frequencies[course]).forEach((dayIndex, index) => {
      entries.push({
        dayIndex,
        course,
        recipeId: candidates[index % candidates.length].id,
      });
    });
  }
  return entries;
}

type ShoppingItem = {
  key: string;
  name: string;
  unit: FoodUnit;
  needed: number;
  available: number;
  buy: number;
};

function weeklyShoppingList(
  plan: WeeklyMeal[],
  recipes: Recipe[],
  foods: FoodItem[],
): ShoppingItem[] {
  const recipeById = new Map(recipes.map((recipe) => [recipe.id, recipe]));
  const totals = new Map<
    string,
    { name: string; unit: FoodUnit; neededBase: number }
  >();
  for (const meal of plan) {
    const recipe = recipeById.get(meal.recipeId);
    if (!recipe) continue;
    const servingFactor = meal.servings / Math.max(1, recipe.servings);
    for (const ingredient of recipe.ingredients) {
      const dimension = foodUnitDimension[ingredient.unit];
      const key = `${ingredient.normalizedName}|${dimension}`;
      const previous = totals.get(key);
      const neededBase =
        Number(ingredient.quantity) *
        servingFactor *
        foodUnitScale[ingredient.unit];
      totals.set(key, {
        name: previous?.name ?? ingredient.name,
        unit: previous?.unit ?? ingredient.unit,
        neededBase: (previous?.neededBase ?? 0) + neededBase,
      });
    }
  }
  const todayKey = dateKey(new Date());
  return Array.from(totals.entries())
    .map(([key, total]) => {
      const [normalizedName, dimension] = key.split('|');
      const availableBase = foods
        .filter(
          (food) =>
            food.normalizedName === normalizedName &&
            foodUnitDimension[food.unit] === dimension &&
            (!food.expiresOn || food.expiresOn >= todayKey),
        )
        .reduce(
          (sum, food) => sum + Number(food.quantity) * foodUnitScale[food.unit],
          0,
        );
      const scale = foodUnitScale[total.unit];
      return {
        key,
        name: total.name,
        unit: total.unit,
        needed: total.neededBase / scale,
        available: availableBase / scale,
        buy: Math.max(0, total.neededBase - availableBase) / scale,
      };
    })
    .sort((left, right) => Number(right.buy > 0) - Number(left.buy > 0));
}

function WeeklyMealPlanner({
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
  const [frequencies, setFrequencies] = useState(defaultMealFrequencies);
  const [includeFoods, setIncludeFoods] = useState('');
  const [excludeFoods, setExcludeFoods] = useState('');
  const [cuisines, setCuisines] = useState('');
  const [cookNotes, setCookNotes] = useState('');
  const [useInventoryFirst, setUseInventoryFirst] = useState(true);
  const [includeNutrition, setIncludeNutrition] = useState(
    Boolean(data.currentUser.aiConsent),
  );
  const [aiBusy, setAiBusy] = useState(false);
  const [aiError, setAiError] = useState('');
  const [aiResult, setAiResult] = useState<AiPlanResult | null>(null);
  const [aiOutput, setAiOutput] = useState('');
  const aiOutputRef = useRef<HTMLPreElement>(null);
  const weekStart = localWeekStart();
  const plan = data.weeklyPlan.filter((meal) => meal.weekStart === weekStart);
  const recipeById = new Map(data.recipes.map((recipe) => [recipe.id, recipe]));
  const shopping = weeklyShoppingList(plan, data.recipes, data.foods);
  const missingCourses = recipeCourses.filter(
    (course) =>
      frequencies[course] > 0 &&
      !data.recipes.some((recipe) => recipe.course === course),
  );

  useEffect(() => {
    const output = aiOutputRef.current;
    if (output) output.scrollTop = output.scrollHeight;
  }, [aiOutput]);

  async function generateMenu() {
    const entries = randomWeeklyMenu(data.recipes, frequencies);
    await post({ type: 'meal-plan-save', weekStart, entries });
  }

  async function generateAiMenu() {
    setAiBusy(true);
    setAiError('');
    setAiResult(null);
    const startedAt = Date.now();
    let transcript = `[00:00] ${t('aiOutputStarting')}\n`;
    let rawOutputStarted = false;
    let streamedResult: AiPlanResult | null = null;
    setAiOutput(transcript);
    const appendStatus = (message: string) => {
      transcript += `\n[${aiProgressTime(startedAt)}] ${message}\n`;
    };
    try {
      const response = await fetch('/api/ai/meal-plan', {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify({
          includeFoods,
          excludeFoods,
          cuisines,
          notes: cookNotes,
          useInventoryFirst,
          includeNutrition,
          language,
          frequencies,
        }),
      });
      if (!response.ok) {
        const result = (await response.json().catch(() => ({}))) as {
          error?: string;
        };
        throw new Error(result.error || t('aiGenerationFailed'));
      }
      if (!response.body) throw new Error(t('aiOutputUnavailable'));
      const reader = response.body.getReader();
      const decoder = new TextDecoder();
      let buffer = '';
      let lastPaintAt = 0;
      const processLine = (line: string) => {
        if (!line.trim()) return;
        const event = JSON.parse(line) as AiStreamEvent;
        if (event.type === 'status') {
          const detail =
            event.provider && event.model
              ? ` (${event.provider} · ${event.model})`
              : '';
          appendStatus(`${t(aiProgressCopy[event.stage])}${detail}`);
        } else if (event.type === 'delta') {
          if (!rawOutputStarted) {
            rawOutputStarted = true;
            transcript += `\n── ${t('aiOutputRaw')} ──\n`;
          }
          transcript += event.delta;
        } else if (event.type === 'result') {
          streamedResult = event.result;
          appendStatus(t('aiOutputFinished'));
        } else if (event.type === 'error') {
          throw new Error(event.error || t('aiGenerationFailed'));
        }
      };
      while (true) {
        const { done, value } = await reader.read();
        buffer += decoder.decode(value, { stream: !done });
        const lines = buffer.split('\n');
        buffer = lines.pop() || '';
        for (const line of lines) processLine(line);
        if (done || Date.now() - lastPaintAt >= 80) {
          lastPaintAt = Date.now();
          setAiOutput(transcript);
        }
        if (done) break;
      }
      if (buffer.trim()) processLine(buffer);
      if (!streamedResult) throw new Error(t('aiOutputUnavailable'));
      setAiOutput(transcript);
      setAiResult(streamedResult);
    } catch (error) {
      const message =
        error instanceof Error ? error.message : t('aiGenerationFailed');
      setAiError(message);
      appendStatus(`${t('aiOutputError')}: ${message}`);
      setAiOutput(transcript);
    } finally {
      setAiBusy(false);
    }
  }

  async function applyAiMenu() {
    if (!aiResult) return;
    if (
      await post({
        type: 'ai-plan-apply',
        weekStart,
        proposal: aiResult.proposal,
      })
    )
      setAiResult(null);
  }

  return (
    <div className="meal-planner">
      <article className="panel ai-planner-panel">
        <div className="ai-planner-heading">
          <div className="ai-orb">
            <Sparkles size={22} />
          </div>
          <div>
            <span className="ai-badge">AI</span>
            <h2>{t('aiPlanner')}</h2>
            <p>{t('aiPlannerCopy')}</p>
          </div>
        </div>
        {!data.aiConfigured && (
          <div className="ai-config-warning">
            <Info size={17} />
            <div>
              <strong>{t('aiNotConfigured')}</strong>
              <span>{t('aiSetupHint')}</span>
            </div>
          </div>
        )}
        <div className="ai-preferences-grid">
          <label className="form-field">
            <span>{t('includeFoods')}</span>
            <input
              value={includeFoods}
              onChange={(event) => setIncludeFoods(event.target.value)}
              placeholder={t('includeFoodsPlaceholder')}
              maxLength={500}
            />
          </label>
          <label className="form-field">
            <span>{t('excludeFoods')}</span>
            <input
              value={excludeFoods}
              onChange={(event) => setExcludeFoods(event.target.value)}
              placeholder={t('excludeFoodsPlaceholder')}
              maxLength={500}
            />
          </label>
          <label className="form-field">
            <span>{t('cuisines')}</span>
            <input
              value={cuisines}
              onChange={(event) => setCuisines(event.target.value)}
              placeholder={t('cuisinesPlaceholder')}
              maxLength={400}
            />
          </label>
          <label className="form-field ai-notes-field">
            <span>{t('cookNotes')}</span>
            <textarea
              value={cookNotes}
              onChange={(event) => setCookNotes(event.target.value)}
              placeholder={t('cookNotesPlaceholder')}
              maxLength={1200}
            />
          </label>
        </div>
        <div className="frequency-grid ai-frequency-grid">
          {recipeCourses.map((course) => (
            <label key={course}>
              <span>{t(recipeCourseCopy[course])}</span>
              <input
                type="number"
                min="0"
                max="7"
                value={frequencies[course]}
                onChange={(event) =>
                  setFrequencies((current) => ({
                    ...current,
                    [course]: Math.max(
                      0,
                      Math.min(7, Number(event.target.value) || 0),
                    ),
                  }))
                }
              />
            </label>
          ))}
        </div>
        <div className="ai-toggles">
          <label>
            <input
              type="checkbox"
              aria-label={t('prioritizeInventory')}
              checked={useInventoryFirst}
              onChange={(event) => setUseInventoryFirst(event.target.checked)}
            />
            <span>
              <strong>{t('prioritizeInventory')}</strong>
              <small>{t('prioritizeInventoryCopy')}</small>
            </span>
          </label>
          <label>
            <input
              type="checkbox"
              aria-label={t('includeMyNutrition')}
              checked={includeNutrition}
              onChange={(event) => setIncludeNutrition(event.target.checked)}
            />
            <span>
              <strong>{t('includeMyNutrition')}</strong>
              <small>{t('aiPrivateDataNote')}</small>
            </span>
          </label>
        </div>
        <div className="ai-disclosure">
          <Lock size={15} />
          <span>
            {t('aiSharedDataNote')}{' '}
            {t('aiConsentingCount', { count: data.aiConsentingMembers })}
          </span>
        </div>
        <div className={`ai-output-window${aiBusy ? ' live' : ''}`}>
          <header>
            <span>
              <Activity size={14} />
              {t('aiOutputTitle')}
            </span>
            <output aria-live="polite">
              {aiBusy
                ? t('aiOutputLive')
                : aiError
                  ? t('aiOutputError')
                  : aiResult
                    ? t('aiOutputComplete')
                    : t('aiOutputReady')}
            </output>
          </header>
          <pre ref={aiOutputRef} aria-label={t('aiOutputTitle')}>
            {aiOutput || t('aiOutputIdle')}
          </pre>
        </div>
        {aiError && <p className="ai-error">{aiError}</p>}
        <button
          className="primary-button generate-menu ai-generate"
          onClick={() => void generateAiMenu()}
          disabled={!data.aiConfigured || aiBusy}
        >
          {aiBusy ? (
            <LoaderCircle className="spin" size={16} />
          ) : (
            <Sparkles size={16} />
          )}
          {aiBusy ? t('aiThinking') : t('generateWithAi')}
        </button>
      </article>

      {aiResult && (
        <article className="panel ai-preview">
          <div className="panel-heading">
            <div>
              <span className="ai-badge">{t('aiPreview')}</span>
              <h2>{aiResult.proposal.summary}</h2>
            </div>
            <Sparkles size={20} />
          </div>
          <p className="ai-rationale">
            <strong>{t('aiNutritionRationale')}</strong>
            {aiResult.proposal.nutritionRationale}
          </p>
          <div className="ai-preview-meta">
            <span>{t('aiModel', { model: aiResult.model })}</span>
            <span>
              {t('aiContributors', {
                count: aiResult.nutritionContributors,
              })}
            </span>
          </div>
          <div className="week-grid ai-preview-week">
            {weekdayCopy.map((day, dayIndex) => (
              <section key={day}>
                <h3>{t(day)}</h3>
                <div>
                  {aiResult.proposal.schedule
                    .filter((meal) => meal.dayIndex === dayIndex)
                    .map((meal, index) => {
                      const recipe = aiResult.proposal.recipes.find(
                        (item) => item.key === meal.recipeKey,
                      );
                      return recipe ? (
                        <span
                          className={`planned-meal ${meal.course}`}
                          key={`${meal.recipeKey}-${index}`}
                        >
                          <small>{t(recipeCourseCopy[meal.course])}</small>
                          <strong>{recipe.name}</strong>
                        </span>
                      ) : null;
                    })}
                </div>
              </section>
            ))}
          </div>
          <div className="ai-recipe-grid">
            {aiResult.proposal.recipes.map((recipe) => (
              <section key={recipe.key}>
                <div>
                  <strong>{recipe.name}</strong>
                  <small>{recipe.description}</small>
                </div>
                <span>
                  {Math.round(recipe.caloriesPerServing)} kcal ·{' '}
                  {Math.round(recipe.proteinPerServing)}P ·{' '}
                  {Math.round(recipe.carbsPerServing)}C ·{' '}
                  {Math.round(recipe.fatPerServing)}F
                </span>
              </section>
            ))}
          </div>
          <button
            className="primary-button ai-apply"
            onClick={() => void applyAiMenu()}
          >
            <Check size={16} />
            {t('applyAiPlan')}
          </button>
        </article>
      )}

      <article className="panel randomizer-panel">
        <div className="panel-heading">
          <div>
            <h2>{t('weeklyRandomizer')}</h2>
            <span>{t('frequencyHint')}</span>
          </div>
          <Sparkles size={20} />
        </div>
        <div className="frequency-grid">
          {recipeCourses.map((course) => (
            <label key={course}>
              <span>{t(recipeCourseCopy[course])}</span>
              <input
                type="number"
                min="0"
                max="7"
                value={frequencies[course]}
                onChange={(event) =>
                  setFrequencies((current) => ({
                    ...current,
                    [course]: Math.max(
                      0,
                      Math.min(7, Number(event.target.value) || 0),
                    ),
                  }))
                }
              />
            </label>
          ))}
        </div>
        {missingCourses.length > 0 && (
          <p className="planner-warning">
            <Info size={14} />
            {t('missingCourseRecipes', {
              courses: missingCourses
                .map((course) => t(recipeCourseCopy[course]))
                .join(', '),
            })}
          </p>
        )}
        <button
          className="primary-button generate-menu"
          onClick={generateMenu}
          disabled={!data.recipes.length}
        >
          <Sparkles size={16} />
          {plan.length ? t('regenerateWeek') : t('generateWeek')}
        </button>
      </article>

      <article className="panel week-panel">
        <div className="panel-heading">
          <div>
            <h2>{t('weeklyMenu')}</h2>
            <span>{t('weekForThree', { date: weekStart })}</span>
          </div>
          <CalendarDays size={20} />
        </div>
        {plan.length ? (
          <div className="week-grid">
            {weekdayCopy.map((day, dayIndex) => {
              const meals = plan.filter((meal) => meal.dayIndex === dayIndex);
              return (
                <section key={day}>
                  <h3>{t(day)}</h3>
                  <div>
                    {meals.map((meal) => {
                      const recipe = recipeById.get(meal.recipeId);
                      if (!recipe) return null;
                      return (
                        <span
                          className={`planned-meal ${meal.course}`}
                          key={meal.id}
                        >
                          <small>{t(recipeCourseCopy[meal.course])}</small>
                          <strong>{recipe.name}</strong>
                        </span>
                      );
                    })}
                  </div>
                </section>
              );
            })}
          </div>
        ) : (
          <Empty>{t('noMenuYet')}</Empty>
        )}
      </article>

      <article className="panel shopping-panel">
        <div className="panel-heading">
          <div>
            <h2>{t('weeklyShoppingList')}</h2>
            <span>{t('shoppingListCopy')}</span>
          </div>
          <ListChecks size={20} />
        </div>
        {shopping.length ? (
          <div className="weekly-shopping-list">
            {shopping.map((item) => (
              <div className={item.buy > 0 ? 'buy' : 'stocked'} key={item.key}>
                <span>
                  {item.buy > 0 ? (
                    <ShoppingBasket size={16} />
                  ) : (
                    <CheckCircle2 size={16} />
                  )}
                </span>
                <div>
                  <strong>{item.name}</strong>
                  <small>
                    {t('totalNeeded')}:{' '}
                    {formatFoodQuantity(item.needed, item.unit, t)} ·{' '}
                    {t('atHome')}:{' '}
                    {formatFoodQuantity(item.available, item.unit, t)}
                  </small>
                </div>
                <b>
                  {item.buy > 0
                    ? `${t('buy')}: ${formatFoodQuantity(item.buy, item.unit, t)}`
                    : t('inStock')}
                </b>
              </div>
            ))}
          </div>
        ) : (
          <Empty>{t('noShoppingList')}</Empty>
        )}
      </article>
    </div>
  );
}

function FoodStorageView({
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
  const [scope, setScope] = useState<'inventory' | 'recipes' | 'mealPlan'>(
    'inventory',
  );
  const [recipeCourse, setRecipeCourse] = useState<RecipeCourse>('breakfast');
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
          <BookOpen size={16} />
          {t('recipes')}
        </button>
        <button
          className={scope === 'mealPlan' ? 'selected' : ''}
          onClick={() => setScope('mealPlan')}
        >
          <CalendarDays size={16} />
          {t('mealPlan')}
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
      ) : scope === 'recipes' ? (
        <>
          <div className="course-tabs" aria-label={t('recipeSections')}>
            {recipeCourses.map((course) => {
              const count = data.recipes.filter(
                (recipe) => recipe.course === course,
              ).length;
              return (
                <button
                  className={recipeCourse === course ? 'selected' : ''}
                  onClick={() => setRecipeCourse(course)}
                  key={course}
                >
                  {t(recipeCourseCopy[course])}
                  <span>{count}</span>
                </button>
              );
            })}
          </div>
          <RecipeBuilder
            foods={data.foods}
            course={recipeCourse}
            post={post}
            t={t}
          />
          <div className="recipe-grid">
            {data.recipes.some((recipe) => recipe.course === recipeCourse) ? (
              data.recipes
                .filter((recipe) => recipe.course === recipeCourse)
                .map((recipe) => {
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
                            {t('shoppingListForThree')} ·{' '}
                            {t('recipeBy', { name: recipe.createdByName })}
                          </span>
                        </div>
                        <button
                          onClick={() => {
                            if (window.confirm(`${t('remove')}?`))
                              void post({
                                type: 'recipe-remove',
                                id: recipe.id,
                              });
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
                                item.needed,
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
                <Empty>{t('emptyRecipeSection')}</Empty>
              </article>
            )}
          </div>
        </>
      ) : (
        <WeeklyMealPlanner data={data} post={post} t={t} language={language} />
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

function MedicationsView({
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
  const todayKey = dateKey(new Date());
  const activeToday = data.medications.filter(
    (medication) =>
      medication.active &&
      medication.startOn <= todayKey &&
      (!medication.endOn || medication.endOn >= todayKey),
  );
  const scheduledToday = activeToday.reduce(
    (count, medication) => count + medication.scheduleTimes.length,
    0,
  );
  const takenToday = data.medicationDoses.filter((dose) =>
    dose.scheduledFor.startsWith(todayKey),
  ).length;
  return (
    <>
      <PageTitle
        eyebrow={t('medicationEyebrow')}
        title={t('medications')}
        copy={t('medicationCopy')}
      />
      <div className="medication-summary-grid">
        <article className="panel medication-summary">
          <span className="tinted-icon violet">
            <Pill size={19} />
          </span>
          <div>
            <strong>{activeToday.length}</strong>
            <span>{t('activeMedications')}</span>
          </div>
        </article>
        <article className="panel medication-summary">
          <span className="tinted-icon green">
            <CheckCircle2 size={19} />
          </span>
          <div>
            <strong>
              {takenToday} / {scheduledToday}
            </strong>
            <span>{t('dosesToday')}</span>
          </div>
        </article>
      </div>
      <article className="panel medication-entry-panel">
        <div className="panel-heading">
          <div>
            <h2>{t('addMedication')}</h2>
            <span>{t('medicationFormHint')}</span>
          </div>
          <Pill size={19} />
        </div>
        <form
          className="medication-form"
          onSubmit={(event) => submitForm(event, post, 'medication')}
        >
          <Field
            name="name"
            label={t('medicationName')}
            placeholder={t('medicationNamePlaceholder')}
          />
          <Field
            name="dosage"
            label={t('dosage')}
            placeholder={t('dosagePlaceholder')}
          />
          <Field
            name="scheduleTimes"
            label={t('dailyTimes')}
            placeholder="08:00, 20:00"
          />
          <Field
            name="startOn"
            label={t('startDate')}
            type="date"
            defaultValue={todayKey}
          />
          <label className="form-field">
            <span>{t('endDateOptional')}</span>
            <input name="endOn" type="date" min={todayKey} />
          </label>
          <PrivacySelect t={t} />
          <label className="form-field medication-instructions">
            <span>{t('instructionsOptional')}</span>
            <textarea
              name="instructions"
              maxLength={500}
              placeholder={t('medicationInstructionsPlaceholder')}
            />
          </label>
          <button className="primary-button">
            <Plus size={16} />
            {t('addMedication')}
          </button>
        </form>
      </article>
      <div className="medication-card-grid">
        {data.medications.length ? (
          data.medications.map((medication) => {
            const todayDoses = medication.scheduleTimes.map((time) => {
              const scheduledFor = `${todayKey}T${time}`;
              return {
                time,
                scheduledFor,
                dose: data.medicationDoses.find(
                  (candidate) =>
                    candidate.medicationId === medication.id &&
                    candidate.scheduledFor === scheduledFor,
                ),
              };
            });
            const inDateRange =
              medication.startOn <= todayKey &&
              (!medication.endOn || medication.endOn >= todayKey);
            return (
              <article
                className={`panel medication-card${medication.active ? '' : ' paused'}`}
                key={medication.id}
              >
                <header>
                  <span className="medication-icon">
                    <Pill size={18} />
                  </span>
                  <div>
                    <strong>{medication.name}</strong>
                    <span>{medication.dosage}</span>
                  </div>
                  <PrivacyBadge visibility={medication.visibility} t={t} />
                </header>
                {medication.instructions && <p>{medication.instructions}</p>}
                <div className="medication-dates">
                  <CalendarDays size={14} />
                  {formatMoneyDate(medication.startOn, language)}
                  {medication.endOn
                    ? ` – ${formatMoneyDate(medication.endOn, language)}`
                    : ''}
                </div>
                {!medication.owned && (
                  <small>
                    {t('sharedByName', { name: medication.ownerName })}
                  </small>
                )}
                <div className="dose-list">
                  {todayDoses.map(({ time, scheduledFor, dose }) => (
                    <div className={dose ? 'taken' : ''} key={scheduledFor}>
                      <span>
                        <Clock3 size={14} /> {time}
                      </span>
                      {dose ? (
                        <b>
                          <Check size={13} /> {t('taken')}
                        </b>
                      ) : medication.owned &&
                        medication.active &&
                        inDateRange ? (
                        <button
                          type="button"
                          onClick={() =>
                            void post({
                              type: 'medication-dose',
                              id: medication.id,
                              scheduledFor,
                            })
                          }
                        >
                          {t('markTaken')}
                        </button>
                      ) : (
                        <b>{t('scheduled')}</b>
                      )}
                    </div>
                  ))}
                </div>
                {medication.owned && (
                  <footer>
                    <button
                      type="button"
                      className="secondary-button compact-button"
                      onClick={() =>
                        void post({
                          type: 'medication-toggle',
                          id: medication.id,
                          active: !medication.active,
                        })
                      }
                    >
                      {medication.active ? (
                        <Pause size={14} />
                      ) : (
                        <Play size={14} />
                      )}
                      {medication.active ? t('pause') : t('resume')}
                    </button>
                  </footer>
                )}
              </article>
            );
          })
        ) : (
          <article className="panel">
            <Empty>{t('noMedications')}</Empty>
          </article>
        )}
      </div>
      <p className="medical-disclaimer">
        <Info size={14} /> {t('medicationDisclaimer')}
      </p>
    </>
  );
}

function TasksView({
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
  const tomorrow = new Date();
  tomorrow.setDate(tomorrow.getDate() + 1);
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
        <Field
          name="dueOn"
          label={t('due')}
          type="date"
          defaultValue={dateKey(tomorrow)}
        />
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
                        {task.dueOn
                          ? formatMoneyDate(task.dueOn, language)
                          : task.due}
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

function WishlistView({
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
  const openIdeas = data.purchaseIdeas.filter((idea) => idea.status === 'open');
  const boughtIdeas = data.purchaseIdeas.filter(
    (idea) => idea.status === 'bought',
  );
  const estimatedOpenCost = openIdeas.reduce(
    (sum, idea) => sum + Number(idea.estimatedCost || 0),
    0,
  );
  const totalVotes = data.purchaseVotes.length;
  return (
    <>
      <PageTitle
        eyebrow={t('wishlistEyebrow')}
        title={t('houseWishlist')}
        copy={t('wishlistCopy')}
      />
      <div className="wishlist-summary-grid">
        <article className="panel wishlist-summary">
          <span className="tinted-icon peach">
            <Gift size={19} />
          </span>
          <div>
            <strong>{openIdeas.length}</strong>
            <span>{t('openIdeas')}</span>
          </div>
        </article>
        <article className="panel wishlist-summary">
          <span className="tinted-icon green">
            <CircleDollarSign size={19} />
          </span>
          <div>
            <strong>{money(estimatedOpenCost, language)}</strong>
            <span>{t('estimatedWishlistCost')}</span>
          </div>
        </article>
        <article className="panel wishlist-summary">
          <span className="tinted-icon blue">
            <ThumbsUp size={19} />
          </span>
          <div>
            <strong>{totalVotes}</strong>
            <span>{t('householdVotes')}</span>
          </div>
        </article>
      </div>
      <article className="panel wishlist-entry-panel">
        <div className="panel-heading">
          <div>
            <h2>{t('suggestPurchase')}</h2>
            <span>{t('wishlistAlwaysShared')}</span>
          </div>
          <span className="privacy-badge shared">
            <Users size={11} /> {t('shared')}
          </span>
        </div>
        <form
          className="wishlist-form"
          onSubmit={(event) => submitForm(event, post, 'purchase-idea')}
        >
          <Field
            name="title"
            label={t('itemName')}
            placeholder={t('itemNamePlaceholder')}
          />
          <label className="form-field">
            <span>{t('estimatedCostOptional')}</span>
            <input
              name="estimatedCost"
              type="number"
              min="0"
              step="any"
              placeholder="0"
            />
          </label>
          <label className="form-field wishlist-description">
            <span>{t('whyBuyIt')}</span>
            <textarea
              name="description"
              maxLength={800}
              placeholder={t('whyBuyItPlaceholder')}
            />
          </label>
          <button className="primary-button">
            <Plus size={16} />
            {t('addIdea')}
          </button>
        </form>
      </article>
      <div className="wishlist-card-grid">
        {openIdeas.length ? (
          openIdeas.map((idea) => (
            <PurchaseIdeaCard
              key={idea.id}
              idea={idea}
              votes={data.purchaseVotes.filter(
                (vote) => vote.ideaId === idea.id,
              )}
              post={post}
              t={t}
              language={language}
            />
          ))
        ) : (
          <article className="panel">
            <Empty>{t('noPurchaseIdeas')}</Empty>
          </article>
        )}
      </div>
      {boughtIdeas.length > 0 && (
        <section className="wishlist-bought-section">
          <div className="panel-heading">
            <div>
              <h2>{t('boughtForHome')}</h2>
              <span>{t('boughtForHomeCopy')}</span>
            </div>
            <PackageCheck size={19} />
          </div>
          <div className="wishlist-card-grid">
            {boughtIdeas.map((idea) => (
              <PurchaseIdeaCard
                key={idea.id}
                idea={idea}
                votes={data.purchaseVotes.filter(
                  (vote) => vote.ideaId === idea.id,
                )}
                post={post}
                t={t}
                language={language}
              />
            ))}
          </div>
        </section>
      )}
    </>
  );
}

function PurchaseIdeaCard({
  idea,
  votes,
  post,
  t,
  language,
}: {
  idea: PurchaseIdea;
  votes: PurchaseVote[];
  post: Post;
  t: T;
  language: Language;
}) {
  const yesVotes = votes.filter((vote) => vote.vote === 1);
  const noVotes = votes.filter((vote) => vote.vote === -1);
  const myVote = votes.find((vote) => vote.mine)?.vote || 0;
  const score = yesVotes.length - noVotes.length;
  return (
    <article
      className={`panel wishlist-card${idea.status === 'bought' ? ' bought' : ''}`}
    >
      <header>
        <Avatar person={idea} />
        <div>
          <span>{t('suggestedBy', { name: idea.createdByName })}</span>
          <h2>{idea.title}</h2>
        </div>
        {idea.status === 'bought' && (
          <span className="purchase-bought-badge">
            <Check size={12} />
            {t('bought')}
          </span>
        )}
      </header>
      {idea.description && <p>{idea.description}</p>}
      <div className="wishlist-cost-score">
        <span>
          {idea.estimatedCost
            ? money(Number(idea.estimatedCost), language)
            : t('noCostEstimate')}
        </span>
        <strong className={score < 0 ? 'negative' : ''}>
          {score > 0 ? '+' : ''}
          {score} {t('voteScore')}
        </strong>
      </div>
      <div className="vote-breakdown">
        <div>
          <span>
            <ThumbsUp size={14} />
            {t('forPurchase')} · {yesVotes.length}
          </span>
          <span className="avatar-stack">
            {yesVotes.slice(0, 5).map((vote) => (
              <span title={vote.name} key={vote.id}>
                <Avatar person={vote} small />
              </span>
            ))}
          </span>
        </div>
        <div>
          <span>
            <ThumbsDown size={14} />
            {t('againstPurchase')} · {noVotes.length}
          </span>
          <span className="avatar-stack">
            {noVotes.slice(0, 5).map((vote) => (
              <span title={vote.name} key={vote.id}>
                <Avatar person={vote} small />
              </span>
            ))}
          </span>
        </div>
      </div>
      {idea.status === 'open' && (
        <div className="vote-actions">
          <button
            type="button"
            className={myVote === 1 ? 'active yes' : ''}
            onClick={() =>
              void post({
                type: 'purchase-vote',
                id: idea.id,
                vote: myVote === 1 ? 0 : 1,
              })
            }
          >
            <ThumbsUp size={15} />
            {t('voteFor')}
          </button>
          <button
            type="button"
            className={myVote === -1 ? 'active no' : ''}
            onClick={() =>
              void post({
                type: 'purchase-vote',
                id: idea.id,
                vote: myVote === -1 ? 0 : -1,
              })
            }
          >
            <ThumbsDown size={15} />
            {t('voteAgainst')}
          </button>
        </div>
      )}
      {idea.owned && (
        <footer>
          <button
            type="button"
            className="secondary-button compact-button"
            onClick={() =>
              void post({
                type: 'purchase-status',
                id: idea.id,
                status: idea.status === 'open' ? 'bought' : 'open',
              })
            }
          >
            {idea.status === 'open' ? (
              <PackageCheck size={14} />
            ) : (
              <RotateCcw size={14} />
            )}
            {idea.status === 'open' ? t('markBought') : t('moveBackToVoting')}
          </button>
          <button
            type="button"
            className="secondary-button compact-button"
            onClick={() =>
              void post({
                type: 'purchase-status',
                id: idea.id,
                status: 'archived',
              })
            }
          >
            <Archive size={14} />
            {t('archiveIdea')}
          </button>
        </footer>
      )}
    </article>
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
  const [categoryFilter, setCategoryFilter] = useState('all');
  const [expenseSort, setExpenseSort] = useState('newest');
  const categories = useMemo(() => {
    const totals = data.expenses.reduce<Record<string, number>>((all, item) => {
      const category = normalizedExpenseCategory(item.category);
      all[category] = (all[category] || 0) + Number(item.amount);
      return all;
    }, {});
    return Object.entries(totals)
      .sort((a, b) => b[1] - a[1])
      .map(([category, value], index) => ({
        category,
        label: expenseCategoryLabel(category, t),
        value,
        color: spendingColors[index % spendingColors.length],
      }));
  }, [data.expenses, t]);
  const wheelBackground = useMemo(() => {
    if (!total) return '#ece8e0';
    let start = 0;
    return `conic-gradient(${categories
      .map((category) => {
        const end = start + (category.value / total) * 100;
        const segment = `${category.color} ${start}% ${end}%`;
        start = end;
        return segment;
      })
      .join(',')})`;
  }, [categories, total]);
  const visibleExpenses = useMemo(
    () =>
      data.expenses
        .filter(
          (expense) =>
            categoryFilter === 'all' ||
            normalizedExpenseCategory(expense.category) === categoryFilter,
        )
        .sort((left, right) => {
          if (expenseSort === 'highest')
            return Number(right.amount) - Number(left.amount);
          if (expenseSort === 'lowest')
            return Number(left.amount) - Number(right.amount);
          const direction = expenseSort === 'oldest' ? 1 : -1;
          return (
            direction * left.spentOn.localeCompare(right.spentOn) ||
            direction * (left.id - right.id)
          );
        }),
    [categoryFilter, data.expenses, expenseSort],
  );
  const monthlyCommitments = data.recurringPayments
    .filter((payment) => payment.active)
    .reduce(
      (sum, payment) =>
        sum +
        Number(payment.amount) / (payment.billingCycle === 'yearly' ? 12 : 1),
      0,
    );
  const nextMonth = new Date();
  nextMonth.setUTCMonth(nextMonth.getUTCMonth() + 1);
  const defaultDueDate = nextMonth.toISOString().slice(0, 10);
  const currentDate = new Date().toISOString().slice(0, 10);
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
          <div className="spending-wheel-layout">
            {categories.length ? (
              <>
                <div
                  className="spending-wheel"
                  style={{ background: wheelBackground }}
                >
                  <span>
                    <b>{data.expenses.length}</b>
                    {t('entries')}
                  </span>
                </div>
                <div className="spending-wheel-legend">
                  {categories.map((category) => (
                    <button
                      type="button"
                      className={
                        categoryFilter === category.category ? 'active' : ''
                      }
                      onClick={() =>
                        setCategoryFilter((current) =>
                          current === category.category
                            ? 'all'
                            : category.category,
                        )
                      }
                      key={category.category}
                    >
                      <i style={{ backgroundColor: category.color }} />
                      <span>{category.label}</span>
                      <b>{money(category.value, language)}</b>
                    </button>
                  ))}
                </div>
              </>
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
              <select name="category" defaultValue="groceries">
                {expenseCategoryOptions.map((option) => (
                  <option value={option.value} key={option.value}>
                    {t(option.key)}
                  </option>
                ))}
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
      <article className="panel recurring-panel">
        <div className="panel-heading recurring-heading">
          <div>
            <h2>{t('scheduledPayments')}</h2>
            <span>{t('scheduledPaymentsCopy')}</span>
          </div>
          <div className="commitment-total">
            <small>{t('monthlyCommitments')}</small>
            <strong>{money(monthlyCommitments, language)}</strong>
          </div>
        </div>
        <form
          className="recurring-form"
          onSubmit={(event) => submitForm(event, post, 'recurring-payment')}
        >
          <label className="form-field">
            <span>{t('paymentType')}</span>
            <select name="kind" defaultValue="subscription">
              <option value="subscription">{t('subscription')}</option>
              <option value="loan">{t('loanPayment')}</option>
              <option value="rent">{t('apartmentRent')}</option>
            </select>
          </label>
          <Field
            name="label"
            label={t('paymentName')}
            placeholder={t('paymentNamePlaceholder')}
          />
          <Field name="amount" label={t('paymentAmount')} type="number" />
          <label className="form-field">
            <span>{t('billingCycle')}</span>
            <select name="billingCycle" defaultValue="monthly">
              <option value="monthly">{t('monthly')}</option>
              <option value="yearly">{t('yearly')}</option>
            </select>
          </label>
          <Field
            name="nextDueOn"
            label={t('nextDueDate')}
            type="date"
            defaultValue={defaultDueDate}
          />
          <label className="form-field">
            <span>{t('loanRemaining')}</span>
            <input
              name="remainingAmount"
              type="number"
              min="0"
              step="any"
              placeholder={t('loanOnly')}
            />
          </label>
          <PrivacySelect t={t} />
          <button className="primary-button">
            <Plus size={16} />
            {t('addScheduledPayment')}
          </button>
        </form>
        <div className="payment-card-grid">
          {data.recurringPayments.length ? (
            data.recurringPayments.map((payment) => {
              const Icon =
                payment.kind === 'subscription'
                  ? CreditCard
                  : payment.kind === 'loan'
                    ? CircleDollarSign
                    : Home;
              const overdue =
                Boolean(payment.active) && payment.nextDueOn < currentDate;
              return (
                <section
                  className={`payment-card${!payment.active ? ' paused' : ''}${overdue ? ' overdue' : ''}`}
                  key={payment.id}
                >
                  <header>
                    <span className="payment-kind-icon">
                      <Icon size={17} />
                    </span>
                    <div>
                      <small>
                        {t(
                          payment.kind === 'subscription'
                            ? 'subscription'
                            : payment.kind === 'loan'
                              ? 'loanPayment'
                              : 'apartmentRent',
                        )}
                      </small>
                      <strong>{payment.label}</strong>
                    </div>
                    <PrivacyBadge visibility={payment.visibility} t={t} />
                  </header>
                  <div className="payment-amount-row">
                    <strong>{money(Number(payment.amount), language)}</strong>
                    <span>
                      {payment.billingCycle === 'yearly'
                        ? t('perYear')
                        : t('perMonth')}
                    </span>
                  </div>
                  <div className="payment-meta">
                    <span>
                      <CalendarClock size={14} />
                      {overdue ? t('overdue') : t('nextDue')}:{' '}
                      {formatMoneyDate(payment.nextDueOn, language)}
                    </span>
                    {payment.remainingAmount !== null && (
                      <span>
                        {t('remainingBalance')}:{' '}
                        {money(Number(payment.remainingAmount), language)}
                      </span>
                    )}
                    {!payment.owned && <span>{t('sharedHousemate')}</span>}
                  </div>
                  {payment.owned && (
                    <footer>
                      {payment.active && (
                        <button
                          type="button"
                          className="primary-button compact-button"
                          onClick={() =>
                            void post({
                              type: 'recurring-payment-pay',
                              id: payment.id,
                            })
                          }
                        >
                          <Check size={14} />
                          {t('recordPayment')}
                        </button>
                      )}
                      <button
                        type="button"
                        className="secondary-button compact-button"
                        onClick={() =>
                          void post({
                            type: 'recurring-payment-toggle',
                            id: payment.id,
                            active: !payment.active,
                          })
                        }
                      >
                        {payment.active ? (
                          <Pause size={14} />
                        ) : (
                          <Play size={14} />
                        )}
                        {payment.active ? t('pause') : t('resume')}
                      </button>
                    </footer>
                  )}
                </section>
              );
            })
          ) : (
            <Empty>{t('noScheduledPayments')}</Empty>
          )}
        </div>
      </article>
      <article className="panel table-panel">
        <div className="panel-heading">
          <div>
            <h2>{t('recentExpenses')}</h2>
            <span>
              {t('visibleEntries', { count: visibleExpenses.length })}
            </span>
          </div>
          <div className="expense-controls">
            <label>
              <span>{t('filter')}</span>
              <select
                value={categoryFilter}
                onChange={(event) => setCategoryFilter(event.target.value)}
              >
                <option value="all">{t('allCategories')}</option>
                {expenseCategoryOptions.map((option) => (
                  <option value={option.value} key={option.value}>
                    {t(option.key)}
                  </option>
                ))}
              </select>
            </label>
            <label>
              <span>{t('sortBy')}</span>
              <select
                value={expenseSort}
                onChange={(event) => setExpenseSort(event.target.value)}
              >
                <option value="newest">{t('newest')}</option>
                <option value="oldest">{t('oldest')}</option>
                <option value="highest">{t('highestAmount')}</option>
                <option value="lowest">{t('lowestAmount')}</option>
              </select>
            </label>
          </div>
        </div>
        <div className="expense-list">
          {visibleExpenses.length ? (
            visibleExpenses.map((item) => (
              <div key={item.id}>
                <span className="expense-icon">
                  <WalletCards size={16} />
                </span>
                <div>
                  <strong>{item.label}</strong>
                  <small>
                    {expenseCategoryLabel(item.category, t)} ·{' '}
                    {formatMoneyDate(item.spentOn, language)}
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
  language,
}: {
  data: Data;
  post: Post;
  t: T;
  language: Language;
}) {
  const lists = Array.from(new Set(data.organisers.map((item) => item.list)));
  const [reminderDefault] = useState(() =>
    dateTimeKey(new Date(Date.now() + 60 * 60_000)),
  );
  return (
    <>
      <PageTitle
        eyebrow={t('organiserEyebrow')}
        title={t('organisers')}
        copy={t('organiserCopy')}
      />
      <article className="panel reminder-panel">
        <div className="panel-heading">
          <div>
            <h2>{t('reminders')}</h2>
            <span>{t('remindersCopy')}</span>
          </div>
          <BellRing size={19} />
        </div>
        <form
          className="quick-form privacy-form"
          onSubmit={(event) => submitForm(event, post, 'reminder')}
        >
          <Field
            name="label"
            label={t('reminderName')}
            placeholder={t('reminderPlaceholder')}
          />
          <Field
            name="remindAt"
            label={t('remindAt')}
            type="datetime-local"
            defaultValue={reminderDefault}
          />
          <PrivacySelect t={t} />
          <button className="primary-button">
            <Plus size={16} />
            {t('addReminder')}
          </button>
        </form>
        <div className="reminder-list">
          {data.reminders.length ? (
            data.reminders.map((reminder) => (
              <div
                className={reminder.done ? 'complete' : ''}
                key={reminder.id}
              >
                {reminder.owned ? (
                  <button
                    type="button"
                    onClick={() =>
                      void post({
                        type: 'reminder-toggle',
                        id: reminder.id,
                        done: !reminder.done,
                      })
                    }
                  >
                    <i>{reminder.done && <Check size={12} />}</i>
                    <span>
                      <strong>{reminder.label}</strong>
                      <small>
                        {formatDateTime(reminder.remindAt, language)}
                      </small>
                    </span>
                  </button>
                ) : (
                  <span className="readonly-item">
                    <Clock3 size={14} />
                    <span>
                      <strong>{reminder.label}</strong>
                      <small>
                        {formatDateTime(reminder.remindAt, language)}
                      </small>
                    </span>
                  </span>
                )}
                <PrivacyBadge visibility={reminder.visibility} t={t} />
              </div>
            ))
          ) : (
            <Empty>{t('noReminders')}</Empty>
          )}
        </div>
      </article>
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
            <Image
              className="chat-home-photo"
              src={data.home.photo}
              alt=""
              width={34}
              height={34}
              unoptimized
            />
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
  language,
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
          <article className="panel ai-consent-card">
            <div className="ai-consent-icon">
              <Sparkles size={19} />
            </div>
            <div>
              <h2>{t('aiConsentTitle')}</h2>
              <p>{t('aiConsentCopy')}</p>
              <span>
                <Lock size={13} />
                {user.aiConsent
                  ? t('aiConsentEnabled')
                  : t('aiConsentDisabled')}
              </span>
            </div>
            <button
              className={user.aiConsent ? 'secondary-button' : 'primary-button'}
              onClick={() =>
                post({ type: 'ai-consent', enabled: !user.aiConsent })
              }
            >
              {user.aiConsent ? t('disableAiConsent') : t('enableAiConsent')}
            </button>
          </article>
          <AccountSecurityCard t={t} language={language} />
          {user.role === 'owner' && (
            <EnrollmentCard t={t} language={language} />
          )}
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

type AccountSession = {
  id: number;
  userAgent: string;
  createdAt: string;
  expiresAt: string;
  current: boolean | number;
};

function sessionDevice(userAgent: string) {
  if (/Electron/i.test(userAgent)) return 'Electron';
  if (/Android|iPhone|iPad|Mobile/i.test(userAgent)) return 'Mobile';
  if (/Windows/i.test(userAgent)) return 'Windows';
  if (/Macintosh|Mac OS/i.test(userAgent)) return 'macOS';
  if (/Linux/i.test(userAgent)) return 'Linux';
  return 'Browser';
}

function AccountSecurityCard({ t, language }: { t: T; language: Language }) {
  const [sessions, setSessions] = useState<AccountSession[]>([]);
  const [busy, setBusy] = useState(false);
  const [message, setMessage] = useState('');
  const [error, setError] = useState('');

  const loadSessions = useCallback(async () => {
    const response = await fetch('/api/account/sessions', {
      cache: 'no-store',
    });
    if (response.status === 401) {
      window.location.assign('/login');
      return;
    }
    if (!response.ok) throw new Error(t('storageFailed'));
    const payload = (await response.json()) as { sessions: AccountSession[] };
    setSessions(payload.sessions);
  }, [t]);

  useEffect(() => {
    queueMicrotask(() => {
      void loadSessions().catch((cause) =>
        setError(cause instanceof Error ? cause.message : t('storageFailed')),
      );
    });
  }, [loadSessions, t]);

  async function changePassword(event: SubmitEvent<HTMLFormElement>) {
    event.preventDefault();
    const form = event.currentTarget;
    const values = new FormData(form);
    setBusy(true);
    setError('');
    setMessage('');
    try {
      const response = await fetch('/api/account/password', {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify({
          currentPassword: values.get('currentPassword'),
          newPassword: values.get('newPassword'),
        }),
      });
      const payload = (await response.json().catch(() => ({}))) as {
        error?: string;
      };
      if (!response.ok) throw new Error(payload.error || t('saveFailed'));
      form.reset();
      setMessage(t('passwordChanged'));
      await loadSessions();
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : t('saveFailed'));
    } finally {
      setBusy(false);
    }
  }

  async function revokeSession(session: AccountSession) {
    setBusy(true);
    setError('');
    setMessage('');
    try {
      const response = await fetch('/api/account/sessions', {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify({ sessionId: session.id }),
      });
      const payload = (await response.json().catch(() => ({}))) as {
        error?: string;
        currentRevoked?: boolean;
      };
      if (!response.ok) throw new Error(payload.error || t('saveFailed'));
      if (payload.currentRevoked) {
        window.location.assign('/login');
        return;
      }
      setMessage(t('sessionRevoked'));
      await loadSessions();
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : t('saveFailed'));
    } finally {
      setBusy(false);
    }
  }

  return (
    <article className="panel account-security-card">
      <div className="account-security-heading">
        <span>
          <ShieldCheck size={18} />
        </span>
        <div>
          <h2>{t('accountSecurity')}</h2>
          <p>{t('accountSecurityCopy')}</p>
        </div>
      </div>
      <form className="password-form" onSubmit={changePassword}>
        <Field
          name="currentPassword"
          label={t('currentPassword')}
          type="password"
          maxLength={128}
          autoComplete="current-password"
        />
        <Field
          name="newPassword"
          label={t('newPassword')}
          type="password"
          minLength={12}
          maxLength={128}
          autoComplete="new-password"
        />
        <button className="primary-button" disabled={busy}>
          {t('changePassword')}
        </button>
      </form>
      <div className="session-heading">
        <strong>{t('activeSessions')}</strong>
        <span>{t('activeSessionsCount', { count: sessions.length })}</span>
      </div>
      <div className="session-list">
        {sessions.map((session) => (
          <div key={session.id}>
            <Monitor size={16} />
            <span>
              <strong>
                {sessionDevice(session.userAgent)}
                {session.current ? ` · ${t('thisDevice')}` : ''}
              </strong>
              <small>
                {t('signedInAt', {
                  date: new Intl.DateTimeFormat(language, {
                    dateStyle: 'medium',
                    timeStyle: 'short',
                  }).format(new Date(session.createdAt)),
                })}
              </small>
            </span>
            <button
              className="danger-text-button"
              type="button"
              disabled={busy}
              onClick={() => void revokeSession(session)}
            >
              {session.current ? t('signOut') : t('revokeSession')}
            </button>
          </div>
        ))}
      </div>
      {message && <output className="security-success">{message}</output>}
      {error && <div className="auth-error">{error}</div>}
    </article>
  );
}

function EnrollmentCard({ t, language }: { t: T; language: Language }) {
  const [settings, setSettings] = useState<{
    registrationOpen: boolean;
    inviteExpiresAt: string | null;
  } | null>(null);
  const [inviteCode, setInviteCode] = useState('');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');

  useEffect(() => {
    void fetch('/api/household/enrollment', { cache: 'no-store' })
      .then(async (response) => {
        if (!response.ok) throw new Error();
        return response.json() as Promise<{
          registrationOpen: boolean;
          inviteExpiresAt: string | null;
        }>;
      })
      .then(setSettings)
      .catch(() => setError(t('storageFailed')));
  }, [t]);

  async function update(action: 'rotate' | 'close') {
    setBusy(true);
    setError('');
    try {
      const response = await fetch('/api/household/enrollment', {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify({ action }),
      });
      const payload = (await response.json()) as {
        error?: string;
        registrationOpen?: boolean;
        inviteExpiresAt?: string | null;
        inviteCode?: string;
      };
      if (!response.ok) throw new Error(payload.error || t('saveFailed'));
      setSettings({
        registrationOpen: Boolean(payload.registrationOpen),
        inviteExpiresAt: payload.inviteExpiresAt ?? null,
      });
      setInviteCode(payload.inviteCode ?? '');
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : t('saveFailed'));
    } finally {
      setBusy(false);
    }
  }

  return (
    <article className="panel enrollment-card">
      <div className="enrollment-icon">
        <KeyRound size={18} />
      </div>
      <div>
        <span className="eyebrow">{t('ownerOnly')}</span>
        <h2>{t('enrollmentTitle')}</h2>
        <p>{t('enrollmentCopy')}</p>
        <strong>
          {settings?.registrationOpen && settings.inviteExpiresAt
            ? t('enrollmentOpen', {
                date: new Intl.DateTimeFormat(language, {
                  dateStyle: 'medium',
                  timeStyle: 'short',
                }).format(new Date(settings.inviteExpiresAt)),
              })
            : t('enrollmentClosed')}
        </strong>
        {inviteCode && (
          <button
            className="invite-code"
            type="button"
            title={t('inviteCodeOnce')}
            onClick={() => void navigator.clipboard?.writeText(inviteCode)}
          >
            {inviteCode}
          </button>
        )}
        {inviteCode && <small>{t('inviteCodeOnce')}</small>}
        {error && <div className="auth-error">{error}</div>}
      </div>
      <div className="enrollment-actions">
        <button
          className="primary-button"
          disabled={busy}
          onClick={() => void update('rotate')}
        >
          {t('createInvite')}
        </button>
        {settings?.registrationOpen && (
          <button
            className="secondary-button"
            disabled={busy}
            onClick={() => void update('close')}
          >
            {t('closeRegistration')}
          </button>
        )}
      </div>
    </article>
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
      'remainingAmount',
      'estimatedCost',
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
function formatMoneyDate(value: string, language: Language) {
  const date = new Date(`${value}T00:00:00Z`);
  return new Intl.DateTimeFormat(language === 'ru' ? 'ru-RU' : 'en-US', {
    day: 'numeric',
    month: 'short',
    year: 'numeric',
    timeZone: 'UTC',
  }).format(date);
}
function dateTimeKey(date: Date) {
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, '0');
  const day = String(date.getDate()).padStart(2, '0');
  const hours = String(date.getHours()).padStart(2, '0');
  const minutes = String(date.getMinutes()).padStart(2, '0');
  return `${year}-${month}-${day}T${hours}:${minutes}`;
}
function formatDateTime(value: string, language: Language) {
  return new Intl.DateTimeFormat(language === 'ru' ? 'ru-RU' : 'en-US', {
    day: 'numeric',
    month: 'short',
    hour: '2-digit',
    minute: '2-digit',
  }).format(new Date(value));
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
