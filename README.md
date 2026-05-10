# vdo

vdo records your screen. that's it.

Premium terminal-based screen and webcam recorder. Wraps FFmpeg under the hood, auto-picks the best codec for your machine. Featuring a stunning Glassmorphism GUI and built-in audio support.

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

# webcam only
vdo --webcam

# screen + webcam with draggable picture-in-picture
vdo --screen --webcam --pip --shape circle --pip-x 0.8 --pip-y 0.8

# audio recording
vdo --screen --mic            # record microphone
vdo --screen --sys-audio      # record system audio (internal sound)
vdo --screen --mic --sys-audio # record both (mixed!)

# launch premium GUI
vdo --gui

# set framerate
vdo --screen --fps 60

# quality levels
vdo --screen --quality lossless   # crf 0, huge files
vdo --screen --quality high       # crf 18, default
vdo --screen --quality balanced   # crf 28, smaller files

# list available cameras and audio devices
vdo --list-devices
```

## Premium Web GUI

Launch a beautiful, modern recording dashboard with:
- Glassmorphism UI: Stunning dark-mode interface using Space Grotesk font.
- Draggable Webcam: Drag your webcam preview to any corner of the screen before recording.
- Webcam Shapes: Toggle between Rectangle and Circle shapes.
- Mic Meter: Visual volume bar to verify your microphone is working.
- One-Click Recording: Start/Stop and manage your captures from the browser.

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
