import assert from 'node:assert/strict';
import test from 'node:test';
import { selectDailyTasks } from '../src/lib/daily.ts';
import type { Task } from '../src/types.ts';

const today = '2026-10-21';
const currentPublicId = 'current-user';

function task(overrides: Partial<Task> = {}): Task {
  return {
    id: 1,
    project_id: 10,
    title: 'Tarea',
    status: 'Pendiente',
    priority: 'Media',
    due_at: today,
    ...overrides,
  };
}

test('la agenda incluye tareas propias o asignadas y excluye las completadas', () => {
  const own = task({ id: 1, title: 'Propia', creator: { public_id: currentPublicId, name: 'Yo' } });
  const assigned = task({ id: 2, title: 'Asignada', assignee: { public_id: currentPublicId, name: 'Yo' } });
  const completed = task({ id: 3, status: 'Completada', creator: { public_id: currentPublicId, name: 'Yo' } });
  const anotherUser = task({ id: 4, creator: { public_id: 'other-user', name: 'Otra persona' } });

  const result = selectDailyTasks([own, assigned, completed, anotherUser], currentPublicId, today);

  assert.deepEqual(result.dueToday.map(item => item.id), [2, 1]);
  assert.deepEqual(result.overdue, []);
});

test('la agenda solo incluye tareas vencidas sin completar y ordena por fecha', () => {
  const later = task({ id: 1, title: 'Más reciente', due_at: '2026-10-20', assignee: { public_id: currentPublicId, name: 'Yo' } });
  const earlier = task({ id: 2, title: 'Más antigua', due_at: '2026-10-18', creator: { public_id: currentPublicId, name: 'Yo' } });
  const completed = task({ id: 3, status: 'Completada', due_at: '2026-10-17', creator: { public_id: currentPublicId, name: 'Yo' } });
  const noDate = task({ id: 4, due_at: null, creator: { public_id: currentPublicId, name: 'Yo' } });

  const result = selectDailyTasks([later, completed, noDate, earlier], currentPublicId, today);

  assert.deepEqual(result.dueToday, []);
  assert.deepEqual(result.overdue.map(item => item.id), [2, 1]);
});

test('sin identificador público no se atribuyen tareas a una sesión incompleta', () => {
  const result = selectDailyTasks([task()], undefined, today);

  assert.deepEqual(result, { dueToday: [], overdue: [] });
});
