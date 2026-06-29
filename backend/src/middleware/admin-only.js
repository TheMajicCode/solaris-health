/**
 * adminOnly — gate a route to administrators.
 * Must be chained AFTER authMiddleware so req.user is populated.
 */
function adminOnly(req, res, next) {
  if (!req.user || req.user.role !== 'admin') {
    return res.status(403).json({ error: 'Admin access only' });
  }
  next();
}

module.exports = { adminOnly };
