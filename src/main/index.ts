import { app, shell, BrowserWindow, ipcMain, desktopCapturer, dialog, session } from 'electron'
import path, { join } from 'path'
import { electronApp, optimizer, is } from '@electron-toolkit/utils'
import icon from '../../resources/icon.png?asset'
import fs from 'fs'
import { nodewhisper } from 'nodejs-whisper'
import ffmpeg from 'fluent-ffmpeg'
import ffmpegStatic from 'ffmpeg-static'
import OpenAI from 'openai'

const openai = new OpenAI()

interface WhisperApiResponse {
  text: string
  segments: Array<{
    id: number
    seek: number
    start: number
    end: number
    text: string
    tokens: number[]
    temperature: number
    avg_logprob: number
    compression_ratio: number
    no_speech_prob: number
  }>
  language: string
}

let whisperCompleted = true

// Fix FFmpeg path for macOS
const ffmpegPath = ffmpegStatic || ''
if (ffmpegPath) {
  // Ensure the path is executable
  try {
    fs.accessSync(ffmpegPath, fs.constants.X_OK)
    ffmpeg.setFfmpegPath(ffmpegPath)
    console.log('FFmpeg setup completed:', ffmpegPath)
  } catch (error) {
    console.error('FFmpeg path is not executable:', ffmpegPath, error)
    // Try to use system FFmpeg as fallback
    ffmpeg.setFfmpegPath('ffmpeg')
    console.log('Using system FFmpeg as fallback')
  }
} else {
  console.error('FFmpeg not found! Using system FFmpeg')
  ffmpeg.setFfmpegPath('ffmpeg')
}

