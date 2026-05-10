const express = require('express');
const http = require('http');
const WebSocket = require('ws');
const path = require('path');
const fs = require('fs');
const open = require('open');
const chalk = require('chalk');

const { startRecording, stopRecording, getRecordingState } = require('../commands/record');
const { resolveOutputPath } = require('../commands/output');
const { detectPlatform } = require('../utils/platform');
const { formatDuration, formatBytes } = require('../utils/ui');

const PORT = 4242;

function launchGui() {
  const app = express();
  const server = http.createServer(app);
  const wss = new WebSocket.Server({ server });

  app.use(express.json());

  // serve the single HTML page
  app.get('/', (req, res) => {
    res.send(buildHtml());
  });

  // serve recorded files so the browser can play them back
  app.use('/recordings', express.static(path.resolve('./recordings')));

  // REST: get current status
  app.get('/api/status', (req, res) => {
    const state = getRecordingState();
    const elapsed = state.active && state.startTime
      ? Math.floor((Date.now() - state.startTime) / 1000)
      : 0;

    let size = 0;
    if (state.outputPath) {
      try { size = fs.statSync(state.outputPath).size; } catch (_) {}
    }

    res.json({
      active: state.active,
      elapsed,
      elapsedStr: formatDuration(elapsed),
      size,
      sizeStr: formatBytes(size),
      outputPath: state.outputPath,
      config: state.config,
    });
  });

  // REST: list saved recordings
  app.get('/api/recordings', (req, res) => {
    const dir = path.resolve('./recordings');
    if (!fs.existsSync(dir)) return res.json([]);

    const files = fs.readdirSync(dir)
      .filter(f => /\.(mp4|mkv|webm|gif)$/.test(f))
      .map(f => {
        const full = path.join(dir, f);
        const stat = fs.statSync(full);
        return { name: f, size: stat.size, sizeStr: formatBytes(stat.size), mtime: stat.mtime };
      })
      .sort((a, b) => new Date(b.mtime) - new Date(a.mtime));

    res.json(files);
  });

  // REST: start recording
  app.post('/api/start', async (req, res) => {
    const state = getRecordingState();
    if (state.active) return res.status(400).json({ error: 'Already recording' });

    const { mode = 'screen', fps = 30, quality = 'high', format = 'mp4' } = req.body;

    res.json({ ok: true, message: 'Recording started' });

    // run in background — don't await here or the response never sends
    startRecording({
      screen: mode === 'screen' || mode === 'both',
      webcam: mode === 'webcam' || mode === 'both',
      pip: req.body.pip || false,
      fps: parseInt(fps),
      quality,
      format,
      out: './recordings',
    }).catch(err => {
      console.error('Recording error:', err.message);
      broadcast(wss, { type: 'error', message: err.message });
    });
  });

  // REST: stop recording
  app.post('/api/stop', (req, res) => {
    const state = getRecordingState();
    if (!state.active) return res.status(400).json({ error: 'Not recording' });

    const stopped = stopRecording();
    if (!stopped) return res.status(400).json({ error: 'Could not stop recording' });

    res.json({ ok: true });
  });

  // WebSocket: push status updates every second
  wss.on('connection', (ws) => {
    ws.send(JSON.stringify({ type: 'connected' }));
  });

  let lastBroadcastWasActive = false;

  setInterval(() => {
    const state = getRecordingState();

    // broadcast stopped state once when recording ends
    if (!state.active && lastBroadcastWasActive) {
      lastBroadcastWasActive = false;
      broadcast(wss, { type: 'stopped' });
      return;
    }

    if (!state.active) return;
    lastBroadcastWasActive = true;

    const elapsed = state.startTime
      ? Math.floor((Date.now() - state.startTime) / 1000)
      : 0;

    let size = 0;
    if (state.outputPath) {
      try { size = fs.statSync(state.outputPath).size; } catch (_) {}
    }

    broadcast(wss, {
      type: 'tick',
      elapsed,
      elapsedStr: formatDuration(elapsed),
      size,
      sizeStr: formatBytes(size),
      active: true,
    });
  }, 1000);

  server.listen(PORT, () => {
    console.log('\n' + chalk.cyan('  vdo GUI'));
    console.log(chalk.gray('  running at ') + chalk.white(`http://localhost:${PORT}`));
    console.log(chalk.gray('  press Ctrl+C to quit\n'));
    open(`http://localhost:${PORT}`);
  });
}

