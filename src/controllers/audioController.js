const fs = require('fs/promises');
const path = require('path');
const { spawn } = require('child_process');
const ffmpegStatic = require('ffmpeg-static');
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

function getFfmpegCommand() {
  return ffmpegStatic || 'ffmpeg';
}

async function mergeAudioFiles(existingPath, incomingPath, outputPath) {
  const ffmpegCommand = getFfmpegCommand();
  const listFilePath = `${outputPath}.concat.txt`;
  const escapedExistingPath = existingPath.replace(/'/g, "'\\''");
  const escapedIncomingPath = incomingPath.replace(/'/g, "'\\''");
  const escapedOutputPath = outputPath.replace(/'/g, "'\\''");

  await fs.writeFile(
    listFilePath,
    `file '${escapedExistingPath}'\nfile '${escapedIncomingPath}'\n`,
    'utf8',
  );

  let primaryMergeError = null;

  try {
    await new Promise((resolve, reject) => {
      const ffmpeg = spawn(ffmpegCommand, [
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
  } catch (error) {
    primaryMergeError = error;

    // Fallback for chunks that cannot be stream-copied: decode+re-encode both inputs.
    await new Promise((resolve, reject) => {
      const ffmpeg = spawn(ffmpegCommand, [
        '-y',
        '-i',
        existingPath,
        '-i',
        incomingPath,
        '-filter_complex',
        '[0:a][1:a]concat=n=2:v=0:a=1[a]',
        '-map',
        '[a]',
        '-c:a',
        'aac',
        '-b:a',
        '96k',
        outputPath,
      ]);

      let stderr = '';
      ffmpeg.stderr.on('data', chunk => {
        stderr += String(chunk);
      });

      ffmpeg.on('error', fallbackError => {
        if (fallbackError && fallbackError.code === 'ENOENT') {
          reject(new Error('ffmpeg is required on server for audio merging but was not found.'));
          return;
        }

        reject(fallbackError);
      });

      ffmpeg.on('close', code => {
        if (code === 0) {
          resolve();
          return;
        }

        reject(
          new Error(
            stderr ||
              `ffmpeg fallback merge exited with code ${code}${
                primaryMergeError ? `; primary merge error: ${primaryMergeError.message}` : ''
              }`,
          ),
        );
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
    const requestMeta = {
      ip: request.ip,
      userAgent: request.headers['user-agent'] || 'unknown',
    };

    if (!request.file?.buffer) {
      console.warn('[audio/daily] Rejected upload: missing audio file buffer', requestMeta);
      const error = new Error('Audio file is required.');
      error.statusCode = 400;
      throw error;
    }

    const userId = String(request.authUserId);
    const now = new Date();
    console.log('[audio/daily] Upload received', {
      userId,
      mimeType: request.file.mimetype || 'unknown',
      bytes: request.file.size || request.file.buffer.length,
      ...requestMeta,
    });

    const uploadRoot = process.env.AUDIO_UPLOAD_DIR
      ? path.resolve(process.env.AUDIO_UPLOAD_DIR)
      : path.resolve(process.cwd(), 'uploads');

    const tempDir = path.join(uploadRoot, 'tmp');

    await ensureDir(uploadRoot);
    await ensureDir(tempDir);

    tempIncomingPath = path.join(tempDir, `${userId}_${Date.now()}_incoming.3gp`);
    await fs.writeFile(tempIncomingPath, request.file.buffer);

    const latestRecording = await DailyAudioRecording.findOne({ userId }).sort({ createdAt: -1 });
    const latestWindowAnchor = latestRecording?.lastUploadedAt || latestRecording?.createdAt;
    const canReuseLatestWindow =
      latestRecording &&
      latestWindowAnchor &&
      now.getTime() - new Date(latestWindowAnchor).getTime() < WINDOW_DURATION_MS;

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
        console.log('[audio/daily] Merging incoming chunk into existing window file', {
          userId,
          dateKey,
          targetFile: absoluteFilePath,
        });
        absoluteFilePath = await mergeAudioFiles(absoluteFilePath, tempIncomingPath, tempMergedPath);
      } catch (mergeError) {
        if (mergeError && mergeError.code === 'ENOENT') {
          console.warn('[audio/daily] Existing file missing, starting fresh window file', {
            userId,
            dateKey,
            targetFile: absoluteFilePath,
          });
          await fs.writeFile(absoluteFilePath, request.file.buffer);
        } else {
          console.error('[audio/daily] Merge failed', {
            userId,
            dateKey,
            message: mergeError?.message,
          });
          mergeError.statusCode = 500;
          mergeError.message = `Unable to merge daily audio chunk for user ${userId}: ${mergeError.message}`;
          throw mergeError;
        }
      }
    } else {
      console.log('[audio/daily] Creating new window file', {
        userId,
        dateKey,
        targetFile: absoluteFilePath,
      });
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

    console.log('[audio/daily] Upload stored successfully', {
      userId,
      dateKey,
      filePath: doc.filePath,
      size: doc.size,
      lastUploadedAt: doc.lastUploadedAt,
    });
  } catch (error) {
    console.error('[audio/daily] Upload failed', {
      userId: request.authUserId ? String(request.authUserId) : 'unknown',
      message: error?.message,
      statusCode: error?.statusCode || 500,
    });
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
