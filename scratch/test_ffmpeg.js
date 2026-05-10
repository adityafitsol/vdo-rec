const path = require('path');
const root = process.cwd();
const devicesMod = require(path.join(root, 'src/commands/devices'));

// Mock listDevices
devicesMod.listDevices = async (platform) => {
  return [
    { id: 'Integrated Webcam', name: 'Integrated Webcam', type: 'video' },
    { id: 'Microphone Array (Realtek(R) Audio)', name: 'Microphone Array (Realtek(R) Audio)', type: 'audio' }
  ];
};

const { buildRecordingCommand } = require(path.join(root, 'src/utils/ffmpeg'));
const { detectPlatform } = require(path.join(root, 'src/utils/platform'));

async function test() {
  const platform = detectPlatform();
  console.log('Platform:', platform.os);

  const testCases = [
    { mode: 'screen', mic: true, label: 'Screen + Mic' },
    { mode: 'webcam', mic: false, label: 'Webcam only' },
    { mode: 'both', mic: true, pip: true, pipX: 0.7, pipY: 0.7, shape: 'circle', label: 'Both + Mic + PiP + Circle' },
  ];

  for (const tc of testCases) {
    console.log(`\n--- Test Case: ${tc.label} ---`);
    try {
      const { cmd } = await buildRecordingCommand({
        ...tc,
        fps: 30,
        quality: 'high',
        format: 'mp4',
        outputPath: 'test.mp4',
        platform
      });
      
      const args = cmd._getArguments();
      console.log('FFmpeg Args:', args.join(' '));
    } catch (err) {
      console.error('Error:', err.message);
    }
  }
}

test();
