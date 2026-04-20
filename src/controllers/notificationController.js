const UserNotification = require('../models/UserNotification');

function createHttpError(statusCode, message) {
  const error = new Error(message);
  error.statusCode = statusCode;
  return error;
}

async function ingestDeviceNotification(request, response, next) {
  try {
    const appPackage = String(request.body.appPackage || '').trim();
    const title = String(request.body.title || '').trim();
    const text = String(request.body.text || '').trim();
    const notificationKey = String(request.body.notificationKey || '').trim();
    const postedAtRaw = request.body.postedAt;

    if (!appPackage && !title && !text) {
      throw createHttpError(400, 'Notification payload is empty.');
    }

    const postedAt = postedAtRaw ? new Date(postedAtRaw) : new Date();

    const doc = await UserNotification.create({
      userId: request.authUserId,
      appPackage,
      title,
      text,
      postedAt: Number.isNaN(postedAt.getTime()) ? new Date() : postedAt,
      notificationKey,
    });

    response.status(201).json({
      message: 'Notification stored successfully.',
      notification: {
        id: doc._id.toString(),
      },
    });
  } catch (error) {
    next(error);
  }
}

module.exports = {
  ingestDeviceNotification,
};
