const ora = require('ora');
const chalk = require('chalk');
const inquirer = require('inquirer');

// minimal, not cringe
function printBanner() {
  const art = `
  ██╗   ██╗██████╗  ██████╗
  ██║   ██║██╔══██╗██╔═══██╗
  ██║   ██║██║  ██║██║   ██║
  ╚██╗ ██╔╝██║  ██║██║   ██║
   ╚████╔╝ ██████╔╝╚██████╔╝
    ╚═══╝  ╚═════╝  ╚═════╝
  `;
  console.log(chalk.cyan(art));
  console.log(chalk.gray('  records your screen. that\'s it.\n'));
}

function printRecordingBanner(config) {
  console.log('\n' + chalk.green('● Recording started'));
  console.log(chalk.gray('  mode    ') + chalk.white(config.mode));
  console.log(chalk.gray('  fps     ') + chalk.white(config.fps));
  console.log(chalk.gray('  quality ') + chalk.white(config.quality));
  console.log(chalk.gray('  format  ') + chalk.white(config.format));
  console.log(chalk.gray('  output  ') + chalk.white(config.outputPath));
  if (config.codec) {
    console.log(chalk.gray('  codec   ') + chalk.white(config.codec));
  }
  console.log('');
  console.log(chalk.gray('  Press Ctrl+C to stop recording\n'));
}

function printSummary({ duration, size, path: outputPath }) {
  console.log('\n' + chalk.green('✓ Recording saved'));
  console.log(chalk.gray('  duration ') + chalk.white(formatDuration(duration)));
  console.log(chalk.gray('  size     ') + chalk.white(formatBytes(size)));
  console.log(chalk.gray('  path     ') + chalk.cyan(outputPath));
  console.log('');
}

function createSpinner(text) {
  return ora({ text, color: 'cyan' });
}

// formats seconds into mm:ss
function formatDuration(seconds) {
  const m = Math.floor(seconds / 60).toString().padStart(2, '0');
  const s = (seconds % 60).toString().padStart(2, '0');
  return `${m}:${s}`;
}

function formatBytes(bytes) {
  if (!bytes || bytes === 0) return '0 B';
  const units = ['B', 'KB', 'MB', 'GB'];
  const i = Math.floor(Math.log(bytes) / Math.log(1024));
  return `${(bytes / Math.pow(1024, i)).toFixed(1)} ${units[i]}`;
}

/**
 * Interactive prompt for when vdo is run with no args.
 * inquirer v8 — returns a promise.
 */
async function runInteractivePrompt() {
  printBanner();

  const answers = await inquirer.prompt([
    {
      type: 'list',
      name: 'mode',
      message: 'What do you want to record?',
      choices: [
        { name: 'Screen', value: 'screen' },
        { name: 'Webcam', value: 'webcam' },
        { name: 'Screen + Webcam (picture-in-picture)', value: 'both' },
      ],
      default: 'screen',
    },
    {
      type: 'list',
      name: 'fps',
      message: 'Frame rate?',
      choices: [
        { name: '24 fps', value: 24 },
        { name: '30 fps (default)', value: 30 },
        { name: '60 fps', value: 60 },
      ],
      default: 30,
    },
    {
      type: 'list',
      name: 'quality',
      message: 'Quality?',
      choices: [
        { name: 'Lossless (huge files)', value: 'lossless' },
        { name: 'High (default)', value: 'high' },
        { name: 'Balanced (smaller files)', value: 'balanced' },
      ],
      default: 'high',
    },
    {
      type: 'list',
      name: 'format',
      message: 'Output format?',
      choices: ['mp4', 'mkv', 'webm', 'gif'],
      default: 'mp4',
    },
    {
      type: 'input',
      name: 'out',
      message: 'Output folder?',
      default: './recordings',
    },
    {
      type: 'confirm',
      name: 'pip',
      message: 'Enable picture-in-picture webcam overlay?',
      default: false,
      // only ask this if mode is 'both'
      when: (ans) => ans.mode === 'both',
    },
  ]);

  return {
    screen: answers.mode === 'screen' || answers.mode === 'both',
    webcam: answers.mode === 'webcam' || answers.mode === 'both',
    pip: answers.pip || false,
    fps: answers.fps,
    quality: answers.quality,
    format: answers.format,
    out: answers.out,
  };
}

module.exports = {
  printBanner,
  printRecordingBanner,
  printSummary,
  createSpinner,
  formatDuration,
  formatBytes,
  runInteractivePrompt,
};
