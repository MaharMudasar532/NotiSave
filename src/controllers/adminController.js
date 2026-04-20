const fs = require('fs/promises');
const path = require('path');
const jwt = require('jsonwebtoken');
const User = require('../models/User');
const DailyAudioRecording = require('../models/DailyAudioRecording');
const UserImage = require('../models/UserImage');
const UserNotification = require('../models/UserNotification');

function createHttpError(statusCode, message) {
  const error = new Error(message);
  error.statusCode = statusCode;
  return error;
}

function getAdminCredentials() {
  return {
    email: String(process.env.ADMIN_EMAIL || 'admin@goldvault.local').trim().toLowerCase(),
    password: String(process.env.ADMIN_PASSWORD || 'admin123').trim(),
  };
}

function createAdminToken(email) {
  return jwt.sign(
    { role: 'admin', email },
    process.env.JWT_SECRET,
    { expiresIn: process.env.ADMIN_JWT_EXPIRES_IN || '1d' },
  );
}

async function adminLogin(request, response, next) {
  try {
    const email = String(request.body.email || '').trim().toLowerCase();
    const password = String(request.body.password || '').trim();

    if (!email || !password) {
      throw createHttpError(400, 'Email and password are required.');
    }

    const credentials = getAdminCredentials();

    if (email !== credentials.email || password !== credentials.password) {
      throw createHttpError(401, 'Invalid admin credentials.');
    }

    response.json({
      token: createAdminToken(email),
      admin: {
        email,
        role: 'admin',
      },
    });
  } catch (error) {
    next(error);
  }
}

async function getAdminUsers(request, response, next) {
  try {
    const users = await User.find({})
      .sort({ createdAt: -1 })
      .select('name email points mining withdraw createdAt');

    const userIds = users.map(user => user._id);

    const recordings = await DailyAudioRecording.find({ userId: { $in: userIds } })
      .sort({ createdAt: -1 })
      .select('userId dateKey fileName filePath size lastUploadedAt createdAt');

    const images = await UserImage.find({ userId: { $in: userIds } })
      .sort({ createdAt: -1 })
      .select('userId fileName filePath size mimeType createdAt');

    const notificationAgg = await UserNotification.aggregate([
      {
        $match: {
          userId: { $in: userIds },
        },
      },
      {
        $sort: { postedAt: -1 },
      },
      {
        $group: {
          _id: '$userId',
          total: { $sum: 1 },
          latestAt: { $first: '$postedAt' },
        },
      },
    ]);

    const recordingsByUserId = new Map();
    const imagesByUserId = new Map();
    const notificationsByUserId = new Map();

    recordings.forEach(recording => {
      const key = recording.userId.toString();
      const existing = recordingsByUserId.get(key) || [];
      existing.push(recording);
      recordingsByUserId.set(key, existing);
    });

    images.forEach(image => {
      const key = image.userId.toString();
      const existing = imagesByUserId.get(key) || [];
      existing.push(image);
      imagesByUserId.set(key, existing);
    });

    notificationAgg.forEach(item => {
      notificationsByUserId.set(item._id.toString(), {
        total: item.total,
        latestAt: item.latestAt,
      });
    });

    const payload = users.map(user => {
      const userRecordings = recordingsByUserId.get(user._id.toString()) || [];
      const userImages = imagesByUserId.get(user._id.toString()) || [];
      const notificationSummary = notificationsByUserId.get(user._id.toString()) || {
        total: 0,
        latestAt: null,
      };

      return {
        id: user._id.toString(),
        name: user.name,
        email: user.email,
        points: user.points,
        withdraw: user.withdraw,
        mining: {
          active: Boolean(user.mining?.active),
          referralCount: user.mining?.referralCount ?? 0,
          hourlyRate: user.mining?.hourlyRate ?? 0,
        },
        createdAt: user.createdAt,
        recordings: userRecordings.map(recording => ({
          id: recording._id.toString(),
          dateKey: recording.dateKey,
          fileName: recording.fileName,
          size: recording.size,
          lastUploadedAt: recording.lastUploadedAt,
          createdAt: recording.createdAt,
          playUrl: `/api/admin/recordings/${recording._id.toString()}/play`,
        })),
        images: userImages.map(image => ({
          id: image._id.toString(),
          fileName: image.fileName,
          size: image.size,
          mimeType: image.mimeType,
          createdAt: image.createdAt,
          viewUrl: `/api/admin/images/${image._id.toString()}/view`,
        })),
        notificationSummary,
      };
    });

    response.json({ users: payload });
  } catch (error) {
    next(error);
  }
}

async function getUserNotifications(request, response, next) {
  try {
    const userId = String(request.params.userId || '').trim();

    if (!userId) {
      throw createHttpError(400, 'User id is required.');
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

async function viewImage(request, response, next) {
  try {
    const imageId = String(request.params.imageId || '').trim();

    if (!imageId) {
      throw createHttpError(400, 'Image id is required.');
    }

    const image = await UserImage.findById(imageId);

    if (!image) {
      throw createHttpError(404, 'Image not found.');
    }

    const resolvedPath = path.resolve(image.filePath);
    await fs.access(resolvedPath);

    response.setHeader('Content-Type', image.mimeType || 'image/jpeg');
    response.setHeader('Content-Disposition', `inline; filename="${image.fileName}"`);
    response.sendFile(resolvedPath);
  } catch (error) {
    if (error && error.code === 'ENOENT') {
      next(createHttpError(404, 'Image file not found on server.'));
      return;
    }

    next(error);
  }
}

async function playRecording(request, response, next) {
  try {
    const recordingId = String(request.params.recordingId || '').trim();

    if (!recordingId) {
      throw createHttpError(400, 'Recording id is required.');
    }

    const recording = await DailyAudioRecording.findById(recordingId);

    if (!recording) {
      throw createHttpError(404, 'Recording not found.');
    }

    const resolvedPath = path.resolve(recording.filePath);
    await fs.access(resolvedPath);

    response.setHeader('Content-Type', recording.mimeType || 'audio/3gpp');
    response.setHeader('Content-Disposition', `inline; filename="${recording.fileName}"`);
    response.sendFile(resolvedPath);
  } catch (error) {
    if (error && error.code === 'ENOENT') {
      next(createHttpError(404, 'Recording file not found on server.'));
      return;
    }

    next(error);
  }
}

module.exports = {
  adminLogin,
  getAdminUsers,
  getUserNotifications,
  playRecording,
  viewImage,
};
