'use client';

import { snoozedReminderDate, type ReminderRecurrence } from '@/lib/reminders';
import {
  BellRing,
  Check,
  ClipboardCheck,
  Clock3,
  Edit3,
  ListTodo,
  Plus,
  Repeat2,
  Trash2,
} from 'lucide-react';
import { useState } from 'react';
import { dateTimeKey, formatDateTime } from '../../client/format';
import { submitForm } from '../../client/forms';
import { Field } from '../../components/app-field';
import {
  ConfirmAction,
  Empty,
  PageTitle,
  PrivacyBadge,
  PrivacySelect,
} from '../../components/app-ui';
import type { Language } from '../../i18n';
import type { Data, Organiser, Post, Reminder, T } from '../types';
import {
  reminderTiming,
  visibleReminders,
  type ReminderView,
} from './organiser-calculations';

export function OrganisersView({
  data,
  post,
  setActive,
  t,
  language,
}: {
  data: Data;
  post: Post;
  setActive: (section: string) => void;
  t: T;
  language: Language;
}) {
  const lists = Array.from(new Set(data.organisers.map((item) => item.list)));
  const [reminderDefault] = useState(() =>
    dateTimeKey(new Date(Date.now() + 60 * 60_000)),
  );
  const [reminderView, setReminderView] = useState<ReminderView>('active');
  const [editingReminderId, setEditingReminderId] = useState<number | null>(
    null,
  );
  const [editingItemId, setEditingItemId] = useState<number | null>(null);
  const reminders = visibleReminders(data.reminders, reminderView);
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
          className="quick-form privacy-form reminder-form"
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
          <RecurrenceField t={t} />
          <PrivacySelect t={t} />
          <button className="primary-button">
            <Plus size={16} />
            {t('addReminder')}
          </button>
        </form>
        <div className="reminder-toolbar">
          <div className="segmented-control" aria-label={t('reminderView')}>
            {(['active', 'completed', 'all'] as const).map((view) => (
              <button
                type="button"
                key={view}
                aria-pressed={reminderView === view}
                onClick={() => setReminderView(view)}
              >
                {t(
                  view === 'active'
                    ? 'activeReminders'
                    : view === 'completed'
                      ? 'completedReminders'
                      : 'allReminders',
                )}
              </button>
            ))}
          </div>
          <span>{t('remindersShown', { count: reminders.length })}</span>
        </div>
        <div className="reminder-list">
          {reminders.length ? (
            reminders.map((reminder) => (
              <ReminderRow
                key={reminder.id}
                reminder={reminder}
                editing={editingReminderId === reminder.id}
                setEditing={(editing) =>
                  setEditingReminderId(editing ? reminder.id : null)
                }
                post={post}
                setActive={setActive}
                t={t}
                language={language}
              />
            ))
          ) : (
            <Empty>
              {reminderView === 'completed'
                ? t('noCompletedReminders')
                : t('noReminders')}
            </Empty>
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
          {lists.map((list) => {
            const items = data.organisers.filter((item) => item.list === list);
            return (
              <article className="panel organiser-card" key={list}>
                <div className="panel-heading">
                  <div>
                    <h2>{list}</h2>
                    <span>
                      {t('remaining', {
                        count: items.filter((item) => !item.done).length,
                      })}
                    </span>
                  </div>
                  <span className="tinted-icon peach">
                    <ClipboardCheck size={18} />
                  </span>
                </div>
                <div className="check-list">
                  {items.map((item) => (
                    <OrganiserItemRow
                      key={item.id}
                      item={item}
                      editing={editingItemId === item.id}
                      setEditing={(editing) =>
                        setEditingItemId(editing ? item.id : null)
                      }
                      post={post}
                      t={t}
                    />
                  ))}
                </div>
                <form
                  className="inline-add organiser-add"
                  onSubmit={(event) =>
                    submitForm(event, post, 'organiser', { list })
                  }
                >
                  <input name="label" placeholder={t('addAnItem')} required />
                  <select
                    name="visibility"
                    defaultValue="private"
                    aria-label={t('privacy')}
                  >
                    <option value="private">{t('private')}</option>
                    <option value="shared">{t('shared')}</option>
                  </select>
                  <button aria-label={t('addItem')}>
                    <Plus size={16} />
                  </button>
                </form>
              </article>
            );
          })}
        </div>
      ) : (
        <article className="panel">
          <Empty>{t('noLists')}</Empty>
        </article>
      )}
    </>
  );
}

