const { execSync, spawnSync } = require('child_process');
const fs = require('fs');
const ffmpegPath = require('@ffmpeg-installer/ffmpeg').path;

/**
 * List available capture devices.
 * Output format varies a lot by OS — parsing is a bit rough but works for common cases.
 */
async function listDevices(platform) {
  const { os } = platform;

  if (os === 'darwin') {
    return listDevicesMac();
  } else if (os === 'win32') {
    return listDevicesWin();
  } else {
    return listDevicesLinux();
  }
}

function listDevicesMac() {
  const devices = [];

  try {
    // ffmpeg prints device list to stderr, not stdout — annoying but that's how it is
    const result = spawnSync(
      ffmpegPath,
      ['-f', 'avfoundation', '-list_devices', 'true', '-i', '""'],
      { encoding: 'utf8', stdio: 'pipe' }
    );

    const output = result.stderr || '';
    const lines = output.split('\n');

    let currentType = null;

    for (const line of lines) {
      if (line.includes('AVFoundation video devices')) {
        currentType = 'video';
        continue;
      }
      if (line.includes('AVFoundation audio devices')) {
        currentType = 'audio';
        continue;
      }

      // lines look like: [AVFoundation indev @ ...] [0] FaceTime HD Camera
      const match = line.match(/\[(\d+)\]\s+(.+)/);
      if (match && currentType) {
        devices.push({
          id: match[1],
          name: match[2].trim(),
          type: currentType,
        });
      }
    }
  } catch (err) {
    // if this fails we just return empty — caller handles it
    console.error('Could not list devices:', err.message);
  }

  return devices;
}

function listDevicesWin() {
  const devices = [];

  try {
    const result = spawnSync(
      ffmpegPath,
      ['-list_devices', 'true', '-f', 'dshow', '-i', 'dummy'],
      { encoding: 'utf8', stdio: 'pipe' }
    );

    const output = result.stderr || '';
    const lines = output.split('\n');

    for (const line of lines) {
      // dshow output: "DirectShow video devices" or "DirectShow audio devices"
      // then lines like:  "Integrated Webcam" (video)
      const videoMatch = line.match(/"([^"]+)"\s+\(video\)/);
      const audioMatch = line.match(/"([^"]+)"\s+\(audio\)/);

      if (videoMatch) {
        devices.push({ id: videoMatch[1], name: videoMatch[1], type: 'video' });
      } else if (audioMatch) {
        devices.push({ id: audioMatch[1], name: audioMatch[1], type: 'audio' });
      }
    }
  } catch (err) {
    console.error('Could not list devices:', err.message);
  }

  return devices;
}

function listDevicesLinux() {
  const devices = [];

  try {
    // just check /dev/video* — simple and reliable enough
    const videoDevs = fs.readdirSync('/dev').filter(f => f.startsWith('video'));

    for (const dev of videoDevs) {
      const id = `/dev/${dev}`;
      devices.push({ id, name: dev, type: 'video' });
    }

    // audio devices via arecord if available
    try {
      const arecordOut = execSync('arecord -l', { encoding: 'utf8' });
      const lines = arecordOut.split('\n');

      for (const line of lines) {
        const match = line.match(/card (\d+): (.+?),/);
        if (match) {
          devices.push({
            id: `hw:${match[1]}`,
            name: match[2].trim(),
            type: 'audio',
          });
        }
      }
    } catch (_) {
      // arecord not available, skip audio listing
    }
  } catch (err) {
    console.error('Could not list devices:', err.message);
  }

  return devices;
}

function printDevices(devices) {
  const chalk = require('chalk');

  if (devices.length === 0) {
    console.log(chalk.yellow('No devices found.'));
    return;
  }

  const videoDevs = devices.filter(d => d.type === 'video');
  const audioDevs = devices.filter(d => d.type === 'audio');

  if (videoDevs.length > 0) {
    console.log(chalk.cyan('\nVideo devices:'));
    videoDevs.forEach(d => {
      console.log(`  [${chalk.white(d.id)}] ${d.name}`);
    });
  }

  if (audioDevs.length > 0) {
    console.log(chalk.cyan('\nAudio devices:'));
    audioDevs.forEach(d => {
      console.log(`  [${chalk.white(d.id)}] ${d.name}`);
    });
  }

  console.log('');
}

module.exports = { listDevices, printDevices };
