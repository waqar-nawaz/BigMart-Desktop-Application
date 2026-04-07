function requireRole(allowedRoles = []) {
  const allow = new Set(allowedRoles);
  return function roleMiddleware(req, res, next) {
    const role = req.user && req.user.role;
    if (!role) return res.status(401).json({ success: false, message: 'Unauthorized' });
    if (allow.has(role)) return next();
    return res.status(403).json({ success: false, message: 'Forbidden' });
  };
}

module.exports = { requireRole };

