# vdo

vdo records your screen. that's it.

Premium terminal-based screen recorder. Wraps FFmpeg under the hood, auto-picks the best codec for your machine. Featuring a stunning Glassmorphism GUI and built-in audio support.

## Quickstart

```bash
npx @adityafitsol/vdo-rec
```

that's it. it'll ask you what you want to record.

## Install Globally

```bash
npm install -g @adityafitsol/vdo-rec
vdo
```

## CLI Flags

```bash
# interactive mode (no args)
vdo

# screen only
vdo --screen

# audio recording
vdo --screen --mic            # record microphone
vdo --screen --sys-audio      # record system audio (internal sound)
vdo --screen --mic --sys-audio # record both (mixed!)

# launch premium GUI
vdo --gui

# webcam overlay (Coming Soon in v0.4)
# vdo --screen --webcam --pip --shape circle

# set framerate
vdo --screen --fps 60

# quality levels
vdo --screen --quality high       # crf 18, default
vdo --screen --quality balanced   # crf 28, smaller files

# list available cameras and audio devices
vdo --list-devices
```

## Premium Web GUI

Launch a beautiful, modern recording dashboard with:
- Glassmorphism UI: Stunning dark-mode interface using Space Grotesk font.
- Mic Meter: Visual volume bar to verify your microphone is working.
- One-Click Recording: Start/Stop and manage your captures from the browser.
- Webcam Overlay: Draggable PiP and circular crops coming soon!

```bash
vdo --gui
```

## How it works

vdo wraps FFmpeg using fluent-ffmpeg. it ships its own FFmpeg binary via @ffmpeg-installer/ffmpeg so you don't need to install anything system-level.

- Video Capture: Uses gdigrab (Windows), avfoundation (macOS), or x11grab (Linux).
- Audio Capture: Uses dshow (Windows), avfoundation (macOS), or pulse/alsa (Linux).
- Internal Sound: Supports Windows Stereo Mix loopback and Linux PulseAudio monitor streams.
- Mixing: Automatically mixes multiple audio sources (mic + system) into a single high-quality stream.

## Requirements

- Node.js 14+
- nothing else (FFmpeg is bundled)

## License

MIT