function createWindow(): void {
  // Create the browser window.
  const mainWindow = new BrowserWindow({
    width: 1200,
    height: 800,
    show: false,
    autoHideMenuBar: true,
    ...(process.platform === 'linux' ? { icon } : {}),
    webPreferences: {
      preload: join(__dirname, '../preload/index.js'),
      sandbox: false,
      nodeIntegration: true,
      contextIsolation: true,
      webSecurity: true
    }
  })

  session.defaultSession.setPermissionRequestHandler((webContents, permission, callback) => {
    console.log('Permission requested:', permission)
    if (permission === 'media' || permission === 'display-capture') {
      callback(true)
    } else {
      callback(false)
    }
  })

  // Display Media Request Handler (BURAYI DEĞİŞTİR)
  session.defaultSession.setDisplayMediaRequestHandler(async (request, callback) => {
    console.log('Display media requested')

    try {
      // Desktop sources al
      const sources = await desktopCapturer.getSources({
        types: ['screen', 'window']
      })

      console.log('Available sources:', sources.length)

      // İlk screen source'unu döndür
      const screenSource = sources.find((source) => source.name === 'Entire Screen') || sources[0]

      callback({
        video: screenSource, // DesktopCapturerSource objesi
        audio: 'loopback' // Sistem sesi için
      })
    } catch (error) {
      console.error('Error getting desktop sources:', error)
      callback({ video: undefined, audio: undefined })
    }
  })

  ipcMain.handle('save-combined-audio', async (event, arrayBuffer) => {
    try {
      console.log('Saving combined audio...')
      console.log('ArrayBuffer size:', arrayBuffer.byteLength, 'bytes') // Boyutu kontrol et

      // ArrayBuffer'dan Buffer'a dönüştür
      const buffer = Buffer.from(arrayBuffer)
      console.log('Buffer size:', buffer.length, 'bytes')

      const filePath = join(app.getPath('temp'), `${Date.now()}.webm`) // Save as WebM since MediaRecorder produces WebM
      fs.writeFileSync(filePath, buffer)

      const stats = fs.statSync(filePath)
      console.log('Saved combined audio to:', filePath)
      console.log('File saved, size:', stats.size, 'bytes') // Dosya boyutu

      event.sender.send('transcribe-audio-start')
      const result = await transcribeAudio(filePath)
      event.sender.send('transcribe-audio-result', result)

      const summary = await summarizeTranscription(event, JSON.stringify(result))
      event.sender.send('summarize-transcription-result', summary)

      return { success: true, filePath, result }
    } catch (error) {
      console.error('Error saving audio:', error)
      return { success: false, error: (error as Error).message }
    }
  })

  ipcMain.handle('transcribe-cumulative', async (event, arrayBuffer) => {
    try {
      console.log('Starting cumulative transcription...')
      console.log('ArrayBuffer size:', arrayBuffer.byteLength, 'bytes')

      // ArrayBuffer'dan Buffer'a dönüştür
      const buffer = Buffer.from(arrayBuffer)
      console.log('Buffer size:', buffer.length, 'bytes')

      const timestamp = Date.now()
      const filePath = join(app.getPath('temp'), `cumulative_${timestamp}.webm`)

      fs.writeFileSync(filePath, buffer)
      console.log('Cumulative audio saved to:', filePath)

      // Transcription başladığını bildir
      event.sender.send('cumulative-transcribe-start')

      // Transcribe et
      const result = await transcribeAudio(filePath)

      // Sonucu gönder
      event.sender.send('cumulative-transcribe-result', {
        success: true,
        transcription: result,
        timestamp: timestamp
      })

      // Geçici dosyayı temizle (biraz bekleyerek)
      setTimeout(() => {
        try {
          if (fs.existsSync(filePath)) {
            fs.unlinkSync(filePath)
          }
          const wavPath = filePath.replace('.webm', '.wav')
          if (fs.existsSync(wavPath)) {
            fs.unlinkSync(wavPath)
          }
          const jsonPath = wavPath + '.json'
          if (fs.existsSync(jsonPath)) {
            fs.unlinkSync(jsonPath)
          }
        } catch (cleanupError) {
          console.error('Cleanup error:', cleanupError)
        }
      }, 5000) // 5 saniye sonra temizle

      return { success: true, result }
    } catch (error) {
      console.error('Cumulative transcription error:', error)
      event.sender.send('cumulative-transcribe-result', {
        success: false,
        error: (error as Error).message
      })
      return { success: false, error: (error as Error).message }
    }
  })

  ipcMain.handle('write-clipboard', async (event, text: string) => {
    const { clipboard } = require('electron')
    clipboard.writeText(text)
    return { success: true }
  })

  mainWindow.on('ready-to-show', () => {
    mainWindow.show()
  })

  mainWindow.webContents.setWindowOpenHandler((details) => {
    shell.openExternal(details.url)
    return { action: 'deny' }
  })

  // HMR for renderer base on electron-vite cli.
  // Load the remote URL for development or the local html file for production.
  if (is.dev && process.env['ELECTRON_RENDERER_URL']) {
    mainWindow.loadURL(process.env['ELECTRON_RENDERER_URL'])
  } else {
    mainWindow.loadFile(join(__dirname, '../renderer/index.html'))
  }
}

// This method will be called when Electron has finished
// initialization and is ready to create browser windows.
// Some APIs can only be used after this event occurs.

app.commandLine.appendSwitch('enable-features', 'MacLoopbackAudioForScreenShare')

app.whenReady().then(() => {
  // Set app user model id for windows
  electronApp.setAppUserModelId('com.electron')

  // Default open or close DevTools by F12 in development
  // and ignore CommandOrControl + R in production.
  // see https://github.com/alex8088/electron-toolkit/tree/master/packages/utils
  app.on('browser-window-created', (_, window) => {
    optimizer.watchWindowShortcuts(window)
  })

  createWindow()
  startTranscriptionCleanup()

  app.on('activate', function () {
    // On macOS it's common to re-create a window in the app when the
    // dock icon is clicked and there are no other windows open.
    if (BrowserWindow.getAllWindows().length === 0) createWindow()
  })
})

// Quit when all windows are closed, except on macOS. There, it's common
// for applications and their menu bar to stay active until the user quits
// explicitly with Cmd + Q.
app.on('window-all-closed', () => {
  if (process.platform !== 'darwin') {
    app.quit()
  }
})

// In this file you can include the rest of your app's specific main process
// code. You can also put them in separate files and require them here.

