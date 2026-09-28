const ApiError = require('../utils/errors');

const requireRole = (...roles) => (req, res, next) => {
  if (!req.user) return next(ApiError.unauthorized());
  if (!roles.includes(req.user.role)) {
    return next(ApiError.forbidden('Admin access required'));
  }
  next();
};

module.exports = { requireRole };
