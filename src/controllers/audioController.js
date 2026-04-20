const fs = require('fs/promises');
const path = require('path');
const { spawn } = require('child_process');
const DailyAudioRecording = require('../models/DailyAudioRecording');

const WINDOW_DURATION_MS = 24 * 60 * 60 * 1000;

function getWindowKey(date = new Date()) {
  const year = date.getUTCFullYear();
  const month = String(date.getUTCMonth() + 1).padStart(2, '0');
  const day = String(date.getUTCDate()).padStart(2, '0');
  const hours = String(date.getUTCHours()).padStart(2, '0');
  const minutes = String(date.getUTCMinutes()).padStart(2, '0');
  return `${year}-${month}-${day}_${hours}-${minutes}`;
}

async function ensureDir(dirPath) {
  await fs.mkdir(dirPath, { recursive: true });
}

async function mergeAudioFiles(existingPath, incomingPath, outputPath) {
  const listFilePath = `${outputPath}.concat.txt`;
  const escapedExistingPath = existingPath.replace(/'/g, "'\\''");
  const escapedIncomingPath = incomingPath.replace(/'/g, "'\\''");
  const escapedOutputPath = outputPath.replace(/'/g, "'\\''");

  await fs.writeFile(
    listFilePath,
    `file '${escapedExistingPath}'\nfile '${escapedIncomingPath}'\n`,
    'utf8',
  );

  try {
    await new Promise((resolve, reject) => {
      const ffmpeg = spawn('ffmpeg', [
        '-y',
        '-f',
        'concat',
        '-safe',
        '0',
        '-i',
        listFilePath,
        '-c',
        'copy',
        outputPath,
      ]);

      let stderr = '';
      ffmpeg.stderr.on('data', chunk => {
        stderr += String(chunk);
      });

      ffmpeg.on('error', error => {
        if (error && error.code === 'ENOENT') {
          reject(new Error('ffmpeg is required on server for audio merging but was not found.'));
          return;
        }

        reject(error);
      });

      ffmpeg.on('close', code => {
        if (code === 0) {
          resolve();
          return;
        }

        reject(new Error(stderr || `ffmpeg exited with code ${code}`));
      });
    });
  } finally {
    await fs.rm(listFilePath, { force: true });
  }

  // Keep same file path for active window by replacing previous file atomically.
  await fs.rm(existingPath, { force: true });
  await fs.rename(outputPath, existingPath);

  return existingPath;
}

async function uploadDailyAudio(request, response, next) {
  let tempIncomingPath = null;
  let tempMergedPath = null;

  try {
    if (!request.file?.buffer) {
      const error = new Error('Audio file is required.');
      error.statusCode = 400;
      throw error;
    }

    const userId = String(request.authUserId);
    const now = new Date();

    const uploadRoot = process.env.AUDIO_UPLOAD_DIR
      ? path.resolve(process.env.AUDIO_UPLOAD_DIR)
      : path.resolve(process.cwd(), 'uploads');

    const tempDir = path.join(uploadRoot, 'tmp');

    await ensureDir(uploadRoot);
    await ensureDir(tempDir);

    tempIncomingPath = path.join(tempDir, `${userId}_${Date.now()}_incoming.3gp`);
    await fs.writeFile(tempIncomingPath, request.file.buffer);

    const latestRecording = await DailyAudioRecording.findOne({ userId }).sort({ createdAt: -1 });
    const canReuseLatestWindow =
      latestRecording &&
      now.getTime() - new Date(latestRecording.createdAt).getTime() < WINDOW_DURATION_MS;

    const dateKey = canReuseLatestWindow ? latestRecording.dateKey : getWindowKey(now);
    const fileName = canReuseLatestWindow
      ? latestRecording.fileName
      : `${userId}_${dateKey}.3gp`;
    let absoluteFilePath = canReuseLatestWindow
      ? latestRecording.filePath
      : path.join(uploadRoot, fileName);

    if (canReuseLatestWindow) {
      try {
        await fs.access(absoluteFilePath);
        tempMergedPath = path.join(tempDir, `${userId}_${Date.now()}_merged.3gp`);
        absoluteFilePath = await mergeAudioFiles(absoluteFilePath, tempIncomingPath, tempMergedPath);
      } catch {
        // If previous file is missing/corrupt, reset window file with latest chunk.
        await fs.writeFile(absoluteFilePath, request.file.buffer);
      }
    } else {
      await fs.writeFile(absoluteFilePath, request.file.buffer);
    }

    const stats = await fs.stat(absoluteFilePath);

    const doc = await DailyAudioRecording.findOneAndUpdate(
      { userId, dateKey },
      {
        userId,
        dateKey,
        fileName,
        filePath: absoluteFilePath,
        mimeType: request.file.mimetype || 'audio/3gpp',
        size: stats.size,
        lastUploadedAt: new Date(),
      },
      {
        new: true,
        upsert: true,
        setDefaultsOnInsert: true,
      },
    );

    response.json({
      message: 'Audio saved successfully.',
      recording: {
        id: doc._id.toString(),
        userId,
        dateKey,
        fileName: doc.fileName,
        filePath: doc.filePath,
        size: doc.size,
        lastUploadedAt: doc.lastUploadedAt,
      },
    });
  } catch (error) {
    next(error);
  } finally {
    if (tempIncomingPath) {
      await fs.rm(tempIncomingPath, { force: true });
    }

    if (tempMergedPath) {
      await fs.rm(tempMergedPath, { force: true });
    }
  }
}

module.exports = {
  uploadDailyAudio,
};
