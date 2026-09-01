'use client';

import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import type { AuthUser } from '@/db/auth';
import { deriveDueNotifications } from '@/lib/notifications';
import type { Language } from '../i18n';
import type { Data, Post, T } from '../features/types';
import { requestApiJson } from './api';

function emptyHousehold(user: AuthUser): Data {
  return {
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
  const [notice, setNotice] = useState('');
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
      window.setTimeout(() => setNotice(''), 1600);
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
