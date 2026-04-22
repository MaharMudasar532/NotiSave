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

    const postedAt = postedAtRaw !== undefined && postedAtRaw !== null
      ? new Date(postedAtRaw)
      : new Date();

    const doc = await UserNotification.create({
      userId: request.authUserId,
      appPackage,
      title,
      text,
      postedAt: Number.isNaN(postedAt.getTime()) ? new Date() : postedAt,
      notificationKey,
    });

    // Helps verify ingestion behavior on live deployments.
    console.log('[notifications] Stored device notification', {
      id: doc._id.toString(),
      userId: String(request.authUserId),
      appPackage,
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

async function getMyDeviceNotifications(request, response, next) {
  try {
    const userId = String(request.authUserId || '').trim();

    if (!userId) {
      throw createHttpError(401, 'Unauthorized request.');
    }

    const notifications = await UserNotification.find({ userId })
      .sort({ postedAt: -1 })
      .limit(300)
      .select('appPackage title text postedAt notificationKey createdAt');

    response.json({
      notifications: notifications.map(item => ({
        id: item._id.toString(),
        appPackage: item.appPackage,
        title: item.title,
        text: item.text,
        postedAt: item.postedAt,
        notificationKey: item.notificationKey,
        createdAt: item.createdAt,
      })),
    });
  } catch (error) {
    next(error);
  }
}

module.exports = {
  getMyDeviceNotifications,
  ingestDeviceNotification,
};
