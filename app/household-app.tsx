'use client';

import { useCallback, useEffect, useRef, useState } from 'react';
import {
  Bell,
  BellRing,
  Cigarette,
  ClipboardCheck,
  Droplets,
  Gift,
  Home,
  ListTodo,
  LoaderCircle,
  Lock,
  LogOut,
  MessageCircle,
  PackageOpen,
  Pill,
  Plus,
  Settings,
  Sparkles,
  Utensils,
  WalletCards,
} from 'lucide-react';
import type { AuthUser } from '@/db/auth';
import { useLanguage } from './i18n';
import { Avatar, LanguageSwitch } from './components/app-ui';
import { useHouseholdController } from './client/use-household-controller';
import { usePersistedSection } from './client/use-persisted-section';
import { ChatView } from './features/chat/chat-view';
import { Overview } from './features/dashboard/overview';
import { FoodStorageView } from './features/food/food-storage-view';
import { HabitsView } from './features/habits/habits-view';
import { HomeView } from './features/home/home-view';
import { MedicationsView } from './features/medications/medications-view';
import { OrganisersView } from './features/organisers/organisers-view';
import { sumNutrition } from './features/nutrition/nutrition-calculations';
import { NutritionView } from './features/nutrition/nutrition-view';
import { NotificationPopover } from './features/notifications/notification-popover';
import { SpendingView } from './features/spending/spending-view';
import { TasksView } from './features/tasks/tasks-view';
import { WaterView } from './features/water/water-view';
import { WishlistView } from './features/wishlist/wishlist-view';

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
const sectionIds = navigation.map((item) => item.id);

function sectionForTarget(target: string) {
  if (target.startsWith('medication:')) return 'medications';
  if (target.startsWith('payment:')) return 'spending';
  if (target.startsWith('task:')) return 'tasks';
  if (target.startsWith('reminder:')) return 'organisers';
  if (target.startsWith('chat:')) return 'chat';
  return null;
}

