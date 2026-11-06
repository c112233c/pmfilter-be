import { z } from 'zod';
import { HttpError } from './httpError.js';
import { parseEventTime, toSqlUtc } from './time.js';

const timeWindowSchema = z.object({
  start_time: z.string().min(1),
  end_time: z.string().min(1),
});

const pmPayloadSchema = z.object({
  title: z.string().trim().min(1).max(255),
  description: z.string().trim().max(2000).optional().default(''),
  devices: z.array(z.string().trim().min(1).max(255)).min(1).max(1000),
  time_windows: z.array(timeWindowSchema).min(1).max(100),
}).strict();

export function validatePmPayload(input) {
  const parsed = pmPayloadSchema.safeParse(input);
  if (!parsed.success) {
    throw new HttpError(400, 'VALIDATION_ERROR', 'ข้อมูล PM ไม่ถูกต้อง', parsed.error.issues.map((issue) => ({
      field: issue.path.join('.'),
      message: issue.message,
    })));
  }

  const payload = parsed.data;
  const seen = new Set();
  for (const device of payload.devices) {
    const normalized = device.trim().toLocaleLowerCase('en-US');
    if (seen.has(normalized)) {
      throw new HttpError(400, 'DUPLICATE_DEVICE', `พบชื่ออุปกรณ์ซ้ำ: ${device}`);
    }
    seen.add(normalized);
  }

  const windows = payload.time_windows.map((window, index) => {
    let start;
    let end;
    try {
      start = parseEventTime(window.start_time, `time_windows[${index}].start_time`);
      end = parseEventTime(window.end_time, `time_windows[${index}].end_time`);
    } catch (error) {
      throw error;
    }
    if (end.value.getTime() <= start.value.getTime()) {
      throw new HttpError(400, 'INVALID_TIME_WINDOW', `ช่วงเวลาที่ ${index + 1}: เวลาสิ้นสุดต้องอยู่หลังเวลาเริ่มต้น`);
    }
    return { start: start.value.getTime(), end: end.value.getTime(), start_time: toSqlUtc(start), end_time: toSqlUtc(end) };
  }).sort((a, b) => a.start - b.start);

  for (let index = 1; index < windows.length; index += 1) {
    if (windows[index].start < windows[index - 1].end) {
      throw new HttpError(400, 'OVERLAPPING_TIME_WINDOWS', 'ช่วงเวลา PM ห้ามทับซ้อนกัน');
    }
  }

  return {
    title: payload.title,
    description: payload.description,
    devices: payload.devices.map((device) => device.trim()),
    time_windows: windows.map(({ start_time, end_time }) => ({ start_time, end_time })),
  };
}

export function validatePagination(query, maxPageSize) {
  const page = Number.parseInt(query.page ?? '1', 10);
  const limit = Number.parseInt(query.limit ?? '20', 10);
  if (!Number.isInteger(page) || page < 1) throw new HttpError(400, 'VALIDATION_ERROR', 'page ต้องเป็นจำนวนเต็มตั้งแต่ 1 ขึ้นไป');
  if (!Number.isInteger(limit) || limit < 1) throw new HttpError(400, 'VALIDATION_ERROR', 'limit ต้องเป็นจำนวนเต็มตั้งแต่ 1 ขึ้นไป');
  return { page, limit: Math.min(limit, maxPageSize), offset: (page - 1) * Math.min(limit, maxPageSize) };
}

export function validateCheckPayload(input) {
  const schema = z.object({
    device_name: z.string().trim().min(1).max(255),
    event_time: z.string().min(1),
  }).strict();
  const parsed = schema.safeParse(input);
  if (!parsed.success) {
    throw new HttpError(400, 'VALIDATION_ERROR', 'ข้อมูลสำหรับตรวจสอบ PM ไม่ถูกต้อง', parsed.error.issues.map((issue) => ({
      field: issue.path.join('.'),
      message: issue.message,
    })));
  }
  return {
    device_name: parsed.data.device_name,
    event_time: toSqlUtc(parseEventTime(parsed.data.event_time)),
  };
}
