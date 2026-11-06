import { pool } from '../config/database.js';
import { validateCheckPayload } from '../utils/validation.js';

export async function checkPm(input) {
  const payload = validateCheckPayload(input);
  const [matches] = await pool.execute(
    `SELECT DISTINCT p.id, p.title, p.status, p.created_at
     FROM pm_list p
     INNER JOIN pm_devices d ON d.pm_id = p.id
     INNER JOIN pm_time_windows w ON w.pm_id = p.id
     WHERE p.status = 'active'
       AND d.device_name = ?
       AND w.start_time <= ?
       AND w.end_time > ?
     ORDER BY p.id DESC`,
    [payload.device_name, payload.event_time, payload.event_time],
  );
  const matched = matches.map((row) => ({ id: Number(row.id), title: row.title }));
  return {
    in_pm: matched.length > 0,
    reason: matched.length ? 'DEVICE_IN_PM_WINDOW' : 'NO_MATCHING_PM',
    matched_pm: matched,
    ...(matched[0] ? { pm_no: matched[0].id } : {}),
  };
}
