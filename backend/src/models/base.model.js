/**
 * electron/src/models/base.model.js
 * ────────────────────────────────────
 * Provides a thin base class that wraps better-sqlite3 statements.
 * All feature models extend this for consistent CRUD patterns.
 *
 * HOW TO CREATE A NEW MODEL:
 *   const BaseModel = require('./base.model');
 *   class MyModel extends BaseModel {
 *     constructor() { super('my_table'); }
 *     // add custom queries here
 *   }
 *   module.exports = new MyModel();
 */

const { getDb } = require('../database/database');

class BaseModel {
  /**
   * @param {string} tableName - SQLite table name this model maps to
   */
  constructor(tableName) {
    this.tableName = tableName;
  }

  get db() { return getDb(); }

  // ── Generic Finders ──────────────────────────────────
  findById(id) {
    return this.db.prepare(`SELECT * FROM ${this.tableName} WHERE id = ?`).get(id);
  }

  findAll(conditions = '', params = []) {
    const where = conditions ? `WHERE ${conditions}` : '';
    return this.db.prepare(`SELECT * FROM ${this.tableName} ${where} ORDER BY created_at DESC`).all(...params);
  }

  findOne(conditions, params = []) {
    return this.db.prepare(`SELECT * FROM ${this.tableName} WHERE ${conditions} LIMIT 1`).get(...params);
  }

  count(conditions = '', params = []) {
    const where = conditions ? `WHERE ${conditions}` : '';
    return this.db.prepare(`SELECT COUNT(*) as count FROM ${this.tableName} ${where}`).get(...params).count;
  }

  // ── Generic Mutations ─────────────────────────────────
  /**
   * Insert a row. The `data` object keys must match column names.
   * @param {object} data
   * @returns {object} { changes, lastInsertRowid }
   */
  insert(data) {
    const keys   = Object.keys(data);
    const values = Object.values(data);
    const placeholders = keys.map(() => '?').join(', ');
    const stmt = this.db.prepare(
      `INSERT INTO ${this.tableName} (${keys.join(', ')}) VALUES (${placeholders})`
    );
    return stmt.run(...values);
  }

  /**
   * Update a row by id. Automatically sets updated_at if the column exists.
   * @param {string} id
   * @param {object} data  - partial object of columns to update
   */
  updateById(id, data) {
    // Automatically add updated_at timestamp
    if ('updated_at' !== undefined) {
      data.updated_at = new Date().toISOString();
    }
    const keys = Object.keys(data).filter(k => k !== 'id');
    const set  = keys.map(k => `${k} = ?`).join(', ');
    const vals = keys.map(k => data[k]);
    return this.db.prepare(
      `UPDATE ${this.tableName} SET ${set} WHERE id = ?`
    ).run(...vals, id);
  }

  softDelete(id) {
    return this.db.prepare(
      `UPDATE ${this.tableName} SET is_active = 0, updated_at = datetime('now') WHERE id = ?`
    ).run(id);
  }

  hardDelete(id) {
    return this.db.prepare(`DELETE FROM ${this.tableName} WHERE id = ?`).run(id);
  }

  // ── Transaction Helper ────────────────────────────────
  /**
   * Wraps a function in a SQLite transaction.
   * @param {Function} fn  - receives db as argument
   */
  transaction(fn) {
    return this.db.transaction(fn)();
  }

  // ── Raw Query ─────────────────────────────────────────
  query(sql, params = []) {
    return this.db.prepare(sql).all(...params);
  }

  queryOne(sql, params = []) {
    return this.db.prepare(sql).get(...params);
  }

  run(sql, params = []) {
    return this.db.prepare(sql).run(...params);
  }
}

module.exports = BaseModel;
