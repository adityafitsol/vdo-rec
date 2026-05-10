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
 */
async function buildRecordingCommand(opts) {
  const {
    fps, quality, format, outputPath,
    mic, micDevice, sysAudio, sysAudioDevice, platform
  } = opts;

  const { listDevices } = require('../commands/devices');

  const codec = pickVideoCodec(platform);
  const crf = qualityMap[quality] ?? 18;
  const screenInput = pickScreenInput(platform);

  let cmd = ffmpeg();

  // 1. SCREEN INPUT
  cmd = cmd
    .input(screenInput.input)
    .inputFormat(screenInput.format)
    .inputOptions([`-framerate ${fps}`]);

  // 2. AUDIO INPUTS
  const audioInputs = [];
  if (mic) {
    let audioDev = micDevice;
    if (!audioDev) {
      const devices = await listDevices(platform);
      audioDev = devices.find(d => d.type === 'audio')?.id;
    }
    if (audioDev) audioInputs.push({ type: 'mic', id: audioDev });
  }

  if (sysAudio) {
    let sysDev = sysAudioDevice;
    if (!sysDev && platform.os === 'win32') {
       const devices = await listDevices(platform);
       sysDev = devices.find(d => d.name.toLowerCase().includes('stereo mix'))?.id;
    }
    if (sysDev) audioInputs.push({ type: 'sys', id: sysDev });
  }

  for (const audio of audioInputs) {
    if (platform.os === 'darwin') {
      cmd = cmd.input(`none:${audio.id}`).inputFormat('avfoundation');
    } else if (platform.os === 'win32') {
      cmd = cmd.input(`audio=${audio.id}`).inputFormat('dshow');
    } else {
      cmd = cmd.input(audio.id).inputFormat(audio.id.startsWith('hw:') ? 'alsa' : 'pulse');
    }
  }

  // 3. FILTERS & MAPPING
  let videoSource = '0:v';
  let audioSource = null;
  const audioStartIndex = 1; // Screen is always 0

  const filters = [];

  // Audio Mixing Filter
  if (audioInputs.length > 1) {
    const amixInputs = audioInputs.map((_, i) => `[${audioStartIndex + i}:a]`).join('');
    filters.push(`${amixInputs}amix=inputs=${audioInputs.length}[aout]`);
    audioSource = '[aout]';
  } else if (audioInputs.length === 1) {
    audioSource = `${audioStartIndex}:a`;
  }

  if (filters.length > 0) {
    cmd = cmd.complexFilter(filters);
  }

  // Build output options
  const outputOpts = ['-pix_fmt yuv420p'];
  if (codec === 'libx264') {
    outputOpts.push(`-crf ${crf}`, '-preset faster', '-movflags +faststart');
  } else if (codec === 'h264_videotoolbox') {
    const q = Math.round(100 - (crf / 51) * 100);
    outputOpts.push(`-q:v ${q}`, '-movflags +faststart');
  } else if (codec === 'h264_nvenc') {
    outputOpts.push(`-cq ${crf}`, '-preset fast', '-movflags +faststart');
  }

  cmd = cmd.videoCodec(codec).outputOptions(outputOpts).fps(fps);

  // Manual mapping
  if (videoSource.startsWith('[')) {
    cmd = cmd.map(videoSource);
  } else {
    cmd = cmd.outputOptions(`-map ${videoSource}`);
  }

  if (audioSource && format !== 'gif') {
    if (audioSource.startsWith('[')) {
      cmd = cmd.map(audioSource);
    } else {
      cmd = cmd.outputOptions(`-map ${audioSource}`);
    }
  } else {
    cmd = cmd.noAudio();
  }

  if (format === 'gif') {
    cmd = cmd
      .outputOptions([`-vf fps=${fps},scale=640:-1:flags=lanczos`])
      .outputOptions(['-loop 0']);
  }

  cmd = cmd.output(outputPath);

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