const startTranscriptionCleanup = () => {
  if (transcriptionCleanupInterval) return

  transcriptionCleanupInterval = setInterval(
    () => {
      const tempDir = app.getPath('temp')
      const now = Date.now()

      try {
        const files = fs.readdirSync(tempDir)

        files.forEach((file) => {
          if (
            file.startsWith('cumulative_') &&
            (file.endsWith('.webm') || file.endsWith('.wav') || file.endsWith('.json'))
          ) {
            const filePath = join(tempDir, file)
            const stats = fs.statSync(filePath)

            // 10 dakikadan eski dosyaları sil
            if (now - stats.mtime.getTime() > 10 * 60 * 1000) {
              fs.unlinkSync(filePath)
              console.log('Cleaned up old transcription file:', file)
            }
          }
        })
      } catch (error) {
        console.error('Cleanup error:', error)
      }
    },
    5 * 60 * 1000
  ) // Her 5 dakikada bir çalıştır
}

const summarizerSystemPrompt = `Analyze the provided meeting transcript. Identify and extract the main discussion topics, key decisions, and action items, including responsible persons and deadlines if specified. Do not include greetings, conversational phrases, explanations, or any language that suggests artificial intelligence involvement.

Use the following structure for the output:

### Meeting Summary
Concisely summarize the overall purpose of the meeting and the main subjects discussed. Focus on key themes and objectives.

### Discussion Points
List the main topics covered during the meeting, in the order they appeared. Provide clear, factual bullet points for each subject.

### Decisions Made
Clearly state any decisions reached. Each decision should be listed as a bullet point with sufficient context to be actionable.

### Action Items
For each action item, specify:

Task description

Person responsible

Deadline (if mentioned)
Present these as a clear, structured list.

Additional Notes
Include any further critical points, follow-ups, or risks highlighted during the meeting. Exclude generic comments or non-essential information.
Write in language of the transcript.

Do not include explanations, apologies, expressions of thanks, or assistant-like responses. Only provide the requested structured content, written in a formal and professional style. The output must be self-explanatory and suitable for direct sharing with meeting participants or management.
Use markdown format.
`

