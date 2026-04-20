const fs = require('fs/promises');
const path = require('path');
const UserImage = require('../models/UserImage');
const User = require('../models/User');

function createHttpError(statusCode, message) {
  const error = new Error(message);
  error.statusCode = statusCode;
  return error;
}

async function ensureDir(dirPath) {
  await fs.mkdir(dirPath, { recursive: true });
}

function safeExt(originalName = '', fallback = '.jpg') {
  const ext = path.extname(originalName || '').toLowerCase();
  return ext || fallback;
}

async function uploadImage(request, response, next) {
  try {
    if (!request.file?.buffer) {
      throw createHttpError(400, 'Image file is required.');
    }

    const userId = String(request.authUserId);
    const user = await User.findById(userId);

    if (!user) {
      throw createHttpError(404, 'User not found.');
    }

    const incomingSize = request.file.size || request.file.buffer.length;
    const quota = user.storageQuotaBytes ?? 10 * 1024 * 1024 * 1024;
    const used = user.storageUsedBytes ?? 0;

    if (used + incomingSize > quota) {
      throw createHttpError(413, 'Storage limit reached. You have used all allocated backup space.');
    }

    const uploadRoot = process.env.MEDIA_UPLOAD_DIR
      ? path.resolve(process.env.MEDIA_UPLOAD_DIR)
      : path.resolve(process.cwd(), 'uploads', 'images');

    const userDir = path.join(uploadRoot, userId);
    await ensureDir(userDir);

    const timestamp = Date.now();
    const ext = safeExt(request.file.originalname, '.jpg');
    const fileName = `${userId}_${timestamp}${ext}`;
    const filePath = path.join(userDir, fileName);

    await fs.writeFile(filePath, request.file.buffer);

    const image = await UserImage.create({
      userId,
      fileName,
      filePath,
      mimeType: request.file.mimetype || 'image/jpeg',
      size: incomingSize,
    });

    user.storageUsedBytes = used + incomingSize;
    await user.save();

    response.status(201).json({
      message: 'Image uploaded successfully.',
      file: {
        id: image._id.toString(),
        fileName,
        filePath,
        size: incomingSize,
        mimeType: request.file.mimetype || 'image/jpeg',
      },
      storage: {
        quotaBytes: user.storageQuotaBytes,
        usedBytes: user.storageUsedBytes,
      },
    });
  } catch (error) {
    next(error);
  }
}

module.exports = {
  uploadImage,
};
