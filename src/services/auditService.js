export async function writeAudit(connection, { pmId = null, actor, action, details = {} }) {
  await connection.execute(
    'INSERT INTO audit_logs (pm_id, actor_name, actor_id, action, details) VALUES (?, ?, ?, ?, ?)',
    [pmId, actor.name, actor.id, action, JSON.stringify(details)],
  );
}