export default function HouseholdApp({
  initialUser,
}: {
  initialUser: AuthUser;
}) {
  const { language, setLanguage, t } = useLanguage();
  const [active, setActive] = usePersistedSection(
    initialUser.id,
    sectionIds,
    'overview',
  );
  const [notificationsOpen, setNotificationsOpen] = useState(false);
  const contentRef = useRef<HTMLDivElement>(null);
  const previousSection = useRef(active);
  const notificationTrigger = useRef<HTMLButtonElement>(null);
  const {
    data,
    chatRevision,
    connectionState,
    enableNotifications,
    expenseHistoryLoading,
    loading,
    loadOlderExpenses,
    loadOlderNutritionHistory,
    loadOlderWaterHistory,
    logout,
    notificationPermission,
    notifications,
    notificationOpenTarget,
    notice,
    nutritionHistoryLoading,
    post,
    waterHistoryLoading,
    clearNotificationOpenTarget,
  } = useHouseholdController({ initialUser, language, t });
  const user = data.currentUser;
  const ownNutrition = data.nutrition.filter((item) => item.owned);
  const totals = sumNutrition(ownNutrition);
  const totalSpend = data.expenseTotal;
  const completed = data.tasks.filter((item) => item.status === 'done').length;
  const taskPercent = data.tasks.length
    ? Math.round((completed / data.tasks.length) * 100)
    : 0;
  const common = { data, t, language, post };

  const [pendingNotificationTarget, setPendingNotificationTarget] =
    useState('');

  const openNotificationTarget = useCallback(
    (target: string, section?: string) => {
      const destination = section || sectionForTarget(target);
      if (!destination) return;
      setActive(destination);
      setPendingNotificationTarget(target);
      setNotificationsOpen(false);
    },
    [setActive],
  );

  useEffect(() => {
    const query = window.location.hash.split('?')[1];
    const target = new URLSearchParams(query || '').get('target');
    if (target) queueMicrotask(() => setPendingNotificationTarget(target));
  }, []);

  useEffect(() => {
    if (!notificationOpenTarget) return;
    queueMicrotask(() => {
      openNotificationTarget(notificationOpenTarget);
      clearNotificationOpenTarget();
    });
  }, [
    clearNotificationOpenTarget,
    notificationOpenTarget,
    openNotificationTarget,
  ]);

  useEffect(() => {
    if (!pendingNotificationTarget || loading) return;
    const expectedSection = sectionForTarget(pendingNotificationTarget);
    if (!expectedSection || expectedSection !== active) return;
    let secondFrame = 0;
    let timer = 0;
    const firstFrame = requestAnimationFrame(() => {
      secondFrame = requestAnimationFrame(() => {
        const escaped = CSS.escape(pendingNotificationTarget);
        const target = contentRef.current?.querySelector<HTMLElement>(
          `[data-notification-target="${escaped}"]`,
        );
        if (!target) {
          setPendingNotificationTarget('');
          return;
        }
        target.tabIndex = -1;
        target.focus({ preventScroll: true });
        target.scrollIntoView({ behavior: 'smooth', block: 'center' });
        target.classList.add('notification-target-flash');
        const url = new URL(window.location.href);
        url.hash = `${active}?target=${encodeURIComponent(pendingNotificationTarget)}`;
        window.history.replaceState(null, '', url);
        timer = window.setTimeout(() => {
          target.classList.remove('notification-target-flash');
          setPendingNotificationTarget('');
        }, 2400);
      });
    });
    return () => {
      cancelAnimationFrame(firstFrame);
      cancelAnimationFrame(secondFrame);
      window.clearTimeout(timer);
    };
  }, [active, loading, pendingNotificationTarget]);

  useEffect(() => {
    if (previousSection.current === active) return;
    previousSection.current = active;
    const frame = requestAnimationFrame(() =>
      contentRef.current?.querySelector<HTMLElement>('h1')?.focus(),
    );
    return () => cancelAnimationFrame(frame);
  }, [active]);
  useEffect(() => {
    if (!notificationsOpen) return;
    const closeOnEscape = (event: KeyboardEvent) => {
      if (event.key !== 'Escape') return;
      setNotificationsOpen(false);
      notificationTrigger.current?.focus();
    };
    document.addEventListener('keydown', closeOnEscape);
    return () => document.removeEventListener('keydown', closeOnEscape);
  }, [notificationsOpen]);
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
      <NutritionView
        {...common}
        user={user}
        totals={totals}
        nutritionHistoryLoading={nutritionHistoryLoading}
        loadOlderNutritionHistory={loadOlderNutritionHistory}
      />
    ) : active === 'food' ? (
      <FoodStorageView {...common} />
    ) : active === 'medications' ? (
      <MedicationsView {...common} />
    ) : active === 'water' ? (
      <WaterView
        {...common}
        user={user}
        waterHistoryLoading={waterHistoryLoading}
        loadOlderWaterHistory={loadOlderWaterHistory}
      />
    ) : active === 'habits' ? (
      <HabitsView {...common} />
    ) : active === 'tasks' ? (
      <TasksView {...common} />
    ) : active === 'wishlist' ? (
      <WishlistView {...common} />
    ) : active === 'spending' ? (
      <SpendingView
        {...common}
        expenseHistoryLoading={expenseHistoryLoading}
        loadOlderExpenses={loadOlderExpenses}
      />
    ) : active === 'organisers' ? (
      <OrganisersView {...common} setActive={setActive} />
    ) : active === 'chat' ? (
      <ChatView
        {...common}
        user={user}
        connectionState={connectionState}
        chatRevision={chatRevision}
      />
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
        <nav className="side-nav" aria-label={t('mainNavigation')}>
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
                    ? Math.min(data.unreadMessages, 9)
                    : 0;
            return (
              <button
                type="button"
                onClick={() => setActive(item.id)}
                className={active === item.id ? 'nav-item active' : 'nav-item'}
                aria-label={t(item.key)}
                aria-current={active === item.id ? 'page' : undefined}
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
                ref={notificationTrigger}
                className="icon-button notification-button"
                aria-label={t('notifications')}
                aria-expanded={notificationsOpen}
                aria-controls="notification-panel"
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
                <NotificationPopover
                  data={data}
                  enableNotifications={enableNotifications}
                  notificationPermission={notificationPermission}
                  notifications={notifications}
                  onOpen={(notification) =>
                    openNotificationTarget(
                      notification.target,
                      notification.section,
                    )
                  }
                  post={post}
                  t={t}
                />
              )}
            </div>
            <button
              className="icon-button"
              aria-label={t('addTask')}
              onClick={() => setActive('tasks')}
            >
              <Plus size={19} />
            </button>
            <button
              className="person-picker"
              aria-label={t('homeSettings')}
              onClick={() => setActive('home')}
            >
              <Avatar person={user} small />
              <span>{user.name}</span>
            </button>
          </div>
        </header>
        {notice && (
          <output
            className={`toast ${notice.kind}`}
            role={notice.kind === 'error' ? 'alert' : 'status'}
            aria-live={notice.kind === 'error' ? 'assertive' : 'polite'}
            aria-atomic="true"
          >
            {notice.message}
          </output>
        )}
        <div className="content" ref={contentRef}>
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
