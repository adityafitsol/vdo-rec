// wires everything together
const { startRecording, stopRecording, getRecordingState } = require('./commands/record');
const { listDevices, printDevices } = require('./commands/devices');
const { runInteractivePrompt, printBanner } = require('./utils/ui');
const { detectPlatform } = require('./utils/platform');

module.exports = {
  startRecording,
  stopRecording,
  getRecordingState,
  listDevices,
  printDevices,
  runInteractivePrompt,
  printBanner,
  detectPlatform,
};
