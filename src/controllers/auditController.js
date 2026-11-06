import { env } from '../config/env.js';
import { listAudit } from '../services/auditQueryService.js';

export async function list(req, res) {
  res.json(await listAudit(req.query, env.MAX_PAGE_SIZE));
}
