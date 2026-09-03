'use client';

import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import type { AuthUser } from '@/db/auth';
import {
  deriveDueNotifications,
  notificationCategoryEnabled,
} from '@/lib/notifications';
import type { Language } from '../i18n';
import type { Data, Post, T } from '../features/types';
import { requestApiJson } from './api';
import { mutationKey } from './mutations';

export type AppNotice = {
  kind: 'progress' | 'success' | 'error';
  message: string;
};

type LiveUpdateResponse = {
  cursor: number;
  scopes: string[];
};

type LiveChatSnapshot = {
  messages: Data['messages'];
  hasMore: boolean;
  messageCount: number;
  unreadMessages: number;
};

type ExpensePage = {
  expenses: Data['expenses'];
  expenseCount: number;
  expenseTotal: number;
  hasMore: boolean;
};

const householdSectionScopes = new Set([
  'account',
  'food',
  'habits',
  'home',
  'medications',
  'members',
  'notifications',
  'nutrition',
  'organisers',
  'spending',
  'tasks',
  'wishlist',
  'water',
]);

function emptyHousehold(user: AuthUser): Data {
  return {
    currentUser: user,
    members: [user],
    home: { name: 'Our home', address: '', photo: null },
    nutrition: [],
    nutritionHistory: [],
    tasks: [],
    expenses: [],
    expenseCount: 0,
    expenseTotal: 0,
    expensesHasMore: false,
    recurringPayments: [],
    spendingBudgets: [],
    organisers: [],
    reminders: [],
    medications: [],
    medicationDoses: [],
    purchaseIdeas: [],
    purchaseVotes: [],
    messages: [],
    messageCount: 0,
    messagesHasMore: false,
    unreadMessages: 0,
    notificationPreferences: {
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
    notificationStates: [],
    habits: [],
    water: [],
    foods: [],
    recipes: [],
    weeklyPlan: [],
    aiConfigured: false,
    aiConsentingMembers: 0,
  };
}

export function useHouseholdController({
  initialUser,
  language,
  t,
}: {
  initialUser: AuthUser;
  language: Language;
  t: T;
}) {
  const [data, setData] = useState<Data>(() => emptyHousehold(initialUser));
  const [loading, setLoading] = useState(true);
  const [notice, setNotice] = useState<AppNotice | null>(null);
  const [connectionState, setConnectionState] = useState<
    'connected' | 'reconnecting'
  >('connected');
  const [notificationPermission, setNotificationPermission] = useState<
    NotificationPermission | 'desktop' | 'in-app'
  >('in-app');
  const [notificationOpenTarget, setNotificationOpenTarget] = useState('');
  const [notificationClock, setNotificationClock] = useState(() => Date.now());
  const [chatRevision, setChatRevision] = useState(0);
  const [expenseHistoryLoading, setExpenseHistoryLoading] = useState(false);
  const loadInProgress = useRef(false);
  const dataGeneration = useRef(0);
  const pendingMutations = useRef(new Set<string>());
  const noticeTimer = useRef<number | null>(null);
  const claimSignature = useRef('');

  const load = useCallback(
    async (silent = false) => {
      if (loadInProgress.current || pendingMutations.current.size) return false;
      loadInProgress.current = true;
      const generation = dataGeneration.current;
      try {
        const nextData = await requestApiJson<Data>(
          '/api/schwank',
          { cache: 'no-store' },
          t,
          'storageFailed',
        );
        if (generation === dataGeneration.current) {
          setData(nextData);
          setConnectionState('connected');
        }
        return true;
      } catch (cause) {
        setConnectionState('reconnecting');
        if (!silent)
          setNotice({
            kind: 'error',
            message:
              cause instanceof Error ? cause.message : t('storageFailed'),
          });
        return false;
      } finally {
        setLoading(false);
        loadInProgress.current = false;
      }
    },
    [t],
  );

  const loadChat = useCallback(async () => {
    try {
      const snapshot = await requestApiJson<LiveChatSnapshot>(
        '/api/chat',
        { cache: 'no-store' },
        t,
        'storageFailed',
      );
      setData((current) => ({
        ...current,
        messages: snapshot.messages,
        messageCount: snapshot.messageCount,
        messagesHasMore: snapshot.hasMore,
        unreadMessages: snapshot.unreadMessages,
      }));
      setChatRevision((revision) => revision + 1);
      setConnectionState('connected');
      return true;
    } catch {
      setConnectionState('reconnecting');
      return false;
    }
  }, [t]);

  const loadSections = useCallback(
    async (scopes: string[]) => {
      if (scopes.includes('all')) return load(true);
      const sections = Array.from(
        new Set(scopes.filter((scope) => householdSectionScopes.has(scope))),
      );
      if (!sections.length) return true;
      const generation = dataGeneration.current;
      try {
        const partial = await requestApiJson<Partial<Data>>(
          `/api/data?sections=${encodeURIComponent(sections.join(','))}`,
          { cache: 'no-store' },
          t,
          'storageFailed',
        );
        if (generation === dataGeneration.current)
          setData((current) => ({ ...current, ...partial }));
        setConnectionState('connected');
        return true;
      } catch {
        setConnectionState('reconnecting');
        return false;
      }
    },
    [load, t],
  );

  const refreshScopes = useCallback(
    async (scopes: string[]) => {
      if (scopes.includes('all')) return load(true);
      const [sectionsRefreshed, chatRefreshed] = await Promise.all([
        loadSections(scopes),
        scopes.includes('chat') ? loadChat() : Promise.resolve(true),
      ]);
      return sectionsRefreshed && chatRefreshed;
    },
    [load, loadChat, loadSections],
  );

  const loadOlderExpenses = useCallback(async () => {
    if (expenseHistoryLoading || !data.expensesHasMore) return false;
    const oldest = data.expenses.at(-1);
    if (!oldest) return false;
    setExpenseHistoryLoading(true);
    try {
      const page = await requestApiJson<ExpensePage>(
        `/api/spending?beforeDate=${encodeURIComponent(oldest.spentOn)}&beforeId=${oldest.id}`,
        { cache: 'no-store' },
        t,
        'storageFailed',
      );
      setData((current) => {
        const known = new Set(current.expenses.map((expense) => expense.id));
        return {
          ...current,
          expenses: [
            ...current.expenses,
            ...page.expenses.filter((expense) => !known.has(expense.id)),
          ],
          expenseCount: page.expenseCount,
          expenseTotal: page.expenseTotal,
          expensesHasMore: page.hasMore,
        };
      });
      return true;
    } catch (cause) {
      setNotice({
        kind: 'error',
        message: cause instanceof Error ? cause.message : t('storageFailed'),
      });
      return false;
    } finally {
      setExpenseHistoryLoading(false);
    }
  }, [data.expenses, data.expensesHasMore, expenseHistoryLoading, t]);

  useEffect(() => {
    queueMicrotask(() => {
      if (window.schwankDesktop) setNotificationPermission('desktop');
      else if ('Notification' in window && window.isSecureContext)
        setNotificationPermission(Notification.permission);
    });
    let stopped = false;
    let timer = 0;
    let polling = false;
    let cursor: number | null = null;
    let initialized = false;
    let forceFullRefresh = false;
    let retryDelay = 2_000;

    const regularDelay = () =>
      window.schwankDesktop || document.visibilityState === 'visible'
        ? 5_000
        : 30_000;
    const schedule = (delay: number) => {
      window.clearTimeout(timer);
      if (!stopped) timer = window.setTimeout(() => void poll(), delay);
    };
    const poll = async () => {
      if (stopped || polling) return;
      if (pendingMutations.current.size) {
        schedule(1_000);
        return;
      }
      polling = true;
      try {
        if (cursor === null) {
          try {
            const baseline = await requestApiJson<LiveUpdateResponse>(
              '/api/updates',
              { cache: 'no-store' },
              t,
              'storageFailed',
            );
            cursor = baseline.cursor;
          } catch {
            cursor = 0;
          }
        }
        if (!initialized || forceFullRefresh) {
          const refreshed = await load(initialized);
          if (!refreshed) throw new Error('refresh_failed');
          initialized = true;
          forceFullRefresh = false;
        }
        const updates = await requestApiJson<LiveUpdateResponse>(
          `/api/updates?after=${cursor}`,
          { cache: 'no-store' },
          t,
          'storageFailed',
        );
        if (updates.scopes.length) {
          const refreshed = await refreshScopes(updates.scopes);
          if (!refreshed) throw new Error('refresh_failed');
        }
        cursor = updates.cursor;
        retryDelay = 2_000;
        setConnectionState('connected');
        schedule(regularDelay());
      } catch {
        setConnectionState('reconnecting');
        schedule(retryDelay);
        retryDelay = Math.min(30_000, retryDelay * 2);
      } finally {
        polling = false;
      }
    };
    const catchUp = () => {
      forceFullRefresh = true;
      retryDelay = 2_000;
      schedule(0);
    };
    queueMicrotask(() => void poll());
    const refreshVisible = () => {
      if (document.visibilityState === 'visible') catchUp();
    };
    const refreshOnline = () => catchUp();
    document.addEventListener('visibilitychange', refreshVisible);
    window.addEventListener('online', refreshOnline);
    return () => {
      stopped = true;
      window.clearTimeout(timer);
      document.removeEventListener('visibilitychange', refreshVisible);
      window.removeEventListener('online', refreshOnline);
    };
  }, [initialUser.id, load, refreshScopes, t]);

  useEffect(() => {
    const interval = window.setInterval(
      () => setNotificationClock(Date.now()),
      30_000,
    );
    return () => window.clearInterval(interval);
  }, []);

  useEffect(
    () => () => {
      if (noticeTimer.current !== null)
        window.clearTimeout(noticeTimer.current);
    },
    [],
  );

  const notifications = useMemo(() => {
    const states = new Map(
      data.notificationStates.map((state) => [state.eventKey, state]),
    );
    const now = new Date(notificationClock);
    return deriveDueNotifications(data, t, language, now, {
      advanceMinutes: Number(data.notificationPreferences.advanceMinutes),
    }).filter((notification) => {
      if (
        !notificationCategoryEnabled(
          notification.category,
          data.notificationPreferences,
        )
      )
        return false;
      const snoozedUntil = states.get(notification.key)?.snoozedUntil;
      return !snoozedUntil || new Date(snoozedUntil) <= now;
    });
  }, [data, language, notificationClock, t]);

  useEffect(() => {
    if (window.schwankDesktop)
      void window.schwankDesktop.setBadge(notifications.length);
  }, [notifications.length]);

  useEffect(() => {
    const nativeAvailable =
      notificationPermission === 'desktop' ||
      notificationPermission === 'granted';
    if (!nativeAvailable) return;
    const delivered = new Set(
      data.notificationStates
        .filter((state) => state.deliveredAt)
        .map((state) => state.eventKey),
    );
    const candidates = notifications.filter(
      (notification) => !delivered.has(notification.key),
    );
    const signature = candidates
      .map((notification) => notification.key)
      .join('|');
    if (!signature || claimSignature.current === signature) return;
    claimSignature.current = signature;
    void requestApiJson<{ claimed: string[] }>(
      '/api/notifications',
      {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify({
          events: candidates.map(({ key, category }) => ({ key, category })),
        }),
      },
      t,
      'saveFailed',
    )
      .then(({ claimed }) => {
        if (!claimed.length) {
          claimSignature.current = '';
          return;
        }
        const claimedSet = new Set(claimed);
        const deliveredAt = new Date().toISOString();
        setData((current) => ({
          ...current,
          notificationStates: [
            ...current.notificationStates.filter(
              (state) => !claimedSet.has(state.eventKey),
            ),
            ...claimed.map((eventKey) => ({
              eventKey,
              deliveredAt,
              snoozedUntil: null,
            })),
          ],
        }));
        for (const notification of candidates) {
          if (!claimedSet.has(notification.key)) continue;
          const nativeTitle =
            notification.visibility === 'private'
              ? 'schwank'
              : notification.title;
          const nativeBody =
            notification.visibility === 'private'
              ? t('privateNotificationBody')
              : notification.body;
          if (window.schwankDesktop)
            void window.schwankDesktop.notify(
              nativeTitle,
              nativeBody,
              notification.target,
            );
          else if (
            'Notification' in window &&
            window.isSecureContext &&
            Notification.permission === 'granted'
          ) {
            const nativeNotification = new Notification(nativeTitle, {
              body: nativeBody,
            });
            nativeNotification.onclick = () => {
              window.focus();
              setNotificationOpenTarget(notification.target);
              nativeNotification.close();
            };
          }
        }
      })
      .catch(() => {
        claimSignature.current = '';
      });
  }, [data.notificationStates, notificationPermission, notifications, t]);

  useEffect(() => {
    return window.schwankDesktop?.onNotificationClick?.((target) =>
      setNotificationOpenTarget(target),
    );
  }, []);

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

  const post: Post = async (payload, options) => {
    const key = mutationKey(payload);
    if (pendingMutations.current.has(key)) return false;
    pendingMutations.current.add(key);
    dataGeneration.current += 1;
    if (noticeTimer.current !== null) window.clearTimeout(noticeTimer.current);
    if (!options?.quiet) setNotice({ kind: 'progress', message: t('saving') });
    try {
      const response = await requestApiJson<{ ok: true; data: Data }>(
        '/api/schwank',
        {
          method: 'POST',
          headers: { 'content-type': 'application/json' },
          body: JSON.stringify(payload),
        },
        t,
        'saveFailed',
      );
      setData(response.data);
      setConnectionState('connected');
      if (!options?.quiet) {
        setNotice({
          kind: 'success',
          message:
            payload.visibility === 'private' ? t('savedPrivately') : t('saved'),
        });
        noticeTimer.current = window.setTimeout(() => setNotice(null), 2200);
      }
      return true;
    } catch (cause) {
      if (!options?.quiet)
        setNotice({
          kind: 'error',
          message: cause instanceof Error ? cause.message : t('saveFailed'),
        });
      return false;
    } finally {
      pendingMutations.current.delete(key);
    }
  };

  async function logout() {
    await fetch('/api/auth/logout', { method: 'POST' });
    window.location.assign('/login');
  }

  const clearNotificationOpenTarget = useCallback(
    () => setNotificationOpenTarget(''),
    [],
  );

  return {
    data,
    connectionState,
    chatRevision,
    enableNotifications,
    expenseHistoryLoading,
    loading,
    loadOlderExpenses,
    logout,
    notificationPermission,
    notifications,
    notificationOpenTarget,
    notice,
    post,
    clearNotificationOpenTarget,
  };
}
