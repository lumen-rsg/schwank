import type { Organiser, Task } from '../types';

export function overviewTasks(tasks: Task[], today: string) {
  const active = tasks.filter((task) => task.status !== 'done');
  const ordered = [...active].sort((left, right) => {
    if (left.dueOn && right.dueOn && left.dueOn !== right.dueOn)
      return left.dueOn.localeCompare(right.dueOn);
    if (left.dueOn) return -1;
    if (right.dueOn) return 1;
    return right.id - left.id;
  });
  return {
    active,
    preview: ordered.slice(0, 4),
    overdueCount: active.filter(
      (task) => Boolean(task.dueOn) && task.dueOn! < today,
    ).length,
  };
}

export function overviewGroceries(items: Organiser[]) {
  const active = items.filter(
    (item) => item.list === 'Groceries' && !item.done,
  );
  return { active, preview: active.slice(0, 4) };
}
