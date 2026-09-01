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

function emptyHousehold(user: AuthUser): Data {
  return {
    currentUser: user,
    members: [user],
    home: { name: 'Our home', address: '', photo: null },
    nutrition: [],
    nutritionHistory: [],
    tasks: [],
    expenses: [],
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
  const loadInProgress = useRef(false);
  const dataGeneration = useRef(0);
  const pendingMutations = useRef(new Set<string>());
  const noticeTimer = useRef<number | null>(null);
  const claimSignature = useRef('');

  const load = useCallback(
    async (silent = false) => {
      if (loadInProgress.current || pendingMutations.current.size) return;
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
      } catch (cause) {
        setConnectionState('reconnecting');
        if (!silent)
          setNotice({
            kind: 'error',
            message:
              cause instanceof Error ? cause.message : t('storageFailed'),
          });
      } finally {
        setLoading(false);
        loadInProgress.current = false;
      }
    },
    [t],
  );

  useEffect(() => {
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
    const refreshOnline = () => void load(true);
    document.addEventListener('visibilitychange', refreshVisible);
    window.addEventListener('online', refreshOnline);
    return () => {
      window.clearInterval(interval);
      document.removeEventListener('visibilitychange', refreshVisible);
      window.removeEventListener('online', refreshOnline);
    };
  }, [initialUser.id, load]);

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
    const now = new Date();
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
  }, [data, language, t]);

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
    enableNotifications,
    loading,
    logout,
    notificationPermission,
    notifications,
    notificationOpenTarget,
    notice,
    post,
    clearNotificationOpenTarget,
  };
}
