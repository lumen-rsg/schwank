'use client';

import { useState } from 'react';
import { BellRing, Check, ClipboardCheck, Clock3, Plus } from 'lucide-react';
import { dateTimeKey, formatDateTime } from '../../client/format';
import { submitForm } from '../../client/forms';
import { Field } from '../../components/app-field';
import {
  Empty,
  PageTitle,
  PrivacyBadge,
  PrivacySelect,
} from '../../components/app-ui';
import type { Language } from '../../i18n';
import type { Data, Post, T } from '../types';

export function OrganisersView({
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
