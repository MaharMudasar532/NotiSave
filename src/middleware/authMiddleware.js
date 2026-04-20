const jwt = require('jsonwebtoken');

function createHttpError(statusCode, message) {
  const error = new Error(message);
  error.statusCode = statusCode;
  return error;
}

function requireAuth(request, _response, next) {
  try {
    const authorization = request.headers.authorization || '';

    if (!authorization.startsWith('Bearer ')) {
      throw createHttpError(401, 'Authorization token is required.');
    }

    const token = authorization.replace('Bearer ', '').trim();
    const payload = jwt.verify(token, process.env.JWT_SECRET);

    request.authUserId = payload.sub;
    next();
  } catch (error) {
    next(error.statusCode ? error : createHttpError(401, 'Invalid or expired token.'));
  }
}

module.exports = {
  requireAuth,
};