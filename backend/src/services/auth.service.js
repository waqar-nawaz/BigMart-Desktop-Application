/**
 * electron/src/services/auth.service.js
 * ─────────────────────────────────────────
 * Business logic for authentication.
 * Controllers call services; services call models.
 *
 *  Controller → Service → Model → SQLite
 */
const bcrypt = require('bcryptjs');
const UserModel = require('../models/models').UserModel || require('../models/user.model');

// Re-require properly
const BaseModel = require('../models/base.model');
class UM extends BaseModel { constructor() { super('users'); }
  findByUsername(u) { return this.queryOne('SELECT * FROM users WHERE username=? AND is_active=1',[u]); }
  findByPin(p) { return this.queryOne('SELECT * FROM users WHERE pin=? AND is_active=1',[p]); }
  updateLastLogin(id) { return this.run("UPDATE users SET last_login=datetime('now') WHERE id=?",[id]); }
  updatePassword(id,h) { return this.run("UPDATE users SET password_hash=? WHERE id=?",[h,id]); }
  findAllSafe() { return this.query('SELECT id,username,full_name,email,role,pin,is_active,last_login,created_at FROM users WHERE is_active=1 ORDER BY full_name'); }
}
const userModel = new UM();

const AuthService = {
  /**
   * Login with username + password.
   * Returns { success, user } or { success:false, message }
   */
  loginWithPassword(username, password) {
    const user = userModel.findByUsername(username);
    if (!user) return { success: false, message: 'User not found' };
    if (!bcrypt.compareSync(password, user.password_hash)) {
      return { success: false, message: 'Invalid password' };
    }
    userModel.updateLastLogin(user.id);
    const { password_hash, pin, ...safeUser } = user;
    return { success: true, user: safeUser };
  },

  /** Login with 4-digit PIN (fast cashier switch). */
  loginWithPin(pin) {
    const user = userModel.findByPin(pin);
    if (!user) return { success: false, message: 'Invalid PIN' };
    userModel.updateLastLogin(user.id);
    const { password_hash, pin: p, ...safeUser } = user;
    return { success: true, user: safeUser };
  },

  changePassword(userId, oldPassword, newPassword) {
    const user = userModel.findById(userId);
    if (!user) return { success: false, message: 'User not found' };
    if (!bcrypt.compareSync(oldPassword, user.password_hash)) {
      return { success: false, message: 'Current password is incorrect' };
    }
    userModel.updatePassword(userId, bcrypt.hashSync(newPassword, 10));
    return { success: true };
  },

  getAllUsers() { return userModel.findAllSafe(); },

  createUser(data) {
    const { v4: uuidv4 } = require('uuid');
    const id = uuidv4();
    const hash = bcrypt.hashSync(data.password, 10);
    userModel.insert({ id, username: data.username, password_hash: hash,
      full_name: data.full_name, email: data.email || null,
      role: data.role || 'cashier', pin: data.pin || null,
      is_active: data.is_active !== false ? 1 : 0 });
    return { success: true, id };
  },

  updateUser(id, data) {
    const fields = { username: data.username, full_name: data.full_name,
      email: data.email, role: data.role, pin: data.pin,
      is_active: (data.is_active === false || data.is_active === 0) ? 0 : 1 };
    if (data.password) fields.password_hash = bcrypt.hashSync(data.password, 10);
    userModel.updateById(id, fields);
    return { success: true };
  },
};

module.exports = AuthService;
