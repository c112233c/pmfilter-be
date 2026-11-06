import { pool, withTransaction } from '../config/database.js';
import { HttpError } from '../utils/httpError.js';
import { validatePmPayload, validatePagination } from '../utils/validation.js';
import { writeAudit } from './auditService.js';
import { sqlUtcToIso } from '../utils/time.js';

const PM_COLUMNS = `
  p.id, p.title, p.description, p.status, p.created_by, p.updated_by,
  p.created_at, p.updated_at, p.cancelled_at
`;

function asUtcMillis(value) {
  if (!value) return NaN;
  return new Date(`${String(value).replace(' ', 'T').replace(/Z$/, '')}Z`).getTime();
}

function effectiveStatus(row) {
  if (row.status === 'cancelled') return 'cancelled';
  const now = Date.now();
  if (row.current_match || row.time_windows?.some((window) => asUtcMillis(window.start_time) <= now && now < asUtcMillis(window.end_time))) return 'active';
  if (row.future_match || row.time_windows?.some((window) => asUtcMillis(window.start_time) > now)) return 'upcoming';
  return 'expired';
}

async function loadPm(connection, id) {
  const [rows] = await connection.execute(
    `SELECT ${PM_COLUMNS},
       (SELECT a.actor_name FROM audit_logs a WHERE a.pm_id = p.id AND a.action = 'CREATE' ORDER BY a.id ASC LIMIT 1) AS created_by_name,
       (SELECT a.actor_name FROM audit_logs a WHERE a.pm_id = p.id AND a.action = 'UPDATE' ORDER BY a.id DESC LIMIT 1) AS updated_by_name
     FROM pm_list p WHERE p.id = ?`,
    [id],
  );
  if (!rows.length) throw new HttpError(404, 'PM_NOT_FOUND', 'ไม่พบรายการ PM');
  const pm = rows[0];
  const [devices] = await connection.execute(
    'SELECT id, device_name, created_at FROM pm_devices WHERE pm_id = ? ORDER BY id ASC',
    [id],
  );
  const [windows] = await connection.execute(
    'SELECT id, start_time, end_time, created_at FROM pm_time_windows WHERE pm_id = ? ORDER BY start_time ASC, id ASC',
    [id],
  );
  return {
    ...pm,
    created_at: sqlUtcToIso(pm.created_at),
    updated_at: sqlUtcToIso(pm.updated_at),
    cancelled_at: sqlUtcToIso(pm.cancelled_at),
    id: Number(pm.id),
    created_by: pm.created_by_name || pm.created_by,
    updated_by: pm.updated_by_name || pm.updated_by,
    devices: devices.map((device) => ({ ...device, created_at: sqlUtcToIso(device.created_at), id: Number(device.id) })),
    time_windows: windows.map((window) => ({ ...window, start_time: sqlUtcToIso(window.start_time), end_time: sqlUtcToIso(window.end_time), created_at: sqlUtcToIso(window.created_at), id: Number(window.id) })),
  };
}

export async function createPm(input, actor) {
  const payload = validatePmPayload(input);
  return withTransaction(async (connection) => {
    const [result] = await connection.execute(
      "INSERT INTO pm_list (title, description, status, created_by) VALUES (?, ?, 'active', ?)",
      [payload.title, payload.description || null, actor.id],
    );
    const id = result.insertId;
    for (const device of payload.devices) {
      await connection.execute('INSERT INTO pm_devices (pm_id, device_name) VALUES (?, ?)', [id, device]);
    }
    for (const window of payload.time_windows) {
      await connection.execute(
        'INSERT INTO pm_time_windows (pm_id, start_time, end_time) VALUES (?, ?, ?)',
        [id, window.start_time, window.end_time],
      );
    }
    await writeAudit(connection, {
      pmId: id,
      actor,
      action: 'CREATE',
      details: { message: 'สร้างรายการ PM', title: payload.title, devices: payload.devices, time_windows: payload.time_windows },
    });
    const pm = await loadPm(connection, id);
    return { ...pm, status: effectiveStatus(pm) };
  });
}

