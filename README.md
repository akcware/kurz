# Kurz

An advanced Electron application that combines screen/audio recording with AI-powered transcription and content editing capabilities.

## ✨ Features

### 🎤 Audio Recording & Transcription
- **Multi-stream Audio Capture**: Record both system audio and microphone input simultaneously
- **Real-time Transcription**: Live transcription during recording using Whisper AI
- **AI-Powered Summaries**: Generate intelligent summaries of recorded content
- **Audio Mixing**: Combine multiple audio sources with adjustable levels
- **Multiple Output Formats**: Support for various audio formats (WebM, WAV)

### 📝 Content Management
- **Rich Text Editor**: Built-in BlockNote editor with Markdown support
- **Audio Playback**: Custom audio player with advanced controls
- **Content Organization**: Manage transcriptions, summaries, and recordings

### 🤖 AI Integration
- **Whisper AI**: Local speech-to-text transcription using `nodejs-whisper`
- **OpenAI Integration**: Enhanced summaries and content processing
- **Real-time Processing**: Live transcription and analysis during recording

## 🛠️ Technology Stack

- **Framework**: Electron + React + TypeScript
- **UI Library**: Radix UI components with Tailwind CSS
- **Audio Processing**: MediaRecorder API, Web Audio API
- **Video Processing**: FFmpeg for video manipulation
- **AI/ML**: Whisper AI for transcription, OpenAI for summaries
- **Build Tool**: Electron Vite for fast development

## 📋 Prerequisites

- **Node.js**: Version 18 or higher
- **Package Manager**: Bun (recommended) or pnpm
- **Operating System**: macOS, Windows, or Linux
- **Permissions**: Microphone, screen recording, and system audio access

> **Note**: The project uses bun as the package manager. Make sure you have bun installed, or adjust the commands to use your preferred package manager.

## 🚀 Installation

1. **Clone the repository**
   ```bash
   git clone <repository-url>
   cd kurz
   ```

2. **Install dependencies**
   ```bash
   bun install
   ```

3. **Download AI models** (automatic during build)
   ```bash
   bun run build:mac  # or build:win for Windows
   ```

## 💻 Development

### Start development server
```bash
bun run dev
```

### Code quality checks
```bash
# Format code
bun run format

# Lint code
bun run lint

# Type checking
bun run typecheck
```

## 📦 Building

### Development build
```bash
bun run build
```

### Platform-specific builds
```bash
# macOS
bun run build:mac

# Windows
bun run build:win

# Linux
bun run build:linux
```

> **Note**: Platform builds automatically download the required Whisper AI models.

## 🎯 Usage

### Audio Recording Mode
1. **Start Recording**: Click the record button to begin capturing audio
2. **Real-time Transcription**: Enable live transcription for immediate text output
3. **Multiple Sources**: Configure microphone and system audio separately
4. **Stop & Process**: End recording and process with AI for transcription/summary

### Screen Recording Mode
1. **Select Display**: Choose which screen to record from available displays
2. **Configure Quality**: Set video quality (720p to 4K) and frame rate
3. **Audio Options**: Include system audio and/or microphone input
4. **Record & Save**: Start recording and save as WebM when complete

### Content Editing
1. **Import Transcriptions**: Load transcribed text into the rich text editor
2. **Edit & Format**: Use Markdown-compatible editor for formatting
3. **Audio Playback**: Use the integrated player to review recordings

## 🔧 Configuration

The application supports various configuration options:

- **Audio Quality**: Adjustable bitrates for different use cases
- **Video Settings**: Multiple resolution and frame rate presets
- **AI Models**: Configurable Whisper model selection
- **Storage**: Custom save locations for recordings and transcriptions

## 📁 Project Structure

```
src/
├── main/           # Electron main process
├── preload/        # Preload scripts for IPC
└── renderer/       # React frontend
    ├── components/ # UI components
    │   ├── AudioRecorder.tsx    # Audio recording interface
    │   ├── ScreenRecorder.tsx   # Screen recording interface
    │   ├── Editor.tsx           # Rich text editor
    │   ├── PlayStory.tsx        # Audio playback controls
    │   └── ui/                  # Reusable UI components
    └── lib/        # Utility functions
```

## 🤝 Contributing

1. Fork the repository
2. Create a feature branch: `git checkout -b feature-name`
3. Commit changes: `git commit -am 'Add feature'`
4. Push to branch: `git push origin feature-name`
5. Submit a pull request

## 📄 License

This project is licensed under the MIT License - see the [LICENSE](LICENSE) file for details.

## 🐛 Troubleshooting

### Common Issues

**Permission Errors**: Ensure the application has microphone and screen recording permissions on macOS.

**Audio Not Recording**: Check that the selected audio devices are properly connected and not in use by other applications.

**Build Failures**: Make sure all dependencies are installed and Node.js version meets requirements.

**AI Model Issues**: Verify that Whisper models are properly downloaded in the `models/` directory.

### Platform-Specific Notes

- **macOS**: May require additional permissions for screen recording and system audio
- **Windows**: Some antivirus software may flag the application during build
- **Linux**: Audio capture may require additional PulseAudio configuration

## 🆘 Support

For issues and questions:
1. Check the [Issues](../../issues) page for existing problems
2. Create a new issue with detailed information
3. Include system specifications and error logs when applicable

---

Built with ❤️ using Electron, React, and modern web technologies.
