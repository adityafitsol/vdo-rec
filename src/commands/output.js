const path = require('path');
const fs = require('fs');

/**
 * Generate output filename like: vdo_2025-05-10_14-32-01.mp4
 */
function generateFilename(format) {
  const now = new Date();

  const date = now.toISOString().slice(0, 10); // YYYY-MM-DD
  const time = now.toTimeString().slice(0, 8).replace(/:/g, '-'); // HH-MM-SS

  return `vdo_${date}_${time}.${format}`;
}

/**
 * Resolve and create the output directory if it doesn't exist.
 * Returns the full output file path.
 */
function resolveOutputPath(outDir, format) {
  const dir = path.resolve(outDir);

  if (!fs.existsSync(dir)) {
    fs.mkdirSync(dir, { recursive: true });
  }

  const filename = generateFilename(format);
  return path.join(dir, filename);
}

module.exports = { generateFilename, resolveOutputPath };
