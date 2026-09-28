const ApiError = require('../utils/errors');

const buckets = new Map();
const MAX_BUCKETS = 10000;

function createRateLimiter({ windowMs = 60 * 1000, max = 60, keyPrefix = 'rl' } = {}) {
  return function rateLimit(req, res, next) {
    const identity =
      (req.user && String(req.user._id)) ||
      req.headers['x-forwarded-for']?.split(',')[0].trim() ||
      req.ip ||
      'anon';
    const key = `${keyPrefix}:${identity}`;
    const now = Date.now();

    if (buckets.size > MAX_BUCKETS) {
      buckets.forEach((entry, k) => {
        if (entry.reset <= now) buckets.delete(k);
      });
    }

    let entry = buckets.get(key);
    if (!entry || entry.reset <= now) {
      entry = { count: 0, reset: now + windowMs };
      buckets.set(key, entry);
    }
    entry.count += 1;

    const remaining = Math.max(0, max - entry.count);
    res.setHeader('X-RateLimit-Limit', String(max));
    res.setHeader('X-RateLimit-Remaining', String(remaining));
    res.setHeader('X-RateLimit-Reset', String(Math.ceil(entry.reset / 1000)));

    if (entry.count > max) {
      const retryAfter = Math.ceil((entry.reset - now) / 1000);
      res.setHeader('Retry-After', String(retryAfter));
      return next(
        ApiError.tooMany('Too many requests. Please wait a moment and try again.')
      );
    }
    next();
  };
}

function resetRateLimits() {
  buckets.clear();
}

module.exports = { createRateLimiter, resetRateLimits };
