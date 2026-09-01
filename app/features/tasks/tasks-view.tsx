'use client';

import { ArrowRight, Plus } from 'lucide-react';
import { useState } from 'react';
import { dateKey } from '../../client/dates';
import { formatDate } from '../../client/format';
import { submitForm } from '../../client/forms';
import { Field } from '../../components/app-field';
import {
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
}: {
  data: Data;
  post: Post;
  t: T;
  language: Language;
}) {
  const [lastMove, setLastMove] = useState<{
    id: number;
    title: string;
    from: string;
    to: string;
  } | null>(null);
  const tomorrow = new Date();
  tomorrow.setDate(tomorrow.getDate() + 1);
  const columns = [
    ['todo', t('toDo')],
    ['progress', t('inProgress')],
    ['done', t('done')],
  ];
  return (
    <>
      <PageTitle
        eyebrow={t('taskEyebrow')}
        title={t('taskBoard')}
        copy={t('taskCopy')}
      />
      <form
        className="quick-form privacy-form panel"
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
        <PrivacySelect t={t} />
        <button className="primary-button">
          <Plus size={16} />
          {t('addTask')}
        </button>
      </form>
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
      <div className="kanban">
        {columns.map(([status, label]) => (
          <section className="kanban-column" key={status}>
            <header>
              <div>
                <i className={status} />
                <strong>{label}</strong>
              </div>
              <span>
                {data.tasks.filter((task) => task.status === status).length}
              </span>
            </header>
            {data.tasks
              .filter((task) => task.status === status)
              .map((task) => {
                const next =
                  status === 'todo'
                    ? 'progress'
                    : status === 'progress'
                      ? 'done'
                      : 'todo';
                return (
                  <article className="task-card" key={task.id}>
                    <div className="card-meta">
                      <span className="task-tag">{task.tag}</span>
                      <PrivacyBadge visibility={task.visibility} t={t} />
                    </div>
                    <h3>{task.title}</h3>
                    <footer>
                      <span>
                        {task.dueOn
                          ? formatDate(task.dueOn, language)
                          : task.due}
                        {!task.owned ? ` · ${t('sharedHousemate')}` : ''}
                      </span>
                      {Boolean(task.owned) && (
                        <button
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
    </>
  );
}
