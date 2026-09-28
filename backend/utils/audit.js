const AuditLog = require('../models/AuditLog');

const SENSITIVE = new Set(['password', 'token', 'secret', 'authorization', 'credential']);

function scrub(obj) {
  if (!obj || typeof obj !== 'object') return obj;
  const out = Array.isArray(obj) ? [] : {};
  Object.entries(obj).forEach(([key, value]) => {
    if (SENSITIVE.has(key.toLowerCase())) {
      out[key] = '[redacted]';
    } else if (value && typeof value === 'object') {
      out[key] = scrub(value);
    } else {
      out[key] = value;
    }
  });
  return out;
}

async function logAudit({
  req,
  actor = null,
  action,
  target = null,
  targetType = null,
  result = 'success',
  meta = null,
  ip = null,
  userAgent = null,
}) {
  try {
    const requestIp =
      ip ||
      (req &&
        (req.headers['x-forwarded-for']?.split(',')[0].trim() ||
          req.ip ||
          req.socket?.remoteAddress)) ||
      null;
    await AuditLog.create({
      actor: actor || req?.user?._id || null,
      action,
      target,
      targetType,
      result,
      meta: meta ? scrub(meta) : undefined,
      ip: requestIp ? String(requestIp).replace('::ffff:', '') : null,
      userAgent: userAgent || req?.headers?.['user-agent'] || null,
    });
  } catch (err) {
    console.error('[audit] failed to write audit log:', err.message);
  }
}

module.exports = { logAudit, scrub };
