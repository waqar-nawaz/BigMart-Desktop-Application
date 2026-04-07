const { v4: uuidv4 } = require('uuid');
const { getDb } = require('../database/database');

function safeJson(value) {
  try {
    return JSON.stringify(value ?? null);
  } catch {
    return JSON.stringify({ _error: 'unserializable' });
  }
}

const AuditService = {
  log({ userId, action, tableName = null, recordId = null, oldValues = null, newValues = null }) {
    const db = getDb();
    db.prepare(`
      INSERT INTO audit_log (id, user_id, action, table_name, record_id, old_values, new_values)
      VALUES (?,?,?,?,?,?,?)
    `).run(
      uuidv4(),
      userId || null,
      action,
      tableName,
      recordId,
      safeJson(oldValues),
      safeJson(newValues),
    );
  },
};

module.exports = AuditService;

