import test from 'node:test';
import assert from 'node:assert/strict';
import { validatePmPayload, validateCheckPayload } from '../src/utils/validation.js';
import { parseEventTime, sqlUtcToIso, toSqlUtc } from '../src/utils/time.js';

const validPayload = () => ({
  title: 'PM Test', description: 'maintenance', devices: ['BDH_115_LINE01', 'BDH_115_LINE02'],
  time_windows: [{ start_time: '2026-10-22T08:00:00+07:00', end_time: '2026-10-22T12:00:00+07:00' }],
});

test('normalizes device names and UTC timestamps', () => {
  const result = validatePmPayload(validPayload());
  assert.deepEqual(result.devices, ['BDH_115_LINE01', 'BDH_115_LINE02']);
  assert.equal(result.time_windows[0].start_time, '2026-10-22 01:00:00.000');
  assert.equal(result.time_windows[0].end_time, '2026-10-22 05:00:00.000');
});

test('rejects duplicate device names regardless of case or whitespace', () => {
  const payload = validPayload(); payload.devices = [' DEVICE-1 ', 'device-1'];
  assert.throws(() => validatePmPayload(payload), { code: 'DUPLICATE_DEVICE' });
});

test('rejects overlapping time windows', () => {
  const payload = validPayload();
  payload.time_windows = [
    { start_time: '2026-10-22T08:00:00+07:00', end_time: '2026-10-22T10:00:00+07:00' },
    { start_time: '2026-10-22T09:59:00+07:00', end_time: '2026-10-22T11:00:00+07:00' },
  ];
  assert.throws(() => validatePmPayload(payload), { code: 'OVERLAPPING_TIME_WINDOWS' });
});

test('allows adjacent time windows', () => {
  const payload = validPayload();
  payload.time_windows = [
    { start_time: '2026-10-22T08:00:00+07:00', end_time: '2026-10-22T10:00:00+07:00' },
    { start_time: '2026-10-22T10:00:00+07:00', end_time: '2026-10-22T12:00:00+07:00' },
  ];
  assert.equal(validatePmPayload(payload).time_windows.length, 2);
});

test('rejects date-time without timezone', () => {
  const payload = validPayload(); payload.time_windows[0].start_time = '2026-10-22T08:00:00';
  assert.throws(() => validatePmPayload(payload), { code: 'VALIDATION_ERROR' });
});

test('PM check requires timezone and converts to UTC', () => {
  const result = validateCheckPayload({ device_name: ' DEVICE-1 ', event_time: '2026-10-22T09:30:00+07:00' });
  assert.equal(result.device_name, 'DEVICE-1');
  assert.equal(result.event_time, '2026-10-22 02:30:00.000');
});

test('accepts the requested display format as Thailand local time and preserves milliseconds', () => {
  const payload = {
    title: 'PM Milliseconds', devices: ['DEVICE-1'],
    time_windows: [{ start_time: '2026/10/01 21:00:00.123', end_time: '2026/10/01 22:00:00.456' }],
  };
  const result = validatePmPayload(payload);
  assert.equal(result.time_windows[0].start_time, '2026-10-01 21:00:00.123');
  assert.equal(result.time_windows[0].end_time, '2026-10-01 15:00:00.456');
  assert.equal(toSqlUtc(parseEventTime('2026/10/01 21:00:00.123')), '2026-10-01 21:00:00.123');
  assert.equal(sqlUtcToIso('2026-10-01 21:00:00.123'), '2026-10-01T14:00:00.123Z');
});

test('PM check accepts display format and stores the Thailand-local millisecond value', () => {
  const result = validateCheckPayload({ device_name: 'DEVICE-1', event_time: '2026/10/01 21:00:00.123' });
  assert.equal(result.event_time, '2026-10-01 21:00:00.123');
});