function broadcast(wss, data) {
  const msg = JSON.stringify(data);
  wss.clients.forEach(client => {
    if (client.readyState === WebSocket.OPEN) {
      client.send(msg);
    }
  });
}

function buildHtml() {
  return `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>vdo</title>
  <style>
    *, *::before, *::after { box-sizing: border-box; margin: 0; padding: 0; }

    :root {
      --bg: #0f0f0f;
      --surface: #1a1a1a;
      --border: #2a2a2a;
      --text: #e8e8e8;
      --muted: #666;
      --accent: #00d4ff;
      --red: #ff4444;
      --green: #44ff88;
      --yellow: #ffcc00;
    }

    body {
      background: var(--bg);
      color: var(--text);
      font-family: 'SF Mono', 'Fira Code', 'Consolas', monospace;
      min-height: 100vh;
      display: flex;
      flex-direction: column;
    }

    header {
      padding: 24px 32px;
      border-bottom: 1px solid var(--border);
      display: flex;
      align-items: center;
      gap: 16px;
    }

    header h1 {
      font-size: 20px;
      font-weight: 600;
      color: var(--accent);
      letter-spacing: 2px;
    }

    header .tagline {
      font-size: 12px;
      color: var(--muted);
    }

    .main {
      display: grid;
      grid-template-columns: 1fr 320px;
      gap: 0;
      flex: 1;
    }

    .panel {
      padding: 32px;
      border-right: 1px solid var(--border);
    }

    .sidebar {
      padding: 24px;
    }

    /* recording status */
    .status-card {
      background: var(--surface);
      border: 1px solid var(--border);
      border-radius: 8px;
      padding: 28px;
      margin-bottom: 24px;
    }

    .rec-indicator {
      display: flex;
      align-items: center;
      gap: 12px;
      margin-bottom: 20px;
    }

    .rec-dot {
      width: 14px;
      height: 14px;
      border-radius: 50%;
      background: var(--muted);
      transition: background 0.3s;
      flex-shrink: 0;
    }

    .rec-dot.active {
      background: var(--red);
      box-shadow: 0 0 12px var(--red);
      animation: pulse 1s ease-in-out infinite;
    }

    @keyframes pulse {
      0%, 100% { opacity: 1; }
      50% { opacity: 0.4; }
    }

    .rec-label {
      font-size: 13px;
      font-weight: 600;
      letter-spacing: 1px;
      color: var(--muted);
    }

    .rec-label.active { color: var(--red); }

    .timer {
      font-size: 52px;
      font-weight: 700;
      letter-spacing: 4px;
      color: var(--text);
      font-variant-numeric: tabular-nums;
      margin-bottom: 8px;
    }

    .timer.active { color: var(--accent); }

    .file-size {
      font-size: 13px;
      color: var(--muted);
      min-height: 18px;
    }

    /* controls */
    .controls {
      display: flex;
      gap: 12px;
      margin-bottom: 24px;
    }

    button {
      padding: 12px 24px;
      border: none;
      border-radius: 6px;
      font-family: inherit;
      font-size: 13px;
      font-weight: 600;
      cursor: pointer;
      letter-spacing: 0.5px;
      transition: opacity 0.15s, transform 0.1s;
    }

    button:active { transform: scale(0.97); }
    button:disabled { opacity: 0.35; cursor: not-allowed; }

    .btn-record {
      background: var(--red);
      color: #fff;
      flex: 1;
    }

    .btn-stop {
      background: var(--surface);
      color: var(--text);
      border: 1px solid var(--border);
      flex: 1;
    }

    /* config form */
    .config-grid {
      display: grid;
      grid-template-columns: 1fr 1fr;
      gap: 12px;
      margin-bottom: 24px;
    }

    .field label {
      display: block;
      font-size: 11px;
      color: var(--muted);
      margin-bottom: 6px;
      letter-spacing: 0.5px;
      text-transform: uppercase;
    }

    .field select, .field input {
      width: 100%;
      background: var(--surface);
      border: 1px solid var(--border);
      color: var(--text);
      padding: 8px 10px;
      border-radius: 5px;
      font-family: inherit;
      font-size: 13px;
      outline: none;
    }

    .field select:focus, .field input:focus {
      border-color: var(--accent);
    }

    /* recordings list */
    .section-title {
      font-size: 11px;
      color: var(--muted);
      letter-spacing: 1px;
      text-transform: uppercase;
      margin-bottom: 14px;
    }

    .recordings-list {
      display: flex;
      flex-direction: column;
      gap: 8px;
    }

    .recording-item {
      background: var(--surface);
      border: 1px solid var(--border);
      border-radius: 6px;
      padding: 12px 14px;
      cursor: pointer;
      transition: border-color 0.15s;
    }

    .recording-item:hover { border-color: var(--accent); }

    .recording-item .name {
      font-size: 12px;
      color: var(--text);
      margin-bottom: 4px;
      word-break: break-all;
    }

    .recording-item .meta {
      font-size: 11px;
      color: var(--muted);
    }

    .empty-state {
      font-size: 13px;
      color: var(--muted);
      padding: 16px 0;
    }

    /* toast */
    .toast {
      position: fixed;
      bottom: 24px;
      right: 24px;
      background: var(--surface);
      border: 1px solid var(--border);
      border-radius: 6px;
      padding: 12px 18px;
      font-size: 13px;
      opacity: 0;
      transform: translateY(8px);
      transition: opacity 0.2s, transform 0.2s;
      pointer-events: none;
      z-index: 100;
    }

    .toast.show {
      opacity: 1;
      transform: translateY(0);
    }

    .toast.error { border-color: var(--red); color: var(--red); }
    .toast.success { border-color: var(--green); color: var(--green); }

    /* ws status dot */
    .ws-dot {
      width: 7px;
      height: 7px;
      border-radius: 50%;
      background: var(--muted);
      display: inline-block;
      margin-right: 6px;
    }
    .ws-dot.connected { background: var(--green); }
  </style>
</head>
<body>

<header>
  <h1>VDO</h1>
  <span class="tagline">records your screen. that's it.</span>
  <span style="margin-left:auto;font-size:11px;color:var(--muted)">
    <span class="ws-dot" id="wsDot"></span>
    <span id="wsStatus">connecting...</span>
  </span>
</header>

<div class="main">
  <div class="panel">

    <div class="status-card">
      <div class="rec-indicator">
        <div class="rec-dot" id="recDot"></div>
        <span class="rec-label" id="recLabel">IDLE</span>
      </div>
      <div class="timer" id="timer">00:00</div>
      <div class="file-size" id="fileSize"></div>
    </div>

    <div class="controls">
      <button class="btn-record" id="btnRecord" onclick="startRec()">● Start Recording</button>
      <button class="btn-stop" id="btnStop" onclick="stopRec()" disabled>■ Stop</button>
    </div>

    <div class="config-grid">
      <div class="field">
        <label>Mode</label>
        <select id="cfgMode">
          <option value="screen">Screen</option>
          <option value="webcam">Webcam</option>
          <option value="both">Screen + Webcam</option>
        </select>
      </div>
      <div class="field">
        <label>FPS</label>
        <select id="cfgFps">
          <option value="24">24</option>
          <option value="30" selected>30</option>
          <option value="60">60</option>
        </select>
      </div>
      <div class="field">
        <label>Quality</label>
        <select id="cfgQuality">
          <option value="lossless">Lossless</option>
          <option value="high" selected>High</option>
          <option value="balanced">Balanced</option>
        </select>
      </div>
      <div class="field">
        <label>Format</label>
        <select id="cfgFormat">
          <option value="mp4" selected>mp4</option>
          <option value="mkv">mkv</option>
          <option value="webm">webm</option>
          <option value="gif">gif</option>
        </select>
      </div>
    </div>

  </div>

  <div class="sidebar">
    <div class="section-title">Recordings</div>
    <div class="recordings-list" id="recordingsList">
      <div class="empty-state">No recordings yet.</div>
    </div>
  </div>
</div>

<div class="toast" id="toast"></div>

<script>
  let ws;
  let isRecording = false;

  function connectWs() {
    ws = new WebSocket('ws://' + location.host);

    ws.onopen = () => {
      document.getElementById('wsDot').className = 'ws-dot connected';
      document.getElementById('wsStatus').textContent = 'live';
    };

    ws.onclose = () => {
      document.getElementById('wsDot').className = 'ws-dot';
      document.getElementById('wsStatus').textContent = 'disconnected';
      // reconnect after 2s
      setTimeout(connectWs, 2000);
    };

    ws.onmessage = (e) => {
      const msg = JSON.parse(e.data);

      if (msg.type === 'tick') {
        updateStatus(true, msg.elapsedStr, msg.sizeStr);
      }

      if (msg.type === 'stopped') {
        setRecordingUi(false);
        updateStatus(false, '00:00', '');
        toast('Recording saved', 'success');
        setTimeout(loadRecordings, 800);
      }

      if (msg.type === 'error') {
        toast(msg.message, 'error');
        updateStatus(false, '00:00', '');
        setRecordingUi(false);
      }
    };
  }

  function updateStatus(active, timeStr, sizeStr) {
    const dot = document.getElementById('recDot');
    const label = document.getElementById('recLabel');
    const timer = document.getElementById('timer');
    const fileSize = document.getElementById('fileSize');

    if (active) {
      dot.className = 'rec-dot active';
      label.className = 'rec-label active';
      label.textContent = 'REC';
      timer.className = 'timer active';
    } else {
      dot.className = 'rec-dot';
      label.className = 'rec-label';
      label.textContent = 'IDLE';
      timer.className = 'timer';
    }

    timer.textContent = timeStr || '00:00';
    fileSize.textContent = sizeStr || '';
  }

  function setRecordingUi(recording) {
    isRecording = recording;
    document.getElementById('btnRecord').disabled = recording;

    const btnStop = document.getElementById('btnStop');
    btnStop.disabled = !recording;
    btnStop.textContent = '■ Stop';

    ['cfgMode','cfgFps','cfgQuality','cfgFormat'].forEach(id => {
      document.getElementById(id).disabled = recording;
    });
  }

  async function startRec() {
    const body = {
      mode: document.getElementById('cfgMode').value,
      fps: parseInt(document.getElementById('cfgFps').value),
      quality: document.getElementById('cfgQuality').value,
      format: document.getElementById('cfgFormat').value,
    };

    const res = await fetch('/api/start', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(body),
    });

    const data = await res.json();

    if (!res.ok) {
      toast(data.error, 'error');
      return;
    }

    setRecordingUi(true);
    updateStatus(true, '00:00', '');
    toast('Recording started', 'success');
  }

  async function stopRec() {
    document.getElementById('btnStop').disabled = true;
    document.getElementById('btnStop').textContent = '⏳ Stopping...';

    const res = await fetch('/api/stop', { method: 'POST' });
    const data = await res.json();

    if (!res.ok) {
      toast(data.error, 'error');
      // re-enable stop button if it failed
      document.getElementById('btnStop').disabled = false;
      document.getElementById('btnStop').textContent = '■ Stop';
    }
    // UI reset happens via the 'stopped' websocket event — don't do it here
    // otherwise there's a race between the fetch response and ffmpeg finishing
  }

  async function loadRecordings() {
    const res = await fetch('/api/recordings');
    const files = await res.json();
    const list = document.getElementById('recordingsList');

    if (files.length === 0) {
      list.innerHTML = '<div class="empty-state">No recordings yet.</div>';
      return;
    }

    list.innerHTML = files.map(f => \`
      <div class="recording-item" onclick="window.open('/recordings/\${f.name}')">
        <div class="name">\${f.name}</div>
        <div class="meta">\${f.sizeStr}</div>
      </div>
    \`).join('');
  }

  function toast(msg, type = '') {
    const el = document.getElementById('toast');
    el.textContent = msg;
    el.className = 'toast show' + (type ? ' ' + type : '');
    setTimeout(() => { el.className = 'toast'; }, 3000);
  }

  // poll status on load to sync UI if server was already recording
  async function syncStatus() {
    const res = await fetch('/api/status');
    const data = await res.json();
    if (data.active) {
      setRecordingUi(true);
      updateStatus(true, data.elapsedStr, data.sizeStr);
    }
  }

  connectWs();
  loadRecordings();
  syncStatus();

  // refresh recordings list every 10s
  setInterval(loadRecordings, 10000);
</script>

</body>
</html>`;
}

module.exports = { launchGui };
