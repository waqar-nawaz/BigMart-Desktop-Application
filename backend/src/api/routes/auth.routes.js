/**
 * electron/src/api/routes/auth.routes.js
 * ───────────────────────────────────────
 * Authentication endpoints
 */

const AuthService = require('../../services/auth.service');
const { issueToken } = require('../../utils/auth');

module.exports = {
    login: async (req, res) => {
        try {
            const { username, password } = req.body;
            if (!username || !password) {
                return res.status(400).json({ success: false, message: 'Username and password required' });
            }
            const result = await AuthService.loginWithPassword(username, password);
            if (result.success) {
                const token = issueToken(result.user);
                return res.json({ ...result, token });
            }
            return res.status(401).json(result);
        } catch (err) {
            res.status(500).json({ success: false, message: err.message });
        }
    },

    pinLogin: async (req, res) => {
        try {
            const { pin } = req.body;
            if (!pin) {
                return res.status(400).json({ success: false, message: 'PIN required' });
            }
            const result = await AuthService.loginWithPin(pin);
            if (result.success) {
                const token = issueToken(result.user);
                return res.json({ ...result, token });
            }
            return res.status(401).json(result);
        } catch (err) {
            res.status(500).json({ success: false, message: err.message });
        }
    },

    changePassword: async (req, res) => {
        try {
            const { userId, oldPassword, newPassword } = req.body;
            if (!userId || !oldPassword || !newPassword) {
                return res.status(400).json({ success: false, message: 'All fields required' });
            }
            const result = await AuthService.changePassword(userId, oldPassword, newPassword);
            res.json(result);
        } catch (err) {
            res.status(500).json({ success: false, message: err.message });
        }
    }
};
