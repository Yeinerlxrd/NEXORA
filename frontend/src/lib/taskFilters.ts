import type { Task } from '../types';

export function filterTasks(
  tasks: Task[],
  filters: { search: string; status: string; priority: string },
): Task[] {
  const search = filters.search.toLocaleLowerCase();

  return tasks.filter(task => {
    const matchesSearch = !search || task.title.toLocaleLowerCase().includes(search);
    return matchesSearch
      && (!filters.status || task.status === filters.status)
      && (!filters.priority || task.priority === filters.priority);
  });
}
