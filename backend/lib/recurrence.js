'use strict';
// Advance a due date by interval units. Pure: returns a NEW Date, never mutates.
// Uses UTC component math (containers run UTC; due_date is stored as a timestamp).
function nextDueDate(due, unit, interval) {
  const d = new Date(due);
  const n = Number(interval) || 1;
  switch (unit) {
    case 'day':   d.setUTCDate(d.getUTCDate() + n); break;
    case 'week':  d.setUTCDate(d.getUTCDate() + 7 * n); break;
    case 'month': d.setUTCMonth(d.getUTCMonth() + n); break;   // JS rolls month-end over; acceptable
    case 'year':  d.setUTCFullYear(d.getUTCFullYear() + n); break;
    default: return new Date(due);
  }
  return d;
}
module.exports = { nextDueDate };
