import {
  ArrowRight,
  CheckCircle2,
  CircleDollarSign,
  Flame,
  Plus,
  ShoppingBasket,
  WalletCards,
} from 'lucide-react';
import type { AuthUser } from '@/db/auth';
import { formatDate, money } from '../../client/format';
import {
  Avatar,
  Empty,
  PageTitle,
  PrivacyBadge,
} from '../../components/app-ui';
import type { Language } from '../../i18n';
import { Macro, type NutritionTotals } from '../nutrition/nutrition-view';
import type { Data, Post, T } from '../types';

export function Overview({
  data,
  user,
  totals,
  totalSpend,
  taskPercent,
  setActive,
  t,
  language,
}: {
  data: Data;
  user: AuthUser;
  totals: NutritionTotals;
  totalSpend: number;
  taskPercent: number;
  setActive: (value: string) => void;
  t: T;
  language: Language;
  post: Post;
}) {
  const recent = data.tasks
    .filter((task) => task.status !== 'done')
    .slice(0, 4);
  const groceries = data.organisers
    .filter((item) => item.list === 'Groceries' && !item.done)
    .slice(0, 4);
  const done = data.tasks.filter((task) => task.status === 'done').length;
  return (
    <>
      <PageTitle
        eyebrow={data.home.name}
        title={t('hello', { name: user.name })}
        copy={data.home.address || t('overviewCopy')}
        action={
          <button className="primary-button" onClick={() => setActive('tasks')}>
            <Plus size={18} />
            {t('addTask')}
          </button>
        }
      />
      <div className="stats-grid">
        <article className="stat-card nutrition-card">
          <div className="stat-heading">
            <span className="tinted-icon orange">
              <Flame size={19} />
            </span>
            <span>{t('todayNutrition')}</span>
            <button
              aria-label={t('nutrition')}
              onClick={() => setActive('nutrition')}
            >
              <ArrowRight size={17} />
            </button>
          </div>
          <div className="nutrition-body">
            <div
              className="calorie-ring"
              style={{
                background: `conic-gradient(var(--orange) 0 ${Math.min(100, (totals.calories / user.calorieGoal) * 100)}%,#eeeae2 0)`,
              }}
            >
              <span>
                <strong>{totals.calories}</strong>
                <small>{t('ofKcal', { goal: user.calorieGoal })}</small>
              </span>
              <progress
                className="sr-only"
                value={Math.min(totals.calories, user.calorieGoal)}
                max={user.calorieGoal}
                aria-label={t('calorieProgress', {
                  current: totals.calories,
                  goal: user.calorieGoal,
                })}
              />
            </div>
            <div className="macro-list">
              <Macro
                name={t('protein')}
                value={totals.protein}
                goal={user.proteinGoal}
                cls="protein"
              />
              <Macro
                name={t('carbs')}
                value={totals.carbs}
                goal={user.carbGoal}
                cls="carbs"
              />
              <Macro
                name={t('fats')}
                value={totals.fat}
                goal={user.fatGoal}
                cls="fats"
              />
            </div>
          </div>
          <button
            onClick={() => setActive('nutrition')}
            className="text-button"
          >
            {t('logMeal')} <ArrowRight size={15} />
          </button>
        </article>
        <article className="stat-card spending-card">
          <div className="stat-heading">
            <span className="tinted-icon green">
              <CircleDollarSign size={19} />
            </span>
            <span>{t('visibleSpending')}</span>
            <button
              aria-label={t('spending')}
              onClick={() => setActive('spending')}
            >
              <ArrowRight size={17} />
            </button>
          </div>
          <div className="spend-total">
            <strong>{money(totalSpend, language)}</strong>
            <span>
              {t('recordedExpenses', { count: data.expenses.length })}
            </span>
          </div>
          <div className="clean-summary">
            <WalletCards size={24} />
            <span>{t('visibleSpendingCopy')}</span>
          </div>
        </article>
        <article className="stat-card progress-card">
          <div className="stat-heading">
            <span className="tinted-icon blue">
              <CheckCircle2 size={19} />
            </span>
            <span>{t('taskProgress')}</span>
            <button aria-label={t('tasks')} onClick={() => setActive('tasks')}>
              <ArrowRight size={17} />
            </button>
          </div>
          <div className="progress-number">
            <strong>{taskPercent}%</strong>
            <span>
              {t('tasksComplete', { done, total: data.tasks.length })}
            </span>
          </div>
          <div className="big-progress">
            <i style={{ width: `${taskPercent}%` }} />
          </div>
        </article>
      </div>
      <div className="lower-grid">
        <article className="panel task-panel">
          <div className="panel-heading">
            <div>
              <h2>{t('upNext')}</h2>
              <span>{t('activeTasks', { count: recent.length })}</span>
            </div>
            <button className="link-button" onClick={() => setActive('tasks')}>
              {t('viewBoard')} <ArrowRight size={15} />
            </button>
          </div>
          <div className="task-list">
            {recent.length ? (
              recent.map((task) => (
                <div className="task-row" key={task.id}>
                  <span className="check" />
                  <div className="task-copy">
                    <strong>{task.title}</strong>
                    <span>
                      {task.dueOn ? formatDate(task.dueOn, language) : task.due}
                    </span>
                  </div>
                  <PrivacyBadge visibility={task.visibility} t={t} />
                </div>
              ))
            ) : (
              <Empty>{t('noTasks')}</Empty>
            )}
          </div>
        </article>
        <div className="right-stack">
          <article className="panel groceries-panel">
            <div className="panel-heading">
              <div>
                <h2>{t('groceryList')}</h2>
                <span>{t('visibleItems', { count: groceries.length })}</span>
              </div>
              <span className="tinted-icon peach">
                <ShoppingBasket size={18} />
              </span>
            </div>
            <div className="grocery-list">
              {groceries.length ? (
                groceries.map((item) => <span key={item.id}>{item.label}</span>)
              ) : (
                <Empty>{t('noGroceries')}</Empty>
              )}
            </div>
            <button
              onClick={() => setActive('organisers')}
              className="add-row compact"
            >
              {t('openOrganisers')}
            </button>
          </article>
          <article className="panel chat-panel">
            <div className="panel-heading">
              <div>
                <h2>{t('houseChat')}</h2>
                <span>
                  {t('messagesCount', { count: data.messages.length })}
                </span>
              </div>
              <button onClick={() => setActive('chat')} className="link-button">
                {t('openChat')}
              </button>
            </div>
            {data.messages.length ? (
              data.messages.slice(-2).map((message) => (
                <div className="message-preview" key={message.id}>
                  <Avatar person={message} />
                  <div>
                    <strong>{message.name}</strong>
                    <p>{message.body}</p>
                  </div>
                </div>
              ))
            ) : (
              <Empty>{t('noMessages')}</Empty>
            )}
          </article>
        </div>
      </div>
    </>
  );
}
