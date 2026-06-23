'use strict';
const { nextDueDate } = require('../lib/recurrence');

test('day: advances by interval days', () => {
  expect(nextDueDate('2026-06-23T00:00:00.000Z', 'day', 3).toISOString().slice(0,10)).toBe('2026-06-26');
});
test('week: advances by interval*7 days', () => {
  expect(nextDueDate('2026-06-23T00:00:00.000Z', 'week', 2).toISOString().slice(0,10)).toBe('2026-07-07');
});
test('month: advances by interval months', () => {
  expect(nextDueDate('2026-01-15T00:00:00.000Z', 'month', 1).toISOString().slice(0,10)).toBe('2026-02-15');
});
test('year: advances by interval years', () => {
  expect(nextDueDate('2026-10-17T00:00:00.000Z', 'year', 1).toISOString().slice(0,10)).toBe('2027-10-17');
});
test('does not mutate the input date', () => {
  const d = new Date('2026-06-23T00:00:00.000Z');
  nextDueDate(d, 'day', 5);
  expect(d.toISOString().slice(0,10)).toBe('2026-06-23');
});
