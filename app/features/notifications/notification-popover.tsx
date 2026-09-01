'use client';

import { useState } from 'react';
import { ArrowRight, Clock3, Settings2 } from 'lucide-react';
import type { DueNotification } from '@/lib/notifications';
import { Empty } from '../../components/app-ui';
import type { Data, NotificationPreferences, Post, T } from '../types';

const advanceOptions = [0, 15, 60, 180, 1440, 4320, 10080] as const;

function editablePreferences(preferences: NotificationPreferences) {
  return {
    enabled: Boolean(preferences.enabled),
    medicationsEnabled: Boolean(preferences.medicationsEnabled),
    paymentsEnabled: Boolean(preferences.paymentsEnabled),
    tasksEnabled: Boolean(preferences.tasksEnabled),
    remindersEnabled: Boolean(preferences.remindersEnabled),
    chatEnabled: Boolean(preferences.chatEnabled),
    advanceMinutes: Number(preferences.advanceMinutes),
    quietHoursEnabled: Boolean(preferences.quietHoursEnabled),
    quietStart: preferences.quietStart,
    quietEnd: preferences.quietEnd,
    timezone: preferences.timezone,
  };
}

export function NotificationPopover({
  data,
  enableNotifications,
  notificationPermission,
  notifications,
  onOpen,
  post,
  t,
}: {
  data: Data;
  enableNotifications: () => Promise<void>;
  notificationPermission: NotificationPermission | 'desktop' | 'in-app';
  notifications: DueNotification[];
  onOpen: (notification: DueNotification) => void;
  post: Post;
  t: T;
}) {
  const [settingsOpen, setSettingsOpen] = useState(false);
  const [preferences, setPreferences] = useState(() =>
    editablePreferences(data.notificationPreferences),
  );

  function setPreference<Key extends keyof typeof preferences>(
    key: Key,
    value: (typeof preferences)[Key],
  ) {
    setPreferences((current) => ({ ...current, [key]: value }));
  }

  return (
    <section
      id="notification-panel"
      className="notification-popover"
      aria-label={t('notifications')}
    >
      <header>
        <div>
          <strong>{t('notifications')}</strong>
          <span>{t('dueNowCount', { count: notifications.length })}</span>
        </div>
        <span className="notification-header-actions">
          {notificationPermission === 'default' && (
            <button type="button" onClick={() => void enableNotifications()}>
              {t('enableNotifications')}
            </button>
          )}
          <button
            type="button"
            className={settingsOpen ? 'active' : ''}
            aria-label={t('notificationSettings')}
            aria-expanded={settingsOpen}
            onClick={() => setSettingsOpen((open) => !open)}
          >
            <Settings2 size={14} />
          </button>
        </span>
      </header>
      {settingsOpen && (
        <form
          className="notification-settings"
          onSubmit={async (event) => {
            event.preventDefault();
            const saved = await post({
              type: 'notification-preferences',
              ...preferences,
              timezone:
                Intl.DateTimeFormat().resolvedOptions().timeZone ||
                preferences.timezone,
            });
            if (saved) setSettingsOpen(false);
          }}
        >
          <div className="notification-master-toggle">
            <input
              id="notification-delivery"
              type="checkbox"
              checked={preferences.enabled}
              onChange={(event) =>
                setPreference('enabled', event.currentTarget.checked)
              }
            />
            <label htmlFor="notification-delivery">
              <strong>{t('notificationDelivery')}</strong>
              <small>{t('notificationDeliveryCopy')}</small>
            </label>
          </div>
          <fieldset disabled={!preferences.enabled}>
            <legend>{t('notificationCategories')}</legend>
            <div className="notification-category-grid">
              {(
                [
                  ['medicationsEnabled', 'medications'],
                  ['paymentsEnabled', 'scheduledPayments'],
                  ['tasksEnabled', 'tasks'],
                  ['remindersEnabled', 'reminders'],
                  ['chatEnabled', 'chat'],
                ] as const
              ).map(([key, label]) => (
                <label key={key}>
                  <input
                    type="checkbox"
                    checked={preferences[key]}
                    onChange={(event) =>
                      setPreference(key, event.currentTarget.checked)
                    }
                  />
                  {t(label)}
                </label>
              ))}
            </div>
            <label className="notification-select-row">
              <span>{t('notificationAdvance')}</span>
              <select
                value={preferences.advanceMinutes}
                onChange={(event) =>
                  setPreference('advanceMinutes', Number(event.target.value))
                }
              >
                {advanceOptions.map((minutes) => (
                  <option value={minutes} key={minutes}>
                    {t(
                      minutes === 0
                        ? 'advanceAtTime'
                        : minutes === 15
                          ? 'advance15'
                          : minutes === 60
                            ? 'advanceHour'
                            : minutes === 180
                              ? 'advanceThreeHours'
                              : minutes === 1440
                                ? 'advanceDay'
                                : minutes === 4320
                                  ? 'advanceThreeDays'
                                  : 'advanceWeek',
                    )}
                  </option>
                ))}
              </select>
            </label>
            <div className="notification-master-toggle compact">
              <input
                id="notification-quiet-hours"
                type="checkbox"
                checked={preferences.quietHoursEnabled}
                onChange={(event) =>
                  setPreference(
                    'quietHoursEnabled',
                    event.currentTarget.checked,
                  )
                }
              />
              <label htmlFor="notification-quiet-hours">
                <strong>{t('quietHours')}</strong>
                <small>{t('quietHoursCopy')}</small>
              </label>
            </div>
            {preferences.quietHoursEnabled && (
              <div className="notification-time-grid">
                <label>
                  <span>{t('quietStart')}</span>
                  <input
                    type="time"
                    value={preferences.quietStart}
                    onChange={(event) =>
                      setPreference('quietStart', event.target.value)
                    }
                  />
                </label>
                <label>
                  <span>{t('quietEnd')}</span>
                  <input
                    type="time"
                    value={preferences.quietEnd}
                    onChange={(event) =>
                      setPreference('quietEnd', event.target.value)
                    }
                  />
                </label>
              </div>
            )}
          </fieldset>
          <button className="primary-button compact-button">
            {t('saveNotificationSettings')}
          </button>
        </form>
      )}
      {!settingsOpen &&
        (notifications.length ? (
          notifications.map((notification) => (
            <div className="notification-item" key={notification.key}>
              <button type="button" onClick={() => onOpen(notification)}>
                <span>
                  <Clock3 size={15} />
                </span>
                <div>
                  <strong>{notification.title}</strong>
                  <small>{notification.body}</small>
                </div>
                <ArrowRight size={14} />
              </button>
              <select
                aria-label={t('snoozeNotification', {
                  notification: notification.title,
                })}
                defaultValue=""
                onChange={async (event) => {
                  const select = event.currentTarget;
                  const minutes = Number(select.value);
                  if (!minutes) return;
                  await post({
                    type: 'notification-snooze',
                    eventKey: notification.key,
                    minutes,
                  });
                  select.value = '';
                }}
              >
                <option value="" disabled>
                  {t('snooze')}
                </option>
                <option value="15">{t('snooze15')}</option>
                <option value="60">{t('snoozeHour')}</option>
                <option value="1440">{t('snoozeDay')}</option>
              </select>
            </div>
          ))
        ) : (
          <Empty>{t('noNotifications')}</Empty>
        ))}
      {notificationPermission === 'in-app' && (
        <p>{t('inAppNotificationsOnly')}</p>
      )}
    </section>
  );
}
