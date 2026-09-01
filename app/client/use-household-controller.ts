'use client';

import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import type { AuthUser } from '@/db/auth';
import { deriveDueNotifications } from '@/lib/notifications';
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
  const [notificationPermission, setNotificationPermission] = useState<
    NotificationPermission | 'desktop' | 'in-app'
  >('in-app');
  const lastMessageId = useRef<number | null>(null);
  const loadInProgress = useRef(false);
  const dataGeneration = useRef(0);
  const pendingMutations = useRef(new Set<string>());
  const noticeTimer = useRef<number | null>(null);
  const deliveredNotificationKeys = useRef(new Set<string>());

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
        if (generation === dataGeneration.current) {
          lastMessageId.current = newestMessageId;
          setData(nextData);
        }
      } catch (cause) {
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

  useEffect(
    () => () => {
      if (noticeTimer.current !== null)
        window.clearTimeout(noticeTimer.current);
    },
    [],
  );

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
    const key = mutationKey(payload);
    if (pendingMutations.current.has(key)) return false;
    pendingMutations.current.add(key);
    dataGeneration.current += 1;
    if (noticeTimer.current !== null) window.clearTimeout(noticeTimer.current);
    setNotice({ kind: 'progress', message: t('saving') });
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
      setNotice({
        kind: 'success',
        message:
          payload.visibility === 'private' ? t('savedPrivately') : t('saved'),
      });
      noticeTimer.current = window.setTimeout(() => setNotice(null), 2200);
      return true;
    } catch (cause) {
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

  return {
    data,
    enableNotifications,
    loading,
    logout,
    notificationPermission,
    notifications,
    notice,
    post,
  };
}
