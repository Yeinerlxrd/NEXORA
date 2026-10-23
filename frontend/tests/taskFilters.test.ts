import assert from 'node:assert/strict';
import test from 'node:test';
import { filterTasks } from '../src/lib/taskFilters.ts';
import type { Task } from '../src/types.ts';

function task(overrides: Partial<Task> = {}): Task {
  return {
    id: 1,
    project_id: 10,
    title: 'Entrega de diseño',
    status: 'Pendiente',
    priority: 'Alta',
    ...overrides,
  };
}

test('combina búsqueda sin distinguir mayúsculas con estado y prioridad', () => {
  const matching = task({ id: 1 });
  const otherPriority = task({ id: 2, priority: 'Media' });
  const otherStatus = task({ id: 3, status: 'Completada' });
  const otherTitle = task({ id: 4, title: 'Reunión semanal' });

  const result = filterTasks([matching, otherPriority, otherStatus, otherTitle], {
    search: 'DISEÑO',
    status: 'Pendiente',
    priority: 'Alta',
  });

  assert.deepEqual(result.map(item => item.id), [1]);
});

test('los filtros vacíos conservan la lista completa', () => {
  const tasks = [task(), task({ id: 2, status: 'En progreso', priority: 'Baja' })];

  assert.deepEqual(filterTasks(tasks, { search: '', status: '', priority: '' }), tasks);
});