export async function updatePm(id, input, actor) {
  const payload = validatePmPayload(input);
  return withTransaction(async (connection) => {
    const [existing] = await connection.execute('SELECT id, status FROM pm_list WHERE id = ? FOR UPDATE', [id]);
    if (!existing.length) throw new HttpError(404, 'PM_NOT_FOUND', 'ไม่พบรายการ PM');
    if (existing[0].status === 'cancelled') throw new HttpError(409, 'PM_CANCELLED', 'ไม่สามารถแก้ไข PM ที่ยกเลิกแล้ว');

    await connection.execute(
      'UPDATE pm_list SET title = ?, description = ?, updated_by = ? WHERE id = ?',
      [payload.title, payload.description || null, actor.id, id],
    );
    await connection.execute('DELETE FROM pm_devices WHERE pm_id = ?', [id]);
    await connection.execute('DELETE FROM pm_time_windows WHERE pm_id = ?', [id]);
    for (const device of payload.devices) {
      await connection.execute('INSERT INTO pm_devices (pm_id, device_name) VALUES (?, ?)', [id, device]);
    }
    for (const window of payload.time_windows) {
      await connection.execute(
        'INSERT INTO pm_time_windows (pm_id, start_time, end_time) VALUES (?, ?, ?)',
        [id, window.start_time, window.end_time],
      );
    }
    await writeAudit(connection, {
      pmId: id,
      actor,
      action: 'UPDATE',
      details: { message: 'แก้ไขรายการ PM', title: payload.title, devices: payload.devices, time_windows: payload.time_windows },
    });
    const pm = await loadPm(connection, id);
    return { ...pm, status: effectiveStatus(pm) };
  });
}

export async function cancelPm(id, actor) {
  return withTransaction(async (connection) => {
    const [existing] = await connection.execute('SELECT id, status FROM pm_list WHERE id = ? FOR UPDATE', [id]);
    if (!existing.length) throw new HttpError(404, 'PM_NOT_FOUND', 'ไม่พบรายการ PM');
    if (existing[0].status === 'cancelled') throw new HttpError(409, 'PM_ALREADY_CANCELLED', 'รายการ PM นี้ถูกยกเลิกแล้ว');
    await connection.execute(
      "UPDATE pm_list SET status = 'cancelled', cancelled_at = UTC_TIMESTAMP(3), updated_by = ? WHERE id = ?",
      [actor.id, id],
    );
    await writeAudit(connection, {
      pmId: id,
      actor,
      action: 'CANCEL',
      details: { message: 'ยกเลิกรายการ PM' },
    });
    return { id: Number(id), status: 'cancelled', cancelled_at: new Date().toISOString() };
  });
}

export async function getPmById(id) {
  const pm = await loadPm(pool, id);
  return { ...pm, status: effectiveStatus(pm) };
}

