const ffmpeg = require('fluent-ffmpeg');
const ffmpegPath = require('@ffmpeg-installer/ffmpeg').path;

ffmpeg.setFfmpegPath(ffmpegPath);

const qualityMap = {
  lossless: 0,
  high: 18,
  balanced: 28,
};

function pickVideoCodec(platform) {
  const { os, hasNvidia, hasAppleGPU } = platform;

  if (os === 'darwin' && hasAppleGPU) return 'h264_videotoolbox';
  if (os === 'win32' && hasNvidia) return 'h264_nvenc';

  // libx264 works everywhere — hardware encoders are faster but need extra setup
  return 'libx264';
}

function pickScreenInput(platform) {
  const { os } = platform;

  if (os === 'win32') return { format: 'gdigrab', input: 'desktop' };

  if (os === 'darwin') {
    // TODO: let user pick screen index for multi-monitor setups
    return { format: 'avfoundation', input: '1:0' };
  }

  const display = process.env.DISPLAY || ':0';
  return { format: 'x11grab', input: display };
}

/**
 * Build a fluent-ffmpeg command ready to .run().
 * The key thing here is pix_fmt yuv420p — without it, gdigrab gives us bgra
 * which libx264 encodes as yuv444p and most players refuse to play it.
 */
function buildRecordingCommand(opts) {
  const { mode, fps, quality, format, outputPath, pip, webcamDevice, platform } = opts;

  const codec = pickVideoCodec(platform);
  const crf = qualityMap[quality] ?? 18;
  const screenInput = pickScreenInput(platform);

  let cmd = ffmpeg();

  if (mode === 'screen' || mode === 'both') {
    cmd = cmd
      .input(screenInput.input)
      .inputFormat(screenInput.format)
      .inputOptions([`-framerate ${fps}`]);
  }

  if (mode === 'webcam' || mode === 'both') {
    const camDevice = webcamDevice || getDefaultWebcamDevice(platform);

    if (platform.os === 'darwin') {
      cmd = cmd.input('0:0').inputFormat('avfoundation');
    } else if (platform.os === 'win32') {
      cmd = cmd.input(`video=${camDevice}`).inputFormat('dshow');
    } else {
      cmd = cmd.input(camDevice || '/dev/video0').inputFormat('v4l2');
    }
  }

  // pip — webcam bottom-right, 1/4 screen size
  if (mode === 'both' && pip) {
    cmd = cmd.complexFilter([
      '[1:v]scale=iw/4:ih/4[webcam]',
      '[0:v][webcam]overlay=W-w-10:H-h-10[out]',
    ], 'out');
  }

  // build output options per codec
  // pix_fmt yuv420p is critical — it's what every player expects
  // without it, gdigrab's bgra input causes libx264 to output yuv444p which breaks playback
  const outputOpts = ['-pix_fmt yuv420p'];

  if (codec === 'libx264') {
    outputOpts.push(`-crf ${crf}`, '-preset ultrafast', '-movflags +faststart');
  } else if (codec === 'h264_videotoolbox') {
    // videotoolbox uses quality factor 1-100, not crf
    const q = Math.round(100 - (crf / 51) * 100);
    outputOpts.push(`-q:v ${q}`, '-movflags +faststart');
  } else if (codec === 'h264_nvenc') {
    // nvenc equivalent of crf is -cq
    outputOpts.push(`-cq ${crf}`, '-preset fast', '-movflags +faststart');
  }

  cmd = cmd
    .videoCodec(codec)
    .outputOptions(outputOpts)
    .fps(fps)
    .output(outputPath);

  // gif: no audio, scale to 640px wide, lanczos for quality
  if (format === 'gif') {
    cmd = cmd
      .noAudio()
      .outputOptions([`-vf fps=${fps},scale=640:-1:flags=lanczos`])
      .outputOptions(['-loop 0']);
  }

  return { cmd, codec };
}

function getDefaultWebcamDevice(platform) {
  if (platform.os === 'linux') return '/dev/video0';
  return null;
}

module.exports = {
  ffmpeg,
  pickVideoCodec,
  pickScreenInput,
  buildRecordingCommand,
};
