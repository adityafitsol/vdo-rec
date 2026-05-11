# vdo-rec

vdo-rec is a premium terminal-based screen recorder designed for performance and simplicity. It provides a robust interface for capturing your screen along with multi-source audio (microphone and system audio) without requiring external system dependencies.

## Key Features

- Single-binary setup: FFmpeg is bundled with the package.
- Intelligent Encoding: Automatically selects the best hardware or software encoder for your platform (NVENC, VideoToolbox, or x264).
- Audio Mixing: Record microphone and system audio simultaneously with automatic mixing.
- Flexible Interface: Use the interactive CLI or standard flags.
- Cross-Platform: Native support for Windows, macOS, and Linux.

## Quickstart

Run without installation:

```bash
npx @adityafitsol/vdo-rec
```

The interactive prompt will guide you through the recording setup.

## Installation

Install globally for regular use:

```bash
npm install -g @adityafitsol/vdo-rec
vdo
```

## CLI Usage

### Basic Recording
```bash
# Interactive mode
vdo

# Record screen with default settings
vdo --screen
```

### Audio Options
```bash
# Record with microphone
vdo --screen --mic

# Record with system audio (internal sound)
vdo --screen --sys-audio

# Record both microphone and system audio mixed
vdo --screen --mic --sys-audio
```

### Advanced Configuration
```bash
# Set frame rate
vdo --screen --fps 60

# Set quality level (lossless | high | balanced)
vdo --screen --quality high

# Change output format (mp4 | mkv | webm | gif)
vdo --screen --format webm

# Specify output directory
vdo --screen --out ./my-recordings
```

### Utilities
```bash
# List available audio input devices
vdo --list-devices
```



## Technical Details

vdo-rec leverages FFmpeg for high-performance video and audio capture.

- Windows: Uses gdigrab and dshow.
- macOS: Uses avfoundation.
- Linux: Uses x11grab and PulseAudio/ALSA.

The application automatically handles hardware acceleration on supported systems to reduce CPU overhead during recording.

## Requirements

- Node.js 14.0 or higher.
- No external FFmpeg installation required.

## License

MIT
