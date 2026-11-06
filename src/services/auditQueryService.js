import { pool } from '../config/database.js';
import { validatePagination } from '../utils/validation.js';
import { sqlUtcToIso } from '../utils/time.js';

export async function listAudit(query, maxPageSize) {
  const { page, limit, offset } = validatePagination({ ...query, page: query.page ?? '1', limit: query.limit ?? '50' }, maxPageSize);
  const [rows] = await pool.execute(
    `SELECT a.id, a.pm_id, a.actor_name, a.actor_id, a.actor_name AS actor, a.action,
       a.details, JSON_UNQUOTE(JSON_EXTRACT(a.details, '$.message')) AS message, a.created_at
     FROM audit_logs a
     ORDER BY a.created_at DESC, a.id DESC
     LIMIT ? OFFSET ?`,
    [limit, offset],
  );
  const items = rows.map((row) => ({
    ...row,
    id: Number(row.id),
    pm_id: row.pm_id == null ? null : Number(row.pm_id),
    created_at: sqlUtcToIso(row.created_at),
    details: typeof row.details === 'string' ? safeJson(row.details) : row.details,
  }));
  const [[count]] = await pool.execute('SELECT COUNT(*) AS total FROM audit_logs');
  return { items, total: Number(count.total), page, limit, total_pages: Math.max(1, Math.ceil(Number(count.total) / limit)) };
}

function safeJson(value) {
  try { return JSON.parse(value); } catch { return value; }
}
