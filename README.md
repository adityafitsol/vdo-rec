# vdo

**vdo records your screen. that's it.**

terminal-based screen and webcam recorder. wraps FFmpeg under the hood, auto-picks the best codec for your machine. no Electron, no GUI, no nonsense.

---

## quickstart

```bash
npx vdo-rec
```

that's it. it'll ask you what you want to record.

---

## install globally

```bash
npm install -g vdo-rec
vdo
```

---

## CLI flags

```bash
# interactive mode (no args)
vdo

# screen only
vdo --screen

# webcam only
vdo --webcam

# screen + webcam with picture-in-picture overlay
vdo --screen --webcam --pip

# set framerate
vdo --screen --fps 60

# quality levels
vdo --screen --quality lossless   # crf 0, huge files
vdo --screen --quality high       # crf 18, default
vdo --screen --quality balanced   # crf 28, smaller files

# output format
vdo --screen --format mp4    # default
vdo --screen --format mkv
vdo --screen --format webm
vdo --screen --format gif    # no audio, 640px wide

# output directory
vdo --screen --out ./recordings
vdo --screen --out ~/Desktop/captures

# list available cameras and audio devices
vdo --list-devices

# stop (or just Ctrl+C)
vdo stop
```

---

## output files

files are named like: `vdo_2025-05-10_14-32-01.mp4`

output directory is created automatically if it doesn't exist. defaults to `./recordings`.

---

## how it works

vdo wraps FFmpeg using [fluent-ffmpeg](https://github.com/fluent-ffmpeg/node-fluent-ffmpeg). it ships its own FFmpeg binary via `@ffmpeg-installer/ffmpeg` so you don't need to install anything system-level.

on startup it detects your OS and GPU:

- **macOS + Apple GPU** → `h264_videotoolbox` (hardware accelerated)
- **Windows + NVIDIA** → `h264_nvenc` (hardware accelerated)
- **everything else** → `libx264` (software, works everywhere)

if a hardware codec fails for any reason, it automatically falls back to `libx264`.

screen capture uses:
- macOS → `avfoundation`
- Windows → `gdigrab`
- Linux → `x11grab` (needs `$DISPLAY`)

---

## known limitations

- **no region selection yet** — records the full screen. `TODO` is in the code if you want to add it.
- **Windows audio** — `gdigrab` doesn't capture audio natively. you'll need to specify a dshow audio device. run `vdo --list-devices` to find the name, then it's a manual ffmpeg thing for now.
- **Linux webcam** — assumes `/dev/video0`. use `--webcam-device /dev/video1` if you have multiple cameras.
- **GIF output** — single-pass, no palette optimization. files are bigger than they could be. good enough for most uses.
- **multiple monitors** — records the primary screen. monitor selection coming later.
- **avfoundation screen index** — hardcoded to `1:0` on macOS. if your screen isn't being captured, run `vdo --list-devices` and check the index.

---

## requirements

- Node.js 14+
- nothing else (FFmpeg is bundled)

---

## license

MIT
