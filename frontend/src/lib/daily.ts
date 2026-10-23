import type { Task } from '../types';

export type DailyTaskLists = {
  dueToday: Task[];
  overdue: Task[];
};

export function selectDailyTasks(
  tasks: Task[],
  currentPublicId: string | undefined,
  today: string,
): DailyTaskLists {
  if (!currentPublicId) return { dueToday: [], overdue: [] };

  const personalActiveTasks = tasks.filter(task =>
    task.status !== 'Completada'
      && (task.creator?.public_id === currentPublicId || task.assignee?.public_id === currentPublicId),
  );
  const datedTasks = personalActiveTasks.filter(task => Boolean(task.due_at));

  return {
    dueToday: datedTasks
      .filter(task => task.due_at?.slice(0, 10) === today)
      .sort((first, second) => first.title.localeCompare(second.title, 'es')),
    overdue: datedTasks
      .filter(task => (task.due_at?.slice(0, 10) ?? '') < today)
      .sort((first, second) => (first.due_at ?? '').localeCompare(second.due_at ?? '')),
  };
}
