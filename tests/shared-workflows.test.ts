import assert from 'node:assert/strict';
import test from 'node:test';
import {
  overviewGroceries,
  overviewTasks,
} from '../app/features/dashboard/overview-calculations';
import type {
  Organiser,
  PurchaseIdea,
  PurchaseVote,
  Task,
} from '../app/features/types';
import {
  sortWishlistIdeas,
  wishlistSummary,
} from '../app/features/wishlist/wishlist-calculations';

const task = (overrides: Partial<Task>): Task => ({
  id: 1,
  title: 'Task',
  status: 'todo',
  tag: 'Home',
  due: 'Later',
  dueOn: null,
  visibility: 'shared',
  owned: true,
  assignedToMe: false,
  assigneeId: 0,
  assigneeName: null,
  assigneeInitials: null,
  assigneeColor: null,
  assigneeAvatar: null,
  ...overrides,
});

const idea = (overrides: Partial<PurchaseIdea>): PurchaseIdea => ({
  id: 1,
  title: 'Idea',
  description: '',
  estimatedCost: null,
  status: 'open',
  createdAt: '2030-01-01T10:00:00.000Z',
  updatedAt: '2030-01-01T10:00:00.000Z',
  owned: true,
  createdByName: 'Alex',
  initials: 'A',
  color: '#000000',
  avatar: null,
  ...overrides,
});

const vote = (id: number, ideaId: number, value: 1 | -1): PurchaseVote => ({
  id,
  ideaId,
  vote: value,
  updatedAt: '2030-01-01T10:00:00.000Z',
  mine: false,
  name: `Member ${id}`,
  initials: 'M',
  color: '#000000',
  avatar: null,
});

void test('overview previews reconcile with full task and grocery counts', () => {
  const tasks = [
    task({ id: 1, dueOn: null }),
    task({ id: 2, dueOn: '2030-01-10' }),
    task({ id: 3, dueOn: '2029-12-31' }),
    task({ id: 4, status: 'done', dueOn: '2029-12-01' }),
  ];
  const taskSummary = overviewTasks(tasks, '2030-01-01');
  assert.equal(taskSummary.active.length, 3);
  assert.equal(taskSummary.overdueCount, 1);
  assert.deepEqual(
    taskSummary.preview.map((item) => item.id),
    [3, 2, 1],
  );

  const groceries: Organiser[] = Array.from({ length: 6 }, (_, index) => ({
    id: index + 1,
    list: index === 5 ? 'Chores' : 'Groceries',
    label: `Item ${index + 1}`,
    done: index === 4,
    visibility: 'shared',
    owned: true,
  }));
  const grocerySummary = overviewGroceries(groceries);
  assert.equal(grocerySummary.active.length, 4);
  assert.equal(grocerySummary.preview.length, 4);
});

void test('wishlist totals include only open ideas and their votes', () => {
  const ideas = [
    idea({ id: 1, estimatedCost: 10 }),
    idea({ id: 2, estimatedCost: null }),
    idea({ id: 3, status: 'bought', estimatedCost: 100 }),
    idea({ id: 4, status: 'archived', estimatedCost: 1_000 }),
  ];
  const votes = [vote(1, 1, 1), vote(2, 1, -1), vote(3, 3, 1)];
  assert.deepEqual(wishlistSummary(ideas, votes), {
    openCount: 2,
    estimatedOpenCost: 10,
    openVoteCount: 2,
  });
});

void test('wishlist sorting is deterministic and leaves missing estimates last', () => {
  const ideas = [
    idea({ id: 1, estimatedCost: 300 }),
    idea({ id: 2, estimatedCost: null }),
    idea({ id: 3, estimatedCost: 100 }),
  ];
  const votes = [vote(1, 1, 1), vote(2, 3, 1), vote(3, 3, 1)];
  assert.deepEqual(
    sortWishlistIdeas(ideas, votes, 'support').map((item) => item.id),
    [3, 1, 2],
  );
  assert.deepEqual(
    sortWishlistIdeas(ideas, votes, 'cost-asc').map((item) => item.id),
    [3, 1, 2],
  );
  assert.deepEqual(
    sortWishlistIdeas(ideas, votes, 'cost-desc').map((item) => item.id),
    [1, 3, 2],
  );
});