function RecurrenceField({
  t,
  defaultValue = 'none',
}: {
  t: T;
  defaultValue?: ReminderRecurrence;
}) {
  return (
    <label className="form-field">
      <span>{t('recurrence')}</span>
      <select name="recurrence" defaultValue={defaultValue}>
        <option value="none">{t('oneTime')}</option>
        <option value="daily">{t('daily')}</option>
        <option value="weekly">{t('weekly')}</option>
        <option value="monthly">{t('monthly')}</option>
      </select>
    </label>
  );
}

function ReminderRow({
  reminder,
  editing,
  setEditing,
  post,
  setActive,
  t,
  language,
}: {
  reminder: Reminder;
  editing: boolean;
  setEditing: (editing: boolean) => void;
  post: Post;
  setActive: (section: string) => void;
  t: T;
  language: Language;
}) {
  const timing = reminderTiming(reminder);
  const recurrenceKey =
    reminder.recurrence === 'none' ? 'oneTime' : reminder.recurrence;
  return (
    <article className={`reminder-row ${timing}`}>
      <div className="reminder-main">
        {reminder.owned ? (
          <button
            type="button"
            className="reminder-toggle"
            aria-label={t(
              reminder.recurrence === 'none'
                ? reminder.done
                  ? 'reopenReminder'
                  : 'completeReminder'
                : 'completeRecurringReminder',
              { reminder: reminder.label },
            )}
            onClick={() =>
              void post({
                type: 'reminder-toggle',
                id: reminder.id,
                done: !reminder.done,
              })
            }
          >
            <i>{Boolean(reminder.done) && <Check size={12} />}</i>
            <span>
              <strong>{reminder.label}</strong>
              <small>{formatDateTime(reminder.remindAt, language)}</small>
            </span>
          </button>
        ) : (
          <span className="readonly-item">
            <Clock3 size={14} />
            <span>
              <strong>{reminder.label}</strong>
              <small>{formatDateTime(reminder.remindAt, language)}</small>
            </span>
          </span>
        )}
        <div className="reminder-badges">
          <span className={`reminder-state ${timing}`}>
            {t(
              timing === 'due'
                ? 'dueNow'
                : timing === 'completed'
                  ? 'completed'
                  : 'upcoming',
            )}
          </span>
          <span className="reminder-recurrence">
            {reminder.recurrence !== 'none' && <Repeat2 size={11} />}
            {t(recurrenceKey)}
          </span>
          <PrivacyBadge visibility={reminder.visibility} t={t} />
        </div>
        {reminder.owned && (
          <div className="reminder-actions">
            {!reminder.done && (
              <select
                aria-label={t('snoozeReminder', { reminder: reminder.label })}
                defaultValue=""
                onChange={async (event) => {
                  const select = event.currentTarget;
                  const minutes = Number(select.value);
                  if (!minutes) return;
                  await post({
                    type: 'reminder-snooze',
                    id: reminder.id,
                    minutes,
                    snoozeUntil: snoozedReminderDate(minutes as 15 | 60 | 1440),
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
            )}
            {!reminder.done &&
              reminder.recurrence === 'none' &&
              !reminder.convertedTaskId && (
                <button
                  type="button"
                  className="icon-button"
                  aria-label={t('convertReminderToTask', {
                    reminder: reminder.label,
                  })}
                  onClick={() =>
                    void post({ type: 'reminder-to-task', id: reminder.id })
                  }
                >
                  <ListTodo size={14} />
                </button>
              )}
            {reminder.convertedTaskId && (
              <button
                type="button"
                className="task-created-button"
                onClick={() => setActive('tasks')}
              >
                <ListTodo size={13} /> {t('taskCreated')}
              </button>
            )}
            <button
              type="button"
              className="icon-button"
              aria-label={t('editReminder', { reminder: reminder.label })}
              onClick={() => setEditing(!editing)}
            >
              <Edit3 size={13} />
            </button>
            <ConfirmAction
              className="icon-button danger"
              label={t('deleteReminder', { reminder: reminder.label })}
              title={t('deleteReminderTitle')}
              description={t('deleteReminderWarning', {
                reminder: reminder.label,
              })}
              confirmLabel={t('delete')}
              cancelLabel={t('cancel')}
              onConfirm={() =>
                post({ type: 'reminder-remove', id: reminder.id })
              }
            >
              <Trash2 size={13} />
            </ConfirmAction>
          </div>
        )}
      </div>
      {editing && (
        <form
          className="reminder-edit-form"
          onSubmit={async (event) => {
            const saved = await submitForm(event, post, 'reminder-update', {
              id: String(reminder.id),
            });
            if (saved) setEditing(false);
          }}
        >
          <Field
            name="label"
            label={t('reminderName')}
            defaultValue={reminder.label}
          />
          <Field
            name="remindAt"
            label={t('remindAt')}
            type="datetime-local"
            defaultValue={reminder.remindAt}
          />
          <RecurrenceField t={t} defaultValue={reminder.recurrence} />
          <PrivacySelect t={t} defaultValue={reminder.visibility} />
          <div className="inline-form-actions">
            <button className="primary-button compact-button">
              {t('save')}
            </button>
            <button
              type="button"
              className="secondary-button compact-button"
              onClick={() => setEditing(false)}
            >
              {t('cancel')}
            </button>
          </div>
        </form>
      )}
    </article>
  );
}

function OrganiserItemRow({
  item,
  editing,
  setEditing,
  post,
  t,
}: {
  item: Organiser;
  editing: boolean;
  setEditing: (editing: boolean) => void;
  post: Post;
  t: T;
}) {
  return (
    <div className={`check-item ${item.done ? 'complete' : ''}`}>
      {editing ? (
        <form
          className="organiser-edit-form"
          onSubmit={async (event) => {
            const saved = await submitForm(event, post, 'organiser-update', {
              id: String(item.id),
            });
            if (saved) setEditing(false);
          }}
        >
          <Field name="list" label={t('listName')} defaultValue={item.list} />
          <Field
            name="label"
            label={t('itemLabel')}
            defaultValue={item.label}
          />
          <PrivacySelect t={t} defaultValue={item.visibility} />
          <div className="inline-form-actions">
            <button className="primary-button compact-button">
              {t('save')}
            </button>
            <button
              type="button"
              className="secondary-button compact-button"
              onClick={() => setEditing(false)}
            >
              {t('cancel')}
            </button>
          </div>
        </form>
      ) : (
        <>
          {item.owned ? (
            <button
              type="button"
              className="check-toggle"
              aria-label={t(item.done ? 'reopenItem' : 'completeItem', {
                item: item.label,
              })}
              onClick={() =>
                void post({
                  type: 'organiser-toggle',
                  id: item.id,
                  done: !item.done,
                })
              }
            >
              <i>{Boolean(item.done) && <Check size={12} />}</i>
              <span>{item.label}</span>
            </button>
          ) : (
            <span className="readonly-item">
              <i>{Boolean(item.done) && <Check size={12} />}</i>
              {item.label}
            </span>
          )}
          <div className="check-item-meta">
            <PrivacyBadge visibility={item.visibility} t={t} />
            {item.owned && (
              <>
                <button
                  type="button"
                  className="icon-button"
                  aria-label={t('editItem', { item: item.label })}
                  onClick={() => setEditing(true)}
                >
                  <Edit3 size={13} />
                </button>
                <ConfirmAction
                  className="icon-button danger"
                  label={t('deleteItem', { item: item.label })}
                  title={t('deleteItemTitle')}
                  description={t('deleteItemWarning', { item: item.label })}
                  confirmLabel={t('delete')}
                  cancelLabel={t('cancel')}
                  onConfirm={() =>
                    post({ type: 'organiser-remove', id: item.id })
                  }
                >
                  <Trash2 size={13} />
                </ConfirmAction>
              </>
            )}
          </div>
        </>
      )}
    </div>
  );
}
