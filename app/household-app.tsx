'use client';

import Image from 'next/image';
import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import {
  Archive,
  ArrowRight,
  Bell,
  BellRing,
  CalendarClock,
  CalendarDays,
  Check,
  CheckCircle2,
  Cigarette,
  CircleDollarSign,
  CreditCard,
  ClipboardCheck,
  Clock3,
  Droplets,
  Flame,
  Gift,
  Home,
  Info,
  ListTodo,
  LoaderCircle,
  Lock,
  LogOut,
  MessageCircle,
  PackageOpen,
  PackageCheck,
  Pause,
  Pill,
  Play,
  Plus,
  RotateCcw,
  Send,
  Settings,
  ShoppingBasket,
  Sparkles,
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
import { Field } from './components/app-field';
import {
  Avatar,
  Empty,
  LanguageSwitch,
  PageTitle,
  PrivacyBadge,
  PrivacySelect,
} from './components/app-ui';
import { requestApiJson } from './client/api';
import { dateKey } from './client/dates';
import { submitForm } from './client/forms';
import { FoodStorageView } from './features/food/food-storage-view';
import { HomeView } from './features/home/home-view';
import {
  Macro,
  NutritionView,
  sumNutrition,
  type NutritionTotals,
} from './features/nutrition/nutrition-view';

import type {
  Data,
  HabitEntry,
  HabitKind,
  Post,
  PurchaseIdea,
  PurchaseVote,
  T,
} from './features/types';

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
        const nextData = await requestApiJson<Data>(
          '/api/schwank',
          { cache: 'no-store' },
          t,
          'storageFailed',
        );
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
      } catch (cause) {
        if (!silent)
          setNotice(
            cause instanceof Error ? cause.message : t('storageFailed'),
          );
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
    try {
      await requestApiJson(
        '/api/schwank',
        {
          method: 'POST',
          headers: { 'content-type': 'application/json' },
          body: JSON.stringify(payload),
        },
        t,
        'saveFailed',
      );
      await load();
      setNotice(
        payload.visibility === 'private' ? t('savedPrivately') : t('saved'),
      );
      setTimeout(() => setNotice(''), 1600);
      return true;
    } catch (cause) {
      setNotice(cause instanceof Error ? cause.message : t('saveFailed'));
      return false;
    }
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
