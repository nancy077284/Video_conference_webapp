class ApiError extends Error {
  constructor(status, message, code) {
    super(message);
    this.status = status;
    this.code = code || ApiError.codeFor(status);
    this.expected = true;
  }

  static codeFor(status) {
    const map = {
      400: 'BAD_REQUEST',
      401: 'UNAUTHORIZED',
      403: 'FORBIDDEN',
      404: 'NOT_FOUND',
      409: 'CONFLICT',
      422: 'UNPROCESSABLE',
      429: 'RATE_LIMITED',
      500: 'SERVER_ERROR',
      502: 'BAD_GATEWAY',
      503: 'UNAVAILABLE',
    };
    return map[status] || 'ERROR';
  }

  static badRequest(msg, code) {
    return new ApiError(400, msg || 'Invalid request', code);
  }
  static unauthorized(msg) {
    return new ApiError(401, msg || 'Authentication required');
  }
  static forbidden(msg) {
    return new ApiError(403, msg || 'You do not have permission to do that');
  }
  static notFound(msg) {
    return new ApiError(404, msg || 'Resource not found');
  }
  static conflict(msg, code) {
    return new ApiError(409, msg || 'Conflict', code);
  }
  static tooMany(msg) {
    return new ApiError(429, msg || 'Too many requests. Please slow down.');
  }
}

module.exports = ApiError;
