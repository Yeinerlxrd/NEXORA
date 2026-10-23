import assert from 'node:assert/strict';
import test from 'node:test';
import { parseCalendarDate } from '../src/lib/date.ts';

test('parsea fechas calendario sin convertirlas por zona horaria', () => {
  const date = parseCalendarDate('2026-10-21T00:00:00.000Z');

  assert.ok(date);
  assert.equal(date.getFullYear(), 2026);
  assert.equal(date.getMonth(), 9);
  assert.equal(date.getDate(), 21);
});

test('acepta el 29 de febrero en año bisiesto', () => {
  const date = parseCalendarDate('2024-02-29');

  assert.ok(date);
  assert.equal(date.getMonth(), 1);
  assert.equal(date.getDate(), 29);
});

test('rechaza fechas calendario imposibles y cadenas sin fecha', () => {
  assert.equal(parseCalendarDate('2026-02-29'), null);
  assert.equal(parseCalendarDate('2026-13-01'), null);
  assert.equal(parseCalendarDate('no-es-fecha'), null);
  assert.equal(parseCalendarDate(null), null);
});
