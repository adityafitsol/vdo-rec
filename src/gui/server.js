const express = require('express');
const http = require('http');
const { Server } = require('ws');
const path = require('path');
const fs = require('fs');
const open = require('open');
const { startRecording, stopRecording, getRecordingState } = require('../commands/record');

const PORT = 4242;

function launchGui() {
  const app = express();
  const server = http.createServer(app);
  const wss = new Server({ server });

  app.use(express.json());

  // Main UI
  app.get('/', (req, res) => {
    const recordingsDir = path.join(process.cwd(), 'recordings');
    let recordings = [];
    if (fs.existsSync(recordingsDir)) {
      recordings = fs.readdirSync(recordingsDir).filter(f => f.match(/\.(mp4|mkv|webm|gif)$/));
    }

    res.send(`
<!DOCTYPE html>
<html lang="en" class="dark">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>vdo-rec Dashboard</title>
  <script src="https://cdn.tailwindcss.com"></script>
  <link rel="preconnect" href="https://fonts.googleapis.com">
  <link rel="preconnect" href="https://fonts.gstatic.com" crossorigin>
  <link href="https://fonts.googleapis.com/css2?family=Space+Grotesk:wght@500;700&family=Inter:wght@400;600&family=JetBrains+Mono:wght@500&display=swap" rel="stylesheet">
  <link rel="stylesheet" href="https://fonts.googleapis.com/css2?family=Material+Symbols+Outlined:wght,FILL@100..700,0..1" />
  <script>
    tailwind.config = {
      darkMode: 'class',
      theme: {
        extend: {
          colors: {
            bg: '#030303',
            surface: '#0a0a0a',
            primary: '#00d4ff',
            accent: '#00ff88',
            muted: '#888888',
          },
          fontFamily: {
            sans: ['Inter', 'sans-serif'],
            heading: ['Space Grotesk', 'sans-serif'],
            mono: ['JetBrains Mono', 'monospace'],
          },
        }
      }
    }
  </script>
  <style>
    body { background-color: #030303; color: white; overflow-x: hidden; }
    .glass { background: rgba(255, 255, 255, 0.02); backdrop-filter: blur(20px); border: 1px solid rgba(255, 255, 255, 0.05); }
    .neon-glow { text-shadow: 0 0 20px rgba(0, 212, 255, 0.5); }
    .recording-pulse { animation: pulse 2s cubic-bezier(0.4, 0, 0.6, 1) infinite; }
    @keyframes pulse { 0%, 100% { opacity: 1; } 50% { opacity: .3; } }
  </style>
</head>
<body class="antialiased selection:bg-primary/30">
  <div class="fixed inset-0 pointer-events-none overflow-hidden -z-10">
    <div class="absolute -top-[20%] -left-[10%] w-[50%] h-[50%] bg-primary/5 blur-[120px] rounded-full"></div>
    <div class="absolute -bottom-[20%] -right-[10%] w-[50%] h-[50%] bg-accent/5 blur-[120px] rounded-full"></div>
  </div>

  <div class="max-w-6xl mx-auto px-6 py-12 flex flex-col md:flex-row gap-8 min-h-screen">
    <!-- Sidebar -->
    <aside class="w-full md:w-80 flex flex-col gap-6">
      <div class="flex items-center gap-3 mb-4">
        <div class="w-8 h-8 bg-primary rounded-lg flex items-center justify-center rotate-3 shadow-[0_0_15px_rgba(0,212,255,0.4)]">
          <span class="material-symbols-outlined text-black text-sm font-bold">videocam</span>
        </div>
        <span class="font-heading text-xl font-bold tracking-tight">vdo<span class="text-primary">-rec</span></span>
      </div>

      <div class="glass p-6 rounded-3xl space-y-6">
        <h3 class="text-[10px] font-bold text-muted uppercase tracking-widest">Library</h3>
        <div class="space-y-3 max-h-[400px] overflow-y-auto pr-2 custom-scrollbar">
          ${recordings.length ? recordings.map(f => `
            <div class="group flex items-center justify-between p-3 rounded-xl hover:bg-white/5 transition-all cursor-pointer border border-transparent hover:border-white/5">
              <div class="flex items-center gap-3 overflow-hidden">
                <span class="material-symbols-outlined text-muted group-hover:text-primary transition-colors">movie</span>
                <span class="text-xs font-mono truncate text-muted group-hover:text-white transition-colors">${f}</span>
              </div>
            </div>
          `).join('') : '<div class="text-[10px] text-muted italic">No recordings yet</div>'}
        </div>
      </div>
    </aside>

    <!-- Main Control -->
    <main class="flex-1 flex flex-col gap-8">
      <div class="glass p-12 rounded-[48px] flex flex-col items-center justify-center text-center relative overflow-hidden">
        <div id="statusIndicator" class="absolute top-8 left-8 flex items-center gap-2 px-3 py-1 rounded-full bg-white/5 border border-white/5">
          <span class="w-2 h-2 rounded-full bg-muted" id="statusDot"></span>
          <span class="text-[10px] font-bold text-muted uppercase tracking-widest" id="statusText">Idle</span>
        </div>

        <div class="mb-8">
          <div id="timer" class="font-heading text-8xl md:text-9xl font-bold tracking-tighter tabular-nums neon-glow">00:00</div>
          <div class="text-xs text-muted font-mono tracking-widest uppercase mt-4">Session Duration</div>
        </div>

        <div class="flex items-center gap-6">
          <button id="startBtn" onclick="toggleRecording()" class="h-16 px-10 bg-primary text-black font-bold rounded-2xl hover:scale-105 active:scale-95 transition-all shadow-[0_0_30px_rgba(0,212,255,0.3)]">
            Start Recording
          </button>
        </div>
      </div>

      <div class="grid grid-cols-1 md:grid-cols-2 gap-8">
        <div class="glass p-8 rounded-[32px] space-y-6">
          <div class="flex items-center justify-between">
            <h3 class="font-bold text-white">Audio Levels</h3>
            <span class="material-symbols-outlined text-muted text-sm">equalizer</span>
          </div>
          <div class="space-y-6">
            <div class="space-y-2">
              <div class="flex justify-between text-[10px] font-bold text-muted uppercase tracking-widest">
                <span>Microphone</span>
                <span id="micVal">0%</span>
              </div>
              <div class="h-1.5 bg-white/5 rounded-full overflow-hidden">
                <div id="micBar" class="h-full bg-primary shadow-[0_0_10px_rgba(0,212,255,0.5)] transition-all duration-100" style="width: 0%"></div>
              </div>
            </div>
            <div class="space-y-2">
              <div class="flex justify-between text-[10px] font-bold text-muted uppercase tracking-widest">
                <span>System Audio</span>
                <span id="sysVal">0%</span>
              </div>
              <div class="h-1.5 bg-white/5 rounded-full overflow-hidden">
                <div id="sysBar" class="h-full bg-accent shadow-[0_0_10px_rgba(0,255,136,0.5)] transition-all duration-100" style="width: 0%"></div>
              </div>
            </div>
          </div>
        </div>

        <div class="glass p-8 rounded-[32px] space-y-6">
          <div class="flex items-center justify-between">
            <h3 class="font-bold text-white">Output Info</h3>
            <span class="material-symbols-outlined text-muted text-sm">info</span>
          </div>
          <div class="space-y-4 text-sm font-mono">
            <div class="flex justify-between py-2 border-b border-white/5">
              <span class="text-muted">FPS</span>
              <span class="text-white">60</span>
            </div>
            <div class="flex justify-between py-2 border-b border-white/5">
              <span class="text-muted">Encoder</span>
              <span class="text-white">Hardware (Auto)</span>
            </div>
            <div class="flex justify-between py-2">
              <span class="text-muted">Format</span>
              <span class="text-primary font-bold">MP4</span>
            </div>
          </div>
        </div>
      </div>
    </main>
  </div>

  <script>
    let isRecording = false;
    let timerInterval;
    let seconds = 0;

    const ws = new WebSocket(\`ws://\${window.location.host}\`);
    
    ws.onmessage = (event) => {
      const data = JSON.parse(event.data);
      if (data.type === 'status') {
        updateUI(data.state);
      }
      if (data.type === 'audio') {
        updateAudioMeters(data.mic, data.sys);
      }
    };

    function updateUI(state) {
      const dot = document.getElementById('statusDot');
      const text = document.getElementById('statusText');
      const btn = document.getElementById('startBtn');
      const timer = document.getElementById('timer');

      if (state.isRecording) {
        isRecording = true;
        dot.className = 'w-2 h-2 rounded-full bg-primary recording-pulse shadow-[0_0_10px_rgba(0,212,255,0.8)]';
        text.innerText = 'Recording';
        text.className = 'text-[10px] font-bold text-primary uppercase tracking-widest';
        btn.innerText = 'Stop Session';
        btn.className = 'h-16 px-10 bg-white text-black font-bold rounded-2xl hover:scale-105 active:scale-95 transition-all shadow-2xl';
        
        if (!timerInterval) {
          timerInterval = setInterval(() => {
            seconds++;
            const m = Math.floor(seconds / 60).toString().padStart(2, '0');
            const s = (seconds % 60).toString().padStart(2, '0');
            timer.innerText = \`\${m}:\${s}\`;
          }, 1000);
        }
      } else {
        isRecording = false;
        dot.className = 'w-2 h-2 rounded-full bg-muted';
        text.innerText = 'Idle';
        text.className = 'text-[10px] font-bold text-muted uppercase tracking-widest';
        btn.innerText = 'Start Recording';
        btn.className = 'h-16 px-10 bg-primary text-black font-bold rounded-2xl hover:scale-105 active:scale-95 transition-all shadow-[0_0_30px_rgba(0,212,255,0.3)]';
        
        clearInterval(timerInterval);
        timerInterval = null;
        seconds = 0;
        timer.innerText = '00:00';
      }
    }

    function updateAudioMeters(mic, sys) {
      document.getElementById('micBar').style.width = \`\${mic}%\`;
      document.getElementById('micVal').innerText = \`\${Math.round(mic)}%\`;
      document.getElementById('sysBar').style.width = \`\${sys}%\`;
      document.getElementById('sysVal').innerText = \`\${Math.round(sys)}%\`;
    }

    async function toggleRecording() {
      const action = isRecording ? 'stop' : 'start';
      try {
        await fetch(\`/\${action}\`, { method: 'POST' });
      } catch (err) {
        console.error('Failed to ' + action, err);
      }
    }
  </script>
</body>
</html>
    `);
  });

  app.post('/start', async (req, res) => {
    try {
      await startRecording({ screen: true, mic: true, sysAudio: true });
      res.json({ success: true });
    } catch (err) {
      res.status(500).json({ error: err.message });
    }
  });

  app.post('/stop', async (req, res) => {
    try {
      await stopRecording();
      res.json({ success: true });
    } catch (err) {
      res.status(500).json({ error: err.message });
    }
  });

  wss.on('connection', (ws) => {
    const interval = setInterval(() => {
      const state = getRecordingState();
      ws.send(JSON.stringify({ type: 'status', state }));
      
      // Simulated audio levels for UI demo
      if (state.isRecording) {
        ws.send(JSON.stringify({
          type: 'audio',
          mic: Math.random() * 40 + 20,
          sys: Math.random() * 30 + 10
        }));
      } else {
        ws.send(JSON.stringify({ type: 'audio', mic: 0, sys: 0 }));
      }
    }, 500);

    ws.on('close', () => clearInterval(interval));
  });

  server.listen(PORT, () => {
    console.log(\`\n  \x1b[36m✓ GUI Dashboard active at http://localhost:\${PORT}\x1b[0m\`);
    open(\`http://localhost:\${PORT}\`);
  });
}

module.exports = { launchGui };
