'use client';

import {
  ArrowRight,
  Check,
  Edit3,
  History,
  Plus,
  Search,
  Trash2,
} from 'lucide-react';
import { useMemo, useState } from 'react';
import { dateKey } from '../../client/dates';
import { formatDate } from '../../client/format';
import { submitForm } from '../../client/forms';
import { Field } from '../../components/app-field';
import {
  Avatar,
  ConfirmAction,
  Empty,
  PageTitle,
  PrivacyBadge,
  PrivacySelect,
} from '../../components/app-ui';
import type { Language } from '../../i18n';
import type { Data, Post, T } from '../types';

export function TasksView({
  data,
  post,
  t,
  language,
  taskHistoryLoading,
  loadOlderTaskHistory,
}: {
  data: Data;
  post: Post;
  t: T;
  language: Language;
  taskHistoryLoading: boolean;
  loadOlderTaskHistory: () => Promise<boolean>;
}) {
  const [query, setQuery] = useState('');
  const [view, setView] = useState<'active' | 'completed' | 'all'>('active');
  const [assignee, setAssignee] = useState('all');
  const [editingId, setEditingId] = useState<number | null>(null);
  const [lastMove, setLastMove] = useState<{
    id: number;
    title: string;
    from: string;
    to: string;
  } | null>(null);
  const tomorrow = new Date();
  tomorrow.setDate(tomorrow.getDate() + 1);
  const allColumns = [
    ['todo', t('toDo')],
    ['progress', t('inProgress')],
    ['done', t('done')],
  ] as const;
  const columns =
    view === 'active'
      ? allColumns.slice(0, 2)
      : view === 'completed'
        ? allColumns.slice(2)
        : allColumns;
  const visibleTasks = useMemo(() => {
    const normalizedQuery = query.trim().toLocaleLowerCase(language);
    return data.tasks.filter((task) => {
      if (view === 'active' && task.status === 'done') return false;
      if (view === 'completed' && task.status !== 'done') return false;
      if (assignee === 'me' && !task.assignedToMe) return false;
      if (assignee !== 'all' && assignee !== 'me') {
        if (task.assigneeId !== Number(assignee)) return false;
      }
      if (!normalizedQuery) return true;
      return `${task.title} ${task.tag} ${task.assigneeName || ''}`
        .toLocaleLowerCase(language)
        .includes(normalizedQuery);
    });
  }, [assignee, data.tasks, language, query, view]);
  const assigneeOptions = data.members.map((member) => (
    <option value={member.id} key={member.id}>
      {member.name}
      {member.id === data.currentUser.id ? ` (${t('you')})` : ''}
    </option>
  ));
  return (
    <>
      <PageTitle
        eyebrow={t('taskEyebrow')}
        title={t('taskBoard')}
        copy={t('taskCopy')}
      />
      <form
        className="quick-form privacy-form task-create-form panel"
        onSubmit={(event) => submitForm(event, post, 'task')}
      >
        <Field
          name="title"
          label={t('newTask')}
          placeholder={t('whatNeedsDoing')}
        />
        <Field name="tag" label={t('group')} defaultValue="Home" />
        <Field
          name="dueOn"
          label={t('due')}
          type="date"
          defaultValue={dateKey(tomorrow)}
        />
        <label className="form-field">
          <span>{t('assignee')}</span>
          <select name="assigneeId" defaultValue={data.currentUser.id}>
            {assigneeOptions}
          </select>
        </label>
        <PrivacySelect t={t} />
        <button className="primary-button">
          <Plus size={16} />
          {t('addTask')}
        </button>
        <p className="task-sharing-hint">{t('taskAssigneeHint')}</p>
      </form>
      <section className="task-toolbar panel" aria-label={t('taskFilters')}>
        <label className="task-search">
          <Search size={15} aria-hidden="true" />
          <span className="sr-only">{t('searchTasks')}</span>
          <input
            type="search"
            value={query}
            onChange={(event) => setQuery(event.target.value)}
            placeholder={t('searchTasks')}
          />
        </label>
        <label className="task-filter-field">
          <span>{t('view')}</span>
          <select
            value={view}
            onChange={(event) =>
              setView(event.target.value as 'active' | 'completed' | 'all')
            }
          >
            <option value="active">{t('activeTasksView')}</option>
            <option value="completed">{t('completedArchive')}</option>
            <option value="all">{t('allTasks')}</option>
          </select>
        </label>
        <label className="task-filter-field">
          <span>{t('assignee')}</span>
          <select
            value={assignee}
            onChange={(event) => setAssignee(event.target.value)}
          >
            <option value="all">{t('allAssignees')}</option>
            <option value="me">{t('assignedToMe')}</option>
            {assigneeOptions}
          </select>
        </label>
        <span className="task-result-count">
          {t('tasksShown', { count: visibleTasks.length })}
        </span>
      </section>
      {lastMove && (
        <output className="undo-notice">
          <span>
            {t('taskMoved', {
              task: lastMove.title,
              status: t(
                lastMove.to === 'todo'
                  ? 'toDo'
                  : lastMove.to === 'progress'
                    ? 'inProgress'
                    : 'done',
              ),
            })}
          </span>
          <button
            type="button"
            onClick={async () => {
              const restored = await post({
                type: 'task-status',
                id: lastMove.id,
                status: lastMove.from,
              });
              if (restored) setLastMove(null);
            }}
          >
            {t('undo')}
          </button>
        </output>
      )}
      {visibleTasks.length === 0 ? (
        <Empty>
          {query || assignee !== 'all'
            ? t('noMatchingTasks')
            : t('noTasksInView')}
        </Empty>
      ) : (
        <div className={`kanban kanban-${columns.length}`}>
          {columns.map(([status, label]) => (
            <section className="kanban-column" key={status}>
              <header>
                <div>
                  <i className={status} />
                  <strong>{label}</strong>
                </div>
                <span>
                  {visibleTasks.filter((task) => task.status === status).length}
                </span>
              </header>
              {visibleTasks
                .filter((task) => task.status === status)
                .map((task) => {
                  const next =
                    status === 'todo'
                      ? 'progress'
                      : status === 'progress'
                        ? 'done'
                        : 'todo';
                  return (
                    <article
                      className="task-card"
                      data-notification-target={`task:${task.id}`}
                      key={task.id}
                    >
                      <div className="card-meta">
                        <span className="task-tag">{task.tag}</span>
                        <div className="task-card-actions">
                          <PrivacyBadge visibility={task.visibility} t={t} />
                          {Boolean(task.owned) && (
                            <>
                              <button
                                type="button"
                                className="task-icon-button"
                                aria-label={t('editTask', { task: task.title })}
                                onClick={() =>
                                  setEditingId((current) =>
                                    current === task.id ? null : task.id,
                                  )
                                }
                              >
                                <Edit3 size={13} />
                              </button>
                              <ConfirmAction
                                className="task-icon-button danger"
                                label={t('deleteTask', { task: task.title })}
                                title={t('deleteTaskTitle')}
                                description={t('deleteTaskWarning', {
                                  task: task.title,
                                })}
                                confirmLabel={t('delete')}
                                cancelLabel={t('cancel')}
                                onConfirm={async () => {
                                  const removed = await post({
                                    type: 'task-remove',
                                    id: task.id,
                                  });
                                  if (removed) {
                                    setEditingId(null);
                                    setLastMove((move) =>
                                      move?.id === task.id ? null : move,
                                    );
                                  }
                                }}
                              >
                                <Trash2 size={13} />
                              </ConfirmAction>
                            </>
                          )}
                        </div>
                      </div>
                      {editingId === task.id ? (
                        <form
                          className="task-edit-form"
                          onSubmit={async (event) => {
                            const saved = await submitForm(
                              event,
                              post,
                              'task-update',
                              { id: String(task.id) },
                            );
                            if (saved) setEditingId(null);
                          }}
                        >
                          <Field
                            name="title"
                            label={t('newTask')}
                            defaultValue={task.title}
                            maxLength={120}
                          />
                          <Field
                            name="tag"
                            label={t('group')}
                            defaultValue={task.tag}
                            maxLength={30}
                          />
                          <Field
                            name="dueOn"
                            label={t('due')}
                            type="date"
                            defaultValue={task.dueOn || ''}
                          />
                          <label className="form-field">
                            <span>{t('assignee')}</span>
                            <select
                              name="assigneeId"
                              defaultValue={task.assigneeId}
                            >
                              {assigneeOptions}
                            </select>
                          </label>
                          <PrivacySelect t={t} defaultValue={task.visibility} />
                          <div className="task-edit-actions">
                            <button className="primary-button">
                              <Check size={14} />
                              {t('save')}
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
                        <h3>{task.title}</h3>
                      )}
                      <footer>
                        <div className="task-assignee">
                          <Avatar
                            small
                            person={{
                              initials: task.assigneeInitials || '?',
                              color: task.assigneeColor || '#8a8d86',
                              avatar: task.assigneeAvatar,
                            }}
                          />
                          <span>
                            {task.assigneeName || t('unassigned')}
                            {' · '}
                            {task.dueOn
                              ? formatDate(task.dueOn, language)
                              : task.due}
                          </span>
                        </div>
                        {(Boolean(task.owned) ||
                          Boolean(task.assignedToMe)) && (
                          <button
                            type="button"
                            onClick={async () => {
                              const moved = await post({
                                type: 'task-status',
                                id: task.id,
                                status: next,
                              });
                              if (moved)
                                setLastMove({
                                  id: task.id,
                                  title: task.title,
                                  from: status,
                                  to: next,
                                });
                            }}
                            aria-label={t('moveTaskTo', {
                              task: task.title,
                              status: t(
                                next === 'progress'
                                  ? 'inProgress'
                                  : next === 'done'
                                    ? 'done'
                                    : 'toDo',
                              ),
                            })}
                          >
                            <ArrowRight size={15} />
                          </button>
                        )}
                      </footer>
                    </article>
                  );
                })}
            </section>
          ))}
        </div>
      )}
      {view !== 'active' && data.completedTasksHasMore && (
        <div className="history-pagination panel" aria-live="polite">
          <span>
            {t('completedEntriesLoaded', {
              loaded: data.tasks.filter((task) => task.status === 'done')
                .length,
              total: data.completedTaskCount,
            })}
          </span>
          <button
            type="button"
            className="secondary-button"
            disabled={taskHistoryLoading}
            onClick={() => void loadOlderTaskHistory()}
          >
            <History size={14} aria-hidden="true" />
            {taskHistoryLoading
              ? t('loadingOlderHistory')
              : t('loadOlderHistory')}
          </button>
        </div>
      )}
    </>
  );
}
