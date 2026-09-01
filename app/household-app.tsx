'use client';

import { useState } from 'react';
import {
  ArrowRight,
  Bell,
  BellRing,
  Cigarette,
  ClipboardCheck,
  Clock3,
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
import { Avatar, Empty, LanguageSwitch } from './components/app-ui';
import { useHouseholdController } from './client/use-household-controller';
import { ChatView } from './features/chat/chat-view';
import { Overview } from './features/dashboard/overview';
import { FoodStorageView } from './features/food/food-storage-view';
import { HabitsView } from './features/habits/habits-view';
import { HomeView } from './features/home/home-view';
import { MedicationsView } from './features/medications/medications-view';
import { OrganisersView } from './features/organisers/organisers-view';
import {
  NutritionView,
  sumNutrition,
} from './features/nutrition/nutrition-view';
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

export default function HouseholdApp({
  initialUser,
}: {
  initialUser: AuthUser;
}) {
  const { language, setLanguage, t } = useLanguage();
  const [active, setActive] = useState('overview');
  const [notificationsOpen, setNotificationsOpen] = useState(false);
  const {
    data,
    enableNotifications,
    loading,
    logout,
    notificationPermission,
    notifications,
    notice,
    post,
  } = useHouseholdController({ initialUser, language, t });
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
