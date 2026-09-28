const ApiError = require('../utils/errors');
const { config } = require('../config/env');

function notFound(req, res, next) {
  next(ApiError.notFound('Route not found'));
}

// eslint-disable-next-line no-unused-vars
function errorHandler(err, req, res, next) {
  if (err instanceof ApiError) {
    return res.status(err.status).json({ error: err.message, code: err.code });
  }

  if (err.name === 'ValidationError') {
    const first = Object.values(err.errors || {})[0];
    return res.status(422).json({ error: first?.message || 'Validation failed', code: 'UNPROCESSABLE' });
  }

  if (err.name === 'CastError') {
    return res.status(400).json({ error: 'Invalid identifier', code: 'BAD_REQUEST' });
  }

  if (err.code === 11000) {
    const field = Object.keys(err.keyPattern || {})[0] || 'field';
    return res.status(409).json({ error: `That ${field} is already in use`, code: 'CONFLICT' });
  }

  if (err.name === 'MongoTimeoutError' || err.name === 'MongoNetworkError' || err.message?.includes('buffering timed out')) {
    console.error('[db]', err.message);
    return res.status(503).json({ error: 'Database is temporarily unavailable. Please try again.', code: 'UNAVAILABLE' });
  }

  if (err.type === 'entity.parse.failed') {
    return res.status(400).json({ error: 'Malformed request body', code: 'BAD_REQUEST' });
  }

  console.error('[error]', req.method, req.originalUrl, err);
  res.status(500).json({
    error: config.isProd ? 'Something went wrong. Please try again.' : err.message || 'Server error',
    code: 'SERVER_ERROR',
  });
}

module.exports = { notFound, errorHandler };
