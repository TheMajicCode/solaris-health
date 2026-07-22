'use strict';
/**
 * providerOnly — rejects non-practitioners with 403.
 * Must be used AFTER authMiddleware (req.user already set with role from JWT).
 * Allows: role='practitioner' OR role='admin'
 */
function providerOnly(req, res, next) {
  if (!req.user) return res.status(401).json({ error: 'Unauthorized' });
  if (req.user.role !== 'practitioner' && req.user.role !== 'admin') {
    return res.status(403).json({ error: 'Forbidden — practitioner access only.' });
  }
  next();
}

module.exports = { providerOnly };
