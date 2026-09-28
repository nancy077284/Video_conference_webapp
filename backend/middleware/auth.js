const jwt = require('jsonwebtoken');
const User = require('../models/User');
const ApiError = require('../utils/errors');
const { config } = require('../config/env');

const auth = async (req, res, next) => {
  try {
    const header = req.header('Authorization') || '';
    const token = header.startsWith('Bearer ') ? header.slice(7).trim() : null;
    if (!token) throw ApiError.unauthorized('Authentication required');

    let decoded;
    try {
      decoded = jwt.verify(token, config.jwtSecret);
    } catch (err) {
      if (err.name === 'TokenExpiredError') {
        throw ApiError.unauthorized('Your session has expired. Please sign in again.');
      }
      throw ApiError.unauthorized('Invalid session. Please sign in again.');
    }

    const user = await User.findById(decoded.userId);
    if (!user) throw ApiError.unauthorized('Account no longer exists');
    if (user.status === 'suspended') {
      throw ApiError.forbidden('This account has been suspended. Contact support.');
    }

    req.user = user;
    req.token = token;
    next();
  } catch (error) {
    next(error);
  }
};

module.exports = auth;
