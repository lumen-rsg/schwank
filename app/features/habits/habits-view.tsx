'use client';

import { useMemo, useState } from 'react';
import {
  Check,
  Cigarette,
  CircleDollarSign,
  Edit3,
  History,
  Plus,
  Trash2,
  Users,
  Wine,
} from 'lucide-react';
import { dateKey, recentDates } from '../../client/dates';
import { formatDate, money } from '../../client/format';
import { submitForm } from '../../client/forms';
import { Field } from '../../components/app-field';
import {
  Avatar,
  ConfirmAction,
  Empty,
  PageTitle,
} from '../../components/app-ui';
import type { Language } from '../../i18n';
import type { Data, HabitHistoryDay, HabitKind, Post, T } from '../types';

function HabitHeatmap({
  habit,
  items,
  t,
  language,
}: {
  habit: HabitKind;
  items: HabitHistoryDay[];
  t: T;
  language: Language;
}) {
  const dates = useMemo(() => recentDates(84), []);
  const totals = items
    .filter((item) => item.habit === habit)
    .reduce<Record<string, number>>((all, item) => {
      all[item.day] = (all[item.day] || 0) + Number(item.occurrences);
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
        <figure className="habit-heatmap">
          <figcaption className="sr-only">
            {t('habitHeatmapSummary', {
              habit: t(habit),
              days: daysClear,
              occurrences,
            })}
          </figcaption>
          {dates.map((date) => {
            const key = dateKey(date);
            const value = totals[key] || 0;
            const level =
              value === 0 ? 0 : value === 1 ? 1 : value <= 3 ? 2 : 3;
            return (
              <span
                key={key}
                className={`heat-cell level-${level}`}
                title={`${formatDate(key, language)}: ${value}`}
                aria-hidden="true"
              />
            );
          })}
        </figure>
      </div>
      <div className="heatmap-legend" aria-hidden="true">
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

export function HabitsView({
  data,
  post,
  t,
  language,
  habitHistoryLoading,
  loadOlderHabitHistory,
}: {
  data: Data;
  post: Post;
  t: T;
  language: Language;
  habitHistoryLoading: boolean;
  loadOlderHabitHistory: () => Promise<boolean>;
}) {
  const [editingId, setEditingId] = useState<number | null>(null);
  const today = dateKey(new Date());
  const spending = data.habitHistoryDays.reduce(
    (sum, item) => sum + Number(item.cost),
    0,
  );
  const vapingSpend = data.habitHistoryDays
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
          <HabitHeatmap
            habit="vaping"
            items={data.habitHistoryDays}
            t={t}
            language={language}
          />
          <HabitHeatmap
            habit="alcohol"
            items={data.habitHistoryDays}
            t={t}
            language={language}
          />
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
              min={1}
              max={1_000}
              step={1}
            />
            <Field
              name="cost"
              label={t('costRub')}
              type="number"
              defaultValue="0"
              min={0}
              max={1_000_000}
              step="0.01"
            />
            <Field
              name="occurredOn"
              label={t('date')}
              type="date"
              max={today}
              defaultValue={today}
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
              {data.habits.map((item) =>
                editingId === item.id ? (
                  <form
                    className="habit-edit-form"
                    key={item.id}
                    onSubmit={async (event) => {
                      const saved = await submitForm(
                        event,
                        post,
                        'habit-update',
                        { id: String(item.id) },
                      );
                      if (saved) setEditingId(null);
                    }}
                  >
                    <label className="form-field">
                      <span>{t('habitType')}</span>
                      <select name="habit" defaultValue={item.habit}>
                        <option value="vaping">{t('vaping')}</option>
                        <option value="alcohol">{t('alcohol')}</option>
                      </select>
                    </label>
                    <Field
                      name="occurrences"
                      label={t('occurrences')}
                      type="number"
                      min={1}
                      max={1_000}
                      step={1}
                      defaultValue={String(item.occurrences)}
                    />
                    <Field
                      name="cost"
                      label={t('costRub')}
                      type="number"
                      min={0}
                      max={1_000_000}
                      step="0.01"
                      defaultValue={String(item.cost)}
                    />
                    <Field
                      name="occurredOn"
                      label={t('date')}
                      type="date"
                      max={today}
                      defaultValue={item.occurredOn}
                    />
                    <div className="habit-edit-actions">
                      <button className="primary-button">
                        <Check size={14} /> {t('save')}
                      </button>
                      <button
                        type="button"
                        className="secondary-button"
                        onClick={() => setEditingId(null)}
                      >
                        {t('cancel')}
                      </button>
                    </div>
                  </form>
                ) : (
                  <div key={item.id}>
                    <Avatar person={item} />
                    <div>
                      <strong>
                        {item.name} · {t(item.habit)}
                      </strong>
                      <span>{formatDate(item.occurredOn, language)}</span>
                    </div>
                    <b>
                      {t('habitRecord', {
                        count: item.occurrences,
                        cost: money(Number(item.cost), language),
                      })}
                    </b>
                    {item.mine && (
                      <div className="habit-row-actions">
                        <button
                          type="button"
                          aria-label={t('editHabitRecord')}
                          onClick={() => setEditingId(item.id)}
                        >
                          <Edit3 size={13} />
                        </button>
                        <ConfirmAction
                          label={t('deleteHabitRecord')}
                          title={t('deleteHabitTitle')}
                          description={t('deleteHabitWarning')}
                          confirmLabel={t('delete')}
                          cancelLabel={t('cancel')}
                          onConfirm={() =>
                            post({ type: 'habit-remove', id: item.id })
                          }
                        >
                          <Trash2 size={13} />
                        </ConfirmAction>
                      </div>
                    )}
                  </div>
                ),
              )}
            </div>
          ) : (
            <Empty>{t('noHabitActivity')}</Empty>
          )}
          {data.habitHistoryHasMore && (
            <div className="history-pagination" aria-live="polite">
              <span>
                {t('publicHistoryEntriesLoaded', {
                  loaded: data.habits.length,
                  total: data.habitHistoryCount,
                })}
              </span>
              <button
                type="button"
                className="secondary-button"
                disabled={habitHistoryLoading}
                onClick={() => void loadOlderHabitHistory()}
              >
                <History size={14} aria-hidden="true" />
                {habitHistoryLoading
                  ? t('loadingOlderHistory')
                  : t('loadOlderHistory')}
              </button>
            </div>
          )}
        </article>
      </div>
    </>
  );
}
