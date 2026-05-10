const { execSync } = require('child_process');

// figure out what machine we're running on so we can pick the right codec later
function detectPlatform() {
  const os = process.platform; // 'win32' | 'darwin' | 'linux'
  const arch = process.arch;

  let hasNvidia = false;
  let hasAppleGPU = false;

  if (os === 'win32' || os === 'linux') {
    try {
      execSync('nvidia-smi', { stdio: 'ignore' });
      hasNvidia = true;
    } catch (_) {
      // no nvidia, that's fine
    }
  }

  if (os === 'darwin') {
    try {
      const out = execSync('system_profiler SPDisplaysDataType', { encoding: 'utf8' });
      // apple silicon or any apple gpu really
      hasAppleGPU = out.includes('Apple') || out.includes('M1') || out.includes('M2') || out.includes('M3');
    } catch (_) {
      // system_profiler should always exist on mac but just in case
    }
  }

  return { os, hasNvidia, hasAppleGPU, arch };
}

module.exports = { detectPlatform };