export async function listPm(query, maxPageSize) {
  const { page, limit, offset } = validatePagination(query, maxPageSize);
  const search = String(query.search || '').trim();
  const requestedStatus = String(query.status || '').trim();
  const now = new Date().toISOString().slice(0, 23).replace('T', ' ');
  const params = [];
  const conditions = [];

  if (requestedStatus === 'cancelled') {
    conditions.push("p.status = 'cancelled'");
  } else if (requestedStatus === 'active') {
    conditions.push("p.status = 'active' AND EXISTS (SELECT 1 FROM pm_time_windows w WHERE w.pm_id=p.id AND w.start_time <= ? AND w.end_time > ?)");
    params.push(now, now);
  } else if (requestedStatus === 'upcoming') {
    conditions.push("p.status = 'active' AND NOT EXISTS (SELECT 1 FROM pm_time_windows w WHERE w.pm_id=p.id AND w.start_time <= ? AND w.end_time > ?) AND EXISTS (SELECT 1 FROM pm_time_windows w WHERE w.pm_id=p.id AND w.start_time > ?)");
    params.push(now, now, now);
  } else if (requestedStatus === 'expired') {
    conditions.push("p.status = 'active' AND NOT EXISTS (SELECT 1 FROM pm_time_windows w WHERE w.pm_id=p.id AND w.end_time > ?)");
    params.push(now);
  } else if (requestedStatus && requestedStatus !== 'all') {
    throw new HttpError(400, 'INVALID_STATUS', 'status ต้องเป็น active, upcoming, expired หรือ cancelled');
  }

  if (search) {
    let condition = '(p.title LIKE ? OR p.description LIKE ? OR EXISTS (SELECT 1 FROM pm_devices d WHERE d.pm_id=p.id AND d.device_name LIKE ?)';
    params.push(`%${search}%`, `%${search}%`, `%${search}%`);
    if (/^\d+$/.test(search)) {
      condition += ' OR p.id = ?';
      params.push(Number(search));
    }
    condition += ')';
    conditions.push(condition);
  }

  const where = conditions.length ? `WHERE ${conditions.join(' AND ')}` : '';
  const [countRows] = await pool.execute(`SELECT COUNT(*) AS total FROM pm_list p ${where}`, params);
  const total = Number(countRows[0].total);
  const listSql = `
    SELECT p.id, p.title, p.description, p.status, p.created_by, p.created_at, p.updated_at,
      (SELECT COUNT(*) FROM pm_devices d WHERE d.pm_id = p.id) AS device_count,
      (SELECT MIN(w.start_time) FROM pm_time_windows w WHERE w.pm_id = p.id) AS start_time,
      (SELECT MAX(w.end_time) FROM pm_time_windows w WHERE w.pm_id = p.id) AS end_time,
      EXISTS (SELECT 1 FROM pm_time_windows w WHERE w.pm_id=p.id AND w.start_time <= ? AND w.end_time > ?) AS current_match,
      EXISTS (SELECT 1 FROM pm_time_windows w WHERE w.pm_id=p.id AND w.start_time > ?) AS future_match
    FROM pm_list p ${where}
    ORDER BY p.created_at DESC, p.id DESC
    LIMIT ? OFFSET ?`;
  const [rows] = await pool.execute(listSql, [now, now, now, ...params, limit, offset]);
  const items = rows.map((row) => ({
    ...row,
    id: Number(row.id),
    device_count: Number(row.device_count),
    created_at: sqlUtcToIso(row.created_at),
    updated_at: sqlUtcToIso(row.updated_at),
    start_time: sqlUtcToIso(row.start_time),
    end_time: sqlUtcToIso(row.end_time),
    status: effectiveStatus(row),
  }));
  return { items, total, page, limit, total_pages: Math.max(1, Math.ceil(total / limit)) };
}

export async function getDashboardSummary() {
  const now = new Date().toISOString().slice(0, 23).replace('T', ' ');
  const [[counts]] = await pool.execute(
    `SELECT
      SUM(CASE WHEN p.status='active' AND EXISTS (SELECT 1 FROM pm_time_windows w WHERE w.pm_id=p.id AND w.start_time <= ? AND w.end_time > ?) THEN 1 ELSE 0 END) AS active_pm,
      SUM(CASE WHEN p.status='active' AND NOT EXISTS (SELECT 1 FROM pm_time_windows w WHERE w.pm_id=p.id AND w.start_time <= ? AND w.end_time > ?) AND EXISTS (SELECT 1 FROM pm_time_windows w WHERE w.pm_id=p.id AND w.start_time > ?) THEN 1 ELSE 0 END) AS upcoming_pm,
      SUM(CASE WHEN p.status='active' THEN 1 ELSE 0 END) AS total_pm,
      SUM(CASE WHEN p.status='active' AND NOT EXISTS (SELECT 1 FROM pm_time_windows w WHERE w.pm_id=p.id AND w.end_time > ?) THEN 1 ELSE 0 END) AS expired_pm
    FROM pm_list p`,
    [now, now, now, now, now, now],
  );
  return Object.fromEntries(['active_pm', 'upcoming_pm', 'total_pm', 'expired_pm'].map((key) => [key, Number(counts[key] || 0)]));
}
