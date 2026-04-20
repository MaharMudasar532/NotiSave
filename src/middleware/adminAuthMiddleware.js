const jwt = require('jsonwebtoken');

function createHttpError(statusCode, message) {
  const error = new Error(message);
  error.statusCode = statusCode;
  return error;
}

function extractToken(request) {
  const authorization = request.headers.authorization || '';

  if (authorization.startsWith('Bearer ')) {
    return authorization.replace('Bearer ', '').trim();
  }

  const queryToken = String(request.query.adminToken || request.query.token || '').trim();
  return queryToken || null;
}

function requireAdminAuth(request, _response, next) {
  try {
    const token = extractToken(request);

    if (!token) {
      throw createHttpError(401, 'Admin authorization token is required.');
    }

    const payload = jwt.verify(token, process.env.JWT_SECRET);

    if (payload.role !== 'admin') {
      throw createHttpError(403, 'Admin access is required.');
    }

    request.admin = {
      email: payload.email,
      role: payload.role,
    };

    next();
  } catch (error) {
    next(error.statusCode ? error : createHttpError(401, 'Invalid or expired admin token.'));
  }
}

module.exports = {
  requireAdminAuth,
};
