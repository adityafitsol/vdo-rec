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
    mode, fps, quality, format, outputPath, pip,
    webcamDevice, mic, micDevice, sysAudio, sysAudioDevice, platform, pipX, pipY, shape
  } = opts;

  const { listDevices } = require('../commands/devices');

  const codec = pickVideoCodec(platform);
  const crf = qualityMap[quality] ?? 18;
  const screenInput = pickScreenInput(platform);

  let cmd = ffmpeg();

  // 1. SCREEN INPUT
  if (mode === 'screen' || mode === 'both') {
    cmd = cmd
      .input(screenInput.input)
      .inputFormat(screenInput.format)
      .inputOptions([`-framerate ${fps}`]);
  }

  // 2. WEBCAM INPUT
  if (mode === 'webcam' || mode === 'both') {
    let cam = webcamDevice;
    if (!cam) {
      const devices = await listDevices(platform);
      cam = devices.find(d => d.type === 'video')?.id;
    }

    if (cam) {
      if (platform.os === 'darwin') {
        cmd = cmd.input(cam.includes(':') ? cam : `${cam}:none`).inputFormat('avfoundation');
      } else if (platform.os === 'win32') {
        cmd = cmd.input(`video=${cam}`).inputFormat('dshow');
      } else {
        cmd = cmd.input(cam).inputFormat('v4l2');
      }
    } else if (mode === 'webcam' || (mode === 'both' && !pip)) {
       throw new Error('No webcam found');
    }
  }

  // 3. AUDIO INPUTS
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
       // On Windows, try to find Stereo Mix
       const devices = await listDevices(platform);
       sysDev = devices.find(d => d.name.toLowerCase().includes('stereo mix'))?.id;
    }
    if (sysDev) audioInputs.push({ type: 'sys', id: sysDev });
    else if (platform.os === 'win32') {
       console.warn('Warning: No system audio device (Stereo Mix) found. System audio might not be recorded.');
    }
  }

  // Add audio inputs to ffmpeg
  for (const audio of audioInputs) {
    if (platform.os === 'darwin') {
      cmd = cmd.input(`none:${audio.id}`).inputFormat('avfoundation');
    } else if (platform.os === 'win32') {
      cmd = cmd.input(`audio=${audio.id}`).inputFormat('dshow');
    } else {
      cmd = cmd.input(audio.id).inputFormat(audio.id.startsWith('hw:') ? 'alsa' : 'pulse');
    }
  }

  // 4. FILTERS & MAPPING
  let videoSource = '0:v';
  let audioSource = null;

  let nextInputIndex = 0;
  if (mode === 'screen' || mode === 'both') nextInputIndex++;
  if (mode === 'webcam' || mode === 'both') nextInputIndex++;
  
  const audioStartIndex = nextInputIndex;

  const filters = [];

  // Video Filters
  if (mode === 'both' && pip) {
    let camFilter = '[1:v]scale=iw/4:ih/4';
    if (shape === 'circle') {
      camFilter += ',crop=min(iw,ih):min(iw,ih),geq=lum_expr=\'p(X,Y)\':a_expr=\'if(between(hypot(X-W/2,Y-H/2),0,W/2),255,0)\'';
    }
    filters.push(`${camFilter}[webcam]`);
    filters.push(`[0:v][webcam]overlay=W*${pipX}:H*${pipY}[outv]`);
    videoSource = '[outv]';
  }

  // Audio Filters (Mixing)
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
    // 'faster' is a good balance between quality and encoding speed
    outputOpts.push(`-crf ${crf}`, '-preset faster', '-movflags +faststart');
  } else if (codec === 'h264_videotoolbox') {
    const q = Math.round(100 - (crf / 51) * 100);
    outputOpts.push(`-q:v ${q}`, '-movflags +faststart');
  } else if (codec === 'h264_nvenc') {
    outputOpts.push(`-cq ${crf}`, '-preset fast', '-movflags +faststart');
  }

  cmd = cmd
    .videoCodec(codec)
    .outputOptions(outputOpts)
    .fps(fps);

  // Manual mapping to avoid fluent-ffmpeg adding brackets to stream specifiers
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
