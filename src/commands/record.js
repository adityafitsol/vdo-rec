const fs = require('fs');
const chalk = require('chalk');

const { buildRecordingCommand } = require('../utils/ffmpeg');
const { resolveOutputPath } = require('./output');
const { printRecordingBanner, printSummary, formatDuration, formatBytes } = require('../utils/ui');
const { detectPlatform } = require('../utils/platform');

const recordingState = {
  active: false,
  startTime: null,
  outputPath: null,
  config: null,
};

// track the fluent-ffmpeg command object — after .run(), cmd.ffmpegProc has the child process
let activeCommand = null;
let stopRequested = false;

function getRecordingState() {
  return recordingState;
}

function stopRecording() {
  if (!recordingState.active || !activeCommand) return false;

  stopRequested = true;
  recordingState.active = false;

  // send 'q' to ffmpeg stdin — this is the ONLY way to stop ffmpeg gracefully
  // SIGTERM/SIGKILL leave the moov atom unwritten and the file is broken
  try {
    const proc = activeCommand.ffmpegProc;
    if (proc && proc.stdin && proc.stdin.writable) {
      proc.stdin.write('q\n');
    }
  } catch (e) {
    // stdin write failed — shouldn't happen but handle it
    console.error('Could not write to ffmpeg stdin:', e.message);
  }

  return true;
}

async function startRecording(opts) {
  const {
    screen = true,
    webcam = false,
    mic = false,
    pip = false,
    fps = 30,
    quality = 'high',
    format = 'mp4',
    out = './recordings',
    webcamDevice = null,
    micDevice = null,
    sysAudio = false,
    sysAudioDevice = null,
    pipX = 0.75,
    pipY = 0.75,
    shape = 'rectangle',
  } = opts;

  const platform = detectPlatform();

  let mode;
  if (screen && webcam) mode = 'both';
  else if (webcam) mode = 'webcam';
  else mode = 'screen';

  const outputPath = resolveOutputPath(out, format);

  let { cmd, codec } = await buildRecordingCommand({
    mode, fps, quality, format, outputPath, pip, webcamDevice, mic, micDevice, sysAudio, sysAudioDevice, platform, pipX, pipY, shape,
  });

  printRecordingBanner({ mode, fps, quality, format, outputPath, codec });

  let startTime = Date.now();
  let timerInterval = null;
  stopRequested = false;
  activeCommand = cmd;

  recordingState.active = true;
  recordingState.startTime = startTime;
  recordingState.outputPath = outputPath;
  recordingState.config = { mode, fps, quality, format, codec };

  function renderLiveStatus() {
    const elapsed = Math.floor((Date.now() - startTime) / 1000);
    const timeStr = formatDuration(elapsed);

    let sizeStr = '';
    try {
      const stat = fs.statSync(outputPath);
      sizeStr = chalk.gray(` · ${formatBytes(stat.size)}`);
    } catch (_) {}

    const dot = elapsed % 2 === 0 ? chalk.red('●') : chalk.red('○');
    process.stdout.write(`\r  ${dot} ${chalk.bold.white('REC')} ${chalk.cyan(timeStr)}${sizeStr}   `);
  }

  function startTimer() {
    renderLiveStatus();
    timerInterval = setInterval(renderLiveStatus, 1000);
  }

  function stopTimer() {
    if (timerInterval) {
      clearInterval(timerInterval);
      timerInterval = null;
      process.stdout.write('\n');
    }
  }

  return new Promise((resolve, reject) => {
    const sigintHandler = () => {
      if (stopRequested) return;
      stopTimer();
      console.log('\n' + chalk.yellow('  Stopping...'));
      stopRecording();
    };

    process.once('SIGINT', sigintHandler);

    cmd
      .on('start', () => {
        startTime = Date.now();
        recordingState.startTime = startTime;
        startTimer();
      })
      .on('error', async (err, stdout, stderr) => {
        stopTimer();
        recordingState.active = false;
        activeCommand = null;
        process.removeListener('SIGINT', sigintHandler);

        // if we stopped it intentionally, treat as success
        if (stopRequested) {
          const duration = Math.floor((Date.now() - startTime) / 1000);
          let size = 0;
          try { size = fs.statSync(outputPath).size; } catch (_) {}
          printSummary({ duration, size, path: outputPath });
          resolve({ outputPath, duration, size });
          return;
        }

        // codec failed — retry with libx264
        if (codec !== 'libx264') {
          console.log(chalk.yellow(`\n  Codec ${codec} failed, retrying with libx264...`));
          try {
            const fallback = buildRecordingCommand({
              mode, fps, quality, format, outputPath, pip, webcamDevice,
              platform: { ...platform, hasNvidia: false, hasAppleGPU: false },
            });
            cmd = fallback.cmd;
            codec = fallback.codec;
            activeCommand = cmd;
            recordingState.active = true;
            recordingState.config.codec = codec;
            runCmd(fallback.cmd);
            return;
          } catch (retryErr) {
            reject(retryErr);
            return;
          }
        }

        console.error(chalk.red('\n  Recording error:'), err.message);
        reject(err);
      })
      .on('end', () => {
        stopTimer();
        recordingState.active = false;
        activeCommand = null;
        process.removeListener('SIGINT', sigintHandler);

        const duration = Math.floor((Date.now() - startTime) / 1000);
        let size = 0;
        try { size = fs.statSync(outputPath).size; } catch (_) {}

        printSummary({ duration, size, path: outputPath });
        resolve({ outputPath, duration, size });
      });

    function runCmd(command) {
      command.run();
    }

    runCmd(cmd);
  });
}

module.exports = { startRecording, stopRecording, getRecordingState };