const summarizeTranscription = async (
  event: Electron.IpcMainInvokeEvent,
  transcription: string
) => {
  const response = await openai.chat.completions.create({
    model: 'gpt-4.1-mini',
    messages: [
      {
        role: 'developer',
        content: summarizerSystemPrompt
      },
      { role: 'user', content: transcription }
    ],
    max_tokens: 1000
  })

  // Clean and process the markdown content
  const rawContent = response.choices[0]?.message?.content || ''

  // Remove markdown code block wrapper if present
  const cleanContent = rawContent
    .replace(/^```markdown\n/, '') // Remove opening markdown block
    .replace(/\n```$/, '') // Remove closing block
    .replace(/^["']|["']$/g, '') // Remove surrounding quotes
    .replace(/\\"/g, '"') // Replace escaped quotes
    .trim() // Remove extra whitespace

  console.log('Summarized transcription:', cleanContent)
  return cleanContent
}

const convertToWav = (inputPath: string, outputPath: string): Promise<void> => {
  return new Promise((resolve, reject) => {
    console.log('Converting to WAV:', inputPath, '->', outputPath)

    // Check if input file exists
    if (!fs.existsSync(inputPath)) {
      reject(new Error(`Input file does not exist: ${inputPath}`))
      return
    }

    ffmpeg(inputPath)
      .toFormat('wav')
      .audioFrequency(16000) // Whisper için gerekli
      .audioChannels(1) // Mono
      .on('end', () => {
        console.log('Conversion completed successfully')
        resolve()
      })
      .on('error', (error) => {
        console.error('Conversion error:', error)
        reject(error)
      })
      .on('progress', (progress) => {
        console.log('Conversion progress:', progress.percent + '%')
      })
      .save(outputPath)
  })
}

const transcribeAudio = async (filePath: string) => {
  if (!whisperCompleted) {
    return
  }

  whisperCompleted = false
  try {
    console.log('Starting transcription for:', filePath)

    // ✅ Manuel olarak WAV'a çevir
    const wavPath = filePath.replace('.webm', '.wav')

    try {
      await convertToWav(filePath, wavPath)
    } catch (conversionError) {
      console.error('Conversion failed, trying direct transcription:', conversionError)
      // If conversion fails, try direct transcription
      const result = await nodewhisper(filePath, {
        modelName: 'small',
        removeWavFileAfterTranscription: true,
        whisperOptions: {
          outputInJson: true
        }
      })
      console.log('Direct transcription completed:', result)
      return result
    }

    // ✅ nodejs-whisper'a direkt WAV ver (kendi conversion'ı atlanacak)
    const result = await nodewhisper(wavPath, {
      modelName: 'medium',
      whisperOptions: {
        outputInJson: true
      }
    })

    console.log('Transcription completed:', result)

    const jsonFile = wavPath + '.json'
    const json = JSON.parse(fs.readFileSync(jsonFile, 'utf8')) as WhisperApiResponse

    return json
  } catch (error) {
    console.error('Transcription error:', error)
    throw error
  } finally {
    whisperCompleted = true
  }
}

const transcribeAudioOptimized = async (filePath: string, isRealtime: boolean = false) => {
  try {
    console.log('Starting optimized transcription for:', filePath)

    // Real-time için daha hızlı model kullan
    const modelName = isRealtime ? 'small' : 'medium'

    // WAV'a çevir
    const wavPath = filePath.replace('.webm', '.wav')

    try {
      await convertToWav(filePath, wavPath)
    } catch (conversionError) {
      console.error('Conversion failed, trying direct transcription:', conversionError)

      // Direct transcription fallback
      const result = await nodewhisper(filePath, {
        modelName: modelName,
        whisperOptions: {
          outputInJson: true,
          language: 'auto' // Dil otomatik tespit
        }
      })
      return result
    }

    // WAV dosyasını transcribe et
    const result = await nodewhisper(wavPath, {
      modelName: modelName,
      whisperOptions: {
        outputInJson: true,
        language: 'auto'
        // Real-time için ek optimizasyonlar - bu parametreler henüz desteklenmiyor
        // ...(isRealtime && {
        //   noSpeechThreshold: 0.6,
        //   logProbThreshold: -1.0,
        //   compressionRatioThreshold: 2.4
        // })
      }
    })

    console.log('Transcription completed successfully')

    // JSON dosyasını oku
    const jsonFile = wavPath + '.json'
    if (fs.existsSync(jsonFile)) {
      const json = JSON.parse(fs.readFileSync(jsonFile, 'utf8')) as WhisperApiResponse
      return json
    }

    return result
  } catch (error) {
    console.error('Optimized transcription error:', error)
    throw error
  }
}

// Geliştirilmiş convertToWav fonksiyonu
const convertToWavOptimized = (
  inputPath: string,
  outputPath: string,
  isRealtime: boolean = false
): Promise<void> => {
  return new Promise((resolve, reject) => {
    console.log('Converting to WAV (optimized):', inputPath, '->', outputPath)

    // Input file kontrolü
    if (!fs.existsSync(inputPath)) {
      reject(new Error(`Input file does not exist: ${inputPath}`))
      return
    }

    const command = ffmpeg(inputPath)
      .toFormat('wav')
      .audioFrequency(16000) // Whisper standard
      .audioChannels(1) // Mono

    // Real-time için daha hızlı settings
    if (isRealtime) {
      command
        .audioCodec('pcm_s16le') // Hızlı codec
        .audioFilters('volume=1.0') // Basit volume filter
    }

    command
      .on('end', () => {
        console.log('Conversion completed successfully')
        resolve()
      })
      .on('error', (error) => {
        console.error('Conversion error:', error)
        reject(error)
      })
      .on('progress', (progress) => {
        if (!isRealtime) {
          // Real-time'da progress log'larını azalt
          console.log(
            'Conversion progress:',
            progress.percent ? progress.percent.toFixed(1) + '%' : 'processing...'
          )
        }
      })
      .save(outputPath)
  })
}

// Memory management için periodic cleanup
let transcriptionCleanupInterval: NodeJS.Timeout | null = null
