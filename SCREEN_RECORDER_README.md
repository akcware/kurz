# Screen Video Recorder

A screen recording application built with Electron, React, and TypeScript that allows you to record your screen with various audio options.

## Features

- **Screen Selection**: Choose which screen to record from available displays
- **Microphone Input**: Select from available audio input devices
- **System Audio Capture**: Toggle to capture system audio (computer sounds)
- **Video Preview**: Preview recordings before saving
- **Save Functionality**: Save recordings as WebM files with custom file names

## Usage

1. **Select Screen**: Choose the screen you want to record from the dropdown
2. **Choose Microphone**: Select your preferred microphone input device
3. **System Audio**: Check the box if you want to capture system audio
4. **Start Recording**: Click the "Start Recording" button to begin
5. **Stop Recording**: Click "Stop Recording" when finished
6. **Preview**: Use the "Preview" button to review your recording
7. **Save**: Click "Save Recording" to save the file to your computer

## Technical Details

- Uses Electron's `desktopCapturer` API for screen capture
- Implements MediaRecorder API for video recording
- Supports WebM format with VP9 codec
- Handles audio device enumeration and selection
- Provides IPC communication between main and renderer processes

## Development

To run the application in development mode:

```bash
pnpm dev
```

To build the application:

```bash
pnpm build
```

## Requirements

- Node.js 18+
- pnpm package manager
- Electron 35+

## Notes

- Screen recording requires appropriate permissions on macOS
- System audio capture may require additional permissions depending on the operating system
- The application saves recordings in WebM format for optimal quality and file size 