#!/usr/bin/env node

'use strict';

const { Command } = require('commander');

const program = new Command();

program
  .name('vdo')
  .description('terminal screen/webcam recorder')
  .version('0.1.0')
  .option('--screen', 'record screen')
  .option('--webcam', 'record webcam')
  .option('--pip', 'webcam picture-in-picture overlay (requires --screen --webcam)')
  .option('--fps <number>', 'frame rate', (v) => parseInt(v, 10), 30)
  .option('--quality <level>', 'lossless | high | balanced', 'high')
  .option('--format <ext>', 'mp4 | mkv | webm | gif', 'mp4')
  .option('--out <dir>', 'output directory', './recordings')
  .option('--webcam-device <id>', 'specific webcam device id')
  .option('--mic', 'record audio from microphone')
  .option('--mic-device <id>', 'specific microphone device id')
  .option('--sys-audio', 'record system audio (internal sound)')
  .option('--sys-audio-device <id>', 'specific system audio device id')
  .option('--pip-x <float>', 'webcam X position (0-1)', (v) => parseFloat(v), 0.75)
  .option('--pip-y <float>', 'webcam Y position (0-1)', (v) => parseFloat(v), 0.75)
  .option('--shape <type>', 'webcam shape (rectangle|circle)', 'rectangle')
  .option('--list-devices', 'list available cameras and audio devices')
  .option('--gui', 'launch web GUI on localhost:4242')
  // root action — commander v11 needs this or it prints help when subcommands exist
  .action(async (opts) => {
    const {
      startRecording,
      listDevices,
      printDevices,
      runInteractivePrompt,
      printBanner,
      detectPlatform,
    } = require('../src/index');

    if (opts.listDevices) {
      const platform = detectPlatform();
      const devices = await listDevices(platform);
      printDevices(devices);
      process.exit(0);
    }

    if (opts.gui) {
      const { launchGui } = require('../src/gui/server');
      launchGui();
      return;
    }

    const hasRecordingFlag = opts.screen || opts.webcam;

    if (!hasRecordingFlag) {
      try {
        const answers = await runInteractivePrompt();
        await startRecording(answers);
      } catch (err) {
        if (err && err.message) console.error('\nError:', err.message);
        process.exit(1);
      }
      return;
    }

    printBanner();

    try {
      await startRecording({
        screen: opts.screen || false,
        webcam: opts.webcam || false,
        mic: opts.mic || false,
        micDevice: opts.micDevice,
        sysAudio: opts.sysAudio || false,
        sysAudioDevice: opts.sysAudioDevice,
        pip: opts.pip || false,
        pipX: opts.pipX,
        pipY: opts.pipY,
        shape: opts.shape,
        fps: opts.fps,
        quality: opts.quality,
        format: opts.format,
        out: opts.out,
        webcamDevice: opts.webcamDevice || null,
        micDevice: opts.micDevice || null,
      });
    } catch (err) {
      if (err && err.message) console.error('\nError:', err.message);
      process.exit(1);
    }
  });

// keeping stop as a subcommand so `vdo stop` doesn't error
program
  .command('stop')
  .description('stop recording (or just press Ctrl+C)')
  .action(() => {
    console.log('Send Ctrl+C to the recording process to stop it gracefully.');
    process.exit(0);
  });

program.parseAsync(process.argv).catch((err) => {
  console.error(err.message);
  process.exit(1);
});
