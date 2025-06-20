import { useEffect, useState, useRef } from 'react'
import { Button } from './ui/button'
import { Switch } from './ui/switch'
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger
} from './ui/dropdown-menu'

import { BookAudioIcon, CopyIcon, FileTextIcon, Video } from 'lucide-react'
import Editor from './Editor'
import { Toaster } from './ui/sonner'
import { toast } from 'sonner'

interface Timestamps {
  to: string
  from: string
}

export interface Offsets {
  from: number
  to: number
}

interface TranscriptionSegment {
  timestamps: Timestamps
  offsets: Offsets
  text: string
}

interface WhisperResponse {
  text: string
  segments: Array<{
    id?: number
    seek?: number
    start?: number
    end?: number
    text: string
    tokens?: number[]
    temperature?: number
    avg_logprob?: number
    compression_ratio?: number
    no_speech_prob?: number
    timestamps?: {
      from: string
      to: string
    }
    offsets?: {
      from: number
      to: number
    }
  }>
  language: string
}

const AudioRecorder = () => {
  const [isRecording, setIsRecording] = useState(false)
  const [displayStream, setDisplayStream] = useState<MediaStream | null>(null)
  const [userStream, setUserStream] = useState<MediaStream | null>(null)
  const [displayRecorder, setDisplayRecorder] = useState<MediaRecorder | null>(null)
  const [userRecorder, setUserRecorder] = useState<MediaRecorder | null>(null)
  const [displayAudioChunks, setDisplayAudioChunks] = useState<BlobPart[]>([])
  const [userAudioChunks, setUserAudioChunks] = useState<BlobPart[]>([])
  const [combinedAudioUrl, setCombinedAudioUrl] = useState<string>('')
  const [displayAudioUrl, setDisplayAudioUrl] = useState<string>('')
  const [userAudioUrl, setUserAudioUrl] = useState<string>('')
  const displayAudioChunksRef = useRef<BlobPart[]>([])
  const userAudioChunksRef = useRef<BlobPart[]>([])
  const [displayAudioBlob, setDisplayAudioBlob] = useState<Blob | null>(null)
  const [userAudioBlob, setUserAudioBlob] = useState<Blob | null>(null)
  const [isTranscribing, setIsTranscribing] = useState(false)
  const [transcriptionResult, setTranscriptionResult] = useState<WhisperResponse | null>(null)
  const [summaryResult, setSummaryResult] = useState<string>('')
  const [mode, setMode] = useState<'transcription' | 'summary' | 'video'>('transcription')
  const [realtimeTranscript, setRealtimeTranscript] = useState<string>('')
  const [isRealtimeMode, setIsRealtimeMode] = useState(false)
  const [realtimeProgress, setRealtimeProgress] = useState<number>(0)
  const intervalRef = useRef<NodeJS.Timeout | null>(null)
  const recordingStartTime = useRef<number>(0)

  const modes = {
    transcription: {
      title: 'Transcription',
      id: 'transcription',
      icon: <BookAudioIcon className="w-4 h-4" />
    },
    summary: {
      title: 'Summary',
      id: 'summary',
      icon: <FileTextIcon className="w-4 h-4" />
    },
    video: {
      title: 'Video',
      id: 'video',
      icon: <Video className="w-4 h-4" />
    }
  }

  const startRealtimeTranscription = () => {
    if (!displayRecorder || !userRecorder) return

    setIsRealtimeMode(true)
    setRealtimeTranscript('')
    setRealtimeProgress(0)
    recordingStartTime.current = Date.now()

    // Her 3 saniyede bir kümülatif transcript (daha responsive)
    intervalRef.current = setInterval(async () => {
      if (displayRecorder.state === 'recording' && userRecorder.state === 'recording') {
        await processCumulativeAudio()
      }
    }, 7000) // 7 saniye intervals - daha hızlı response
  }

  const processCumulativeAudio = async () => {
    try {
      const currentTime = Date.now()
      const elapsedSeconds = Math.floor((currentTime - recordingStartTime.current) / 1000)
      setRealtimeProgress(elapsedSeconds)

      console.log(`Processing cumulative audio: 0 to ${elapsedSeconds}s`)

      // Chunk'ların boş olmadığını kontrol et
      if (displayAudioChunksRef.current.length === 0 || userAudioChunksRef.current.length === 0) {
        console.log('Chunks not ready yet, skipping...')
        return
      }

      // Desteklenen format'ı kontrol et
      const preferredType = MediaRecorder.isTypeSupported('audio/wav')
        ? 'audio/wav'
        : MediaRecorder.isTypeSupported('audio/webm;codecs=opus')
          ? 'audio/webm;codecs=opus'
          : 'audio/webm'

      console.log('Using audio type:', preferredType)

      // Tüm chunk'ları başından o ana kadar birleştir
      const cumulativeDisplayBlob = new Blob(displayAudioChunksRef.current, { type: preferredType })
      const cumulativeUserBlob = new Blob(userAudioChunksRef.current, { type: preferredType })

      // Blob'ların geçerli boyutta olduğunu kontrol et
      if (cumulativeDisplayBlob.size === 0 || cumulativeUserBlob.size === 0) {
        console.log('Blob sizes too small, skipping...', {
          displaySize: cumulativeDisplayBlob.size,
          userSize: cumulativeUserBlob.size
        })
        return
      }

      console.log('Blob sizes:', {
        display: cumulativeDisplayBlob.size,
        user: cumulativeUserBlob.size
      })

      let mixedBlob: Blob

      try {
        // Mix audio (mevcut logic'i kullan)
        mixedBlob = await mixAudioForRealtime(cumulativeDisplayBlob, cumulativeUserBlob)
      } catch (mixError) {
        console.error('Audio mixing failed, trying simple concatenation:', mixError)

        // Fallback: Sadece display audio'yu kullan veya basit concatenation
        if (cumulativeDisplayBlob.size > cumulativeUserBlob.size) {
          mixedBlob = cumulativeDisplayBlob
        } else {
          mixedBlob = cumulativeUserBlob
        }
      }

      // Transcript et
      const arrayBuffer = await mixedBlob.arrayBuffer()

      if (arrayBuffer.byteLength === 0) {
        console.log('Empty array buffer, skipping transcription')
        return
      }

      // @ts-ignore - API method exists but TypeScript hasn't updated yet
      const result = await window.api.transcribeCumulative(arrayBuffer)

      if (result.success && result.transcription) {
        // Kümülatif transcript'i güncelle
        setRealtimeTranscript(result.transcription.text || '')

        // Son segment'i progress olarak göster
        const segments = result.transcription.segments || []
        const lastSegment = segments[segments.length - 1]
        if (lastSegment) {
          console.log('Latest segment:', lastSegment.text)
        }
      }
    } catch (error) {
      console.error('Cumulative transcription error:', error)

      // Hata durumunda interval'ı yavaşlat
      if (intervalRef.current) {
        clearInterval(intervalRef.current)
        intervalRef.current = setInterval(async () => {
          if (displayRecorder?.state === 'recording' && userRecorder?.state === 'recording') {
            await processCumulativeAudio()
          }
        }, 10000) // 10 saniyede bir dene
      }
    }
  }

  const mixAudioForRealtime = async (displayBlob: Blob, userBlob: Blob): Promise<Blob> => {
    const audioContext = new (window.AudioContext || (window as any).webkitAudioContext)()

    try {
      console.log('Starting audio mixing...', {
        displaySize: displayBlob.size,
        userSize: userBlob.size,
        displayType: displayBlob.type,
        userType: userBlob.type
      })

      // Blob'ları ArrayBuffer'a çevir
      const [displayArrayBuffer, userArrayBuffer] = await Promise.all([
        displayBlob.arrayBuffer(),
        userBlob.arrayBuffer()
      ])

      console.log('ArrayBuffer sizes:', {
        display: displayArrayBuffer.byteLength,
        user: userArrayBuffer.byteLength
      })

      // AudioBuffer'lara decode et - her birini ayrı ayrı try-catch ile
      let displayBuffer: AudioBuffer
      let userBuffer: AudioBuffer

      try {
        displayBuffer = await audioContext.decodeAudioData(displayArrayBuffer.slice(0))
        console.log('Display buffer decoded successfully:', {
          duration: displayBuffer.duration,
          channels: displayBuffer.numberOfChannels,
          sampleRate: displayBuffer.sampleRate
        })
      } catch (error) {
        console.error('Failed to decode display audio:', error)
        throw new Error(`Display audio decode failed: ${error}`)
      }

      try {
        userBuffer = await audioContext.decodeAudioData(userArrayBuffer.slice(0))
        console.log('User buffer decoded successfully:', {
          duration: userBuffer.duration,
          channels: userBuffer.numberOfChannels,
          sampleRate: userBuffer.sampleRate
        })
      } catch (error) {
        console.error('Failed to decode user audio:', error)

        // User audio decode başarısızsa sadece display audio'yu döndür
        console.log('Falling back to display audio only')
        return displayBlob
      }

      // Daha uzun olan süreyi al
      const maxDuration = Math.max(displayBuffer.duration, userBuffer.duration)
      const numberOfChannels = Math.max(displayBuffer.numberOfChannels, userBuffer.numberOfChannels)
      const sampleRate = Math.max(displayBuffer.sampleRate, userBuffer.sampleRate)

      console.log('Mixing parameters:', {
        maxDuration,
        numberOfChannels,
        sampleRate
      })

      // Yeni buffer oluştur
      const mixedBuffer = audioContext.createBuffer(
        numberOfChannels,
        Math.ceil(maxDuration * sampleRate),
        sampleRate
      )

      // Kanal verilerini mix et
      function mixChannelData(target: Float32Array, source: Float32Array, volume: number = 1.0) {
        const length = Math.min(target.length, source.length)
        for (let i = 0; i < length; i++) {
          target[i] += source[i] * volume
        }
      }

      // Display audio'yu ekle (daha düşük volume ile)
      for (let ch = 0; ch < Math.min(displayBuffer.numberOfChannels, numberOfChannels); ch++) {
        const target = mixedBuffer.getChannelData(ch)
        const source = displayBuffer.getChannelData(ch)
        mixChannelData(target, source, 0.7) // Biraz düşük volume
      }

      // User audio'yu ekle
      for (let ch = 0; ch < Math.min(userBuffer.numberOfChannels, numberOfChannels); ch++) {
        const target = mixedBuffer.getChannelData(ch)
        const source = userBuffer.getChannelData(ch)
        mixChannelData(target, source, 1.0) // Normal volume
      }

      // Normalize (clipping'i önle)
      for (let ch = 0; ch < numberOfChannels; ch++) {
        const channel = mixedBuffer.getChannelData(ch)
        let max = 0
        for (let i = 0; i < channel.length; i++) {
          if (Math.abs(channel[i]) > max) max = Math.abs(channel[i])
        }
        if (max > 1) {
          for (let i = 0; i < channel.length; i++) {
            channel[i] /= max
          }
        }
      }

      console.log('Audio mixing completed successfully')

      // WAV olarak encode et
      return encodeWAV(mixedBuffer)
    } catch (error) {
      console.error('Audio mixing failed:', error)
      throw error
    } finally {
      audioContext.close()
    }
  }

  function encodeWAV(audioBuffer: AudioBuffer): Blob {
    const numChannels = audioBuffer.numberOfChannels
    const sampleRate = audioBuffer.sampleRate
    const length = audioBuffer.length * numChannels * 2 + 44
    const buffer = new ArrayBuffer(length)
    const view = new DataView(buffer)

    function writeString(view: DataView, offset: number, str: string) {
      for (let i = 0; i < str.length; i++) {
        view.setUint8(offset + i, str.charCodeAt(i))
      }
    }

    let offset = 0

    // RIFF header
    writeString(view, offset, 'RIFF')
    offset += 4
    view.setUint32(offset, 36 + audioBuffer.length * numChannels * 2, true)
    offset += 4
    writeString(view, offset, 'WAVE')
    offset += 4
    writeString(view, offset, 'fmt ')
    offset += 4
    view.setUint32(offset, 16, true)
    offset += 4
    view.setUint16(offset, 1, true)
    offset += 2
    view.setUint16(offset, numChannels, true)
    offset += 2
    view.setUint32(offset, sampleRate, true)
    offset += 4
    view.setUint32(offset, sampleRate * numChannels * 2, true)
    offset += 4
    view.setUint16(offset, numChannels * 2, true)
    offset += 2
    view.setUint16(offset, 16, true)
    offset += 2
    writeString(view, offset, 'data')
    offset += 4
    view.setUint32(offset, audioBuffer.length * numChannels * 2, true)
    offset += 4

    // PCM data
    for (let i = 0; i < audioBuffer.length; i++) {
      for (let ch = 0; ch < numChannels; ch++) {
        let sample = audioBuffer.getChannelData(ch)[i]
        sample = Math.max(-1, Math.min(1, sample))
        view.setInt16(offset, sample < 0 ? sample * 0x8000 : sample * 0x7fff, true)
        offset += 2
      }
    }

    return new Blob([buffer], { type: 'audio/wav' })
  }

  // Listen for transcription events
  useEffect(() => {
    // Listen for transcription start
    window.api.onTranscribeStart(() => {
      console.log('Transcription started...')
      setIsTranscribing(true)
    })

    // Listen for transcription result
    window.api.onTranscribeResult((result) => {
      console.log('Transcription completed:', result)
      setIsTranscribing(false)

      // Extract the actual transcription data from the response structure
      if (result && result.transcription && Array.isArray(result.transcription)) {
        const transcriptionData = {
          text: result.transcription[0]?.text || '',
          language: result.result?.language || '',
          segments: result.transcription || []
        }
        setTranscriptionResult(transcriptionData)
      } else {
        console.error('Invalid transcription result structure:', result)
        setTranscriptionResult(null)
      }
    })

    // @ts-ignore - API method exists but TypeScript hasn't updated yet
    window.api.onCumulativeTranscribeResult((result) => {
      console.log('Cumulative transcription received:', result.transcription)
      if (result && result.transcription) {
        const transcriptions = result.transcription.transcription
        let newTranscript = ''
        transcriptions.forEach((transcription: any) => {
          newTranscript += transcription.text + ' '
        })

        console.log('New transcript:', newTranscript)
        setRealtimeTranscript(newTranscript)
      }
    })

    window.api.onSummaryResult((result) => {
      console.log('Summary completed:', result)
      // Clean and process the markdown content
      const cleanSummary =
        typeof result === 'string'
          ? result
              .replace(/^```markdown\n/, '') // Remove opening markdown block
              .replace(/\n```$/, '') // Remove closing block
              .trim() // Remove extra whitespace
          : ''

      console.log('Cleaned summary:', cleanSummary)
      setSummaryResult(cleanSummary)

      return () => {
        // ... mevcut cleanup ...

        if (intervalRef.current) {
          clearInterval(intervalRef.current)
        }
      }
    })

    // Cleanup listeners on unmount
    return () => {
      window.api.removeTranscribeListeners()
      window.api.removeSummaryListeners()
    }
  }, [])

  // Sesler üst üste binmeli: İki kaydı PCM olarak decode edip, mixleyip, tekrar encode ediyoruz.
  useEffect(() => {
    async function mixAndCombineAudio() {
      if (displayAudioBlob && userAudioBlob && !isRecording) {
        console.log('Both recordings completed, mixing display and user audio...')

        try {
          const audioContext = new (window.AudioContext || (window as any).webkitAudioContext)()

          // Decode both blobs to AudioBuffer
          const [displayBuffer, userBuffer] = await Promise.all([
            displayAudioBlob
              .arrayBuffer()
              .then((buf) => audioContext.decodeAudioData(buf.slice(0))),
            userAudioBlob.arrayBuffer().then((buf) => audioContext.decodeAudioData(buf.slice(0)))
          ])

          // Determine the longest duration
          const maxDuration = Math.max(displayBuffer.duration, userBuffer.duration)
          const numberOfChannels = Math.max(
            displayBuffer.numberOfChannels,
            userBuffer.numberOfChannels
          )

          // Create a new buffer for the mix
          const mixedBuffer = audioContext.createBuffer(
            numberOfChannels,
            Math.ceil(maxDuration * audioContext.sampleRate),
            audioContext.sampleRate
          )

          // Helper to copy and sum channel data
          function mixChannelData(target: Float32Array, source: Float32Array) {
            for (let i = 0; i < source.length; i++) {
              target[i] += source[i]
            }
          }

          // Mix displayBuffer
          for (let ch = 0; ch < displayBuffer.numberOfChannels; ch++) {
            const target = mixedBuffer.getChannelData(ch)
            const source = displayBuffer.getChannelData(ch)
            mixChannelData(target, source)
          }
          // Mix userBuffer
          for (let ch = 0; ch < userBuffer.numberOfChannels; ch++) {
            const target = mixedBuffer.getChannelData(ch)
            const source = userBuffer.getChannelData(ch)
            mixChannelData(target, source)
          }

          // Normalize to prevent clipping
          for (let ch = 0; ch < numberOfChannels; ch++) {
            const channel = mixedBuffer.getChannelData(ch)
            let max = 0
            for (let i = 0; i < channel.length; i++) {
              if (Math.abs(channel[i]) > max) max = Math.abs(channel[i])
            }
            if (max > 1) {
              for (let i = 0; i < channel.length; i++) {
                channel[i] /= max
              }
            }
          }

          // Encode to WAV (browser-friendly, lossless)
          function encodeWAV(audioBuffer: AudioBuffer): Blob {
            const numChannels = audioBuffer.numberOfChannels
            const sampleRate = audioBuffer.sampleRate
            const length = audioBuffer.length * numChannels * 2 + 44
            const buffer = new ArrayBuffer(length)
            const view = new DataView(buffer)

            function writeString(view: DataView, offset: number, str: string) {
              for (let i = 0; i < str.length; i++) {
                view.setUint8(offset + i, str.charCodeAt(i))
              }
            }

            let offset = 0

            // RIFF identifier
            writeString(view, offset, 'RIFF')
            offset += 4
            view.setUint32(offset, 36 + audioBuffer.length * numChannels * 2, true)
            offset += 4
            writeString(view, offset, 'WAVE')
            offset += 4
            writeString(view, offset, 'fmt ')
            offset += 4
            view.setUint32(offset, 16, true)
            offset += 4 // Subchunk1Size
            view.setUint16(offset, 1, true)
            offset += 2 // AudioFormat (PCM)
            view.setUint16(offset, numChannels, true)
            offset += 2
            view.setUint32(offset, sampleRate, true)
            offset += 4
            view.setUint32(offset, sampleRate * numChannels * 2, true)
            offset += 4
            view.setUint16(offset, numChannels * 2, true)
            offset += 2
            view.setUint16(offset, 16, true)
            offset += 2
            writeString(view, offset, 'data')
            offset += 4
            view.setUint32(offset, audioBuffer.length * numChannels * 2, true)
            offset += 4

            // Write interleaved PCM samples
            for (let i = 0; i < audioBuffer.length; i++) {
              for (let ch = 0; ch < numChannels; ch++) {
                let sample = audioBuffer.getChannelData(ch)[i]
                sample = Math.max(-1, Math.min(1, sample))
                view.setInt16(offset, sample < 0 ? sample * 0x8000 : sample * 0x7fff, true)
                offset += 2
              }
            }

            return new Blob([buffer], { type: 'audio/wav' })
          }

          const mixedBlob = encodeWAV(mixedBuffer)
          const mixedUrl = URL.createObjectURL(mixedBlob)
          setCombinedAudioUrl(mixedUrl)
          console.log('Mixed audio URL:', mixedUrl)

          //  the mixed audio blob
          saveCombinedAudioFromBlob(mixedBlob)

          // Clean up
          audioContext.close()
        } catch (err) {
          console.error('Error mixing audio:', err)
        }
      }
    }
    mixAndCombineAudio()
  }, [displayAudioBlob, userAudioBlob, isRecording])

  // Yeni fonksiyon - fetch kullanmadan:
  async function saveCombinedAudioFromBlob(blob: Blob) {
    try {
      console.log('Converting blob to ArrayBuffer, size:', blob.size)

      // ✅ Direkt blob'dan ArrayBuffer'a çevir - fetch yok!
      const arrayBuffer = await blob.arrayBuffer()
      console.log('ArrayBuffer size after conversion:', arrayBuffer.byteLength)

      const result = await window.api.saveCombinedAudio(arrayBuffer)

      if (result.success) {
        console.log('Audio saved successfully:', result.filePath)
      } else {
        console.error('Failed to save audio:', result.error)
      }
    } catch (error) {
      console.error('Error saving audio:', error)
    }
  }

  const handleStartRecording = async () => {
    console.log('Starting recording...')

    try {
      // Önce API desteğini kontrol et
      console.log('getDisplayMedia support:', !!navigator.mediaDevices?.getDisplayMedia)
      console.log('User Agent:', navigator.userAgent)

      if (!navigator.mediaDevices?.getDisplayMedia) {
        throw new Error('getDisplayMedia API not supported')
      }

      console.log('Requesting display media...')

      // Get display media (screen recording)
      const displayStream = await navigator.mediaDevices.getDisplayMedia({
        video: false,
        audio: true
      })

      console.log('Display stream acquired successfully:', displayStream)
      console.log('Display video tracks:', displayStream.getVideoTracks())
      console.log('Display audio tracks:', displayStream.getAudioTracks())

      // Get user media (microphone)
      const userStream = await navigator.mediaDevices.getUserMedia({
        video: false,
        audio: true
      })

      console.log('User stream acquired successfully:', userStream)
      console.log('User audio tracks:', userStream.getAudioTracks())

      setDisplayStream(displayStream)
      setUserStream(userStream)

      // Clear previous chunks
      setDisplayAudioChunks([])
      setUserAudioChunks([])
      displayAudioChunksRef.current = []
      userAudioChunksRef.current = []

      // Clear previous URLs and blobs
      setCombinedAudioUrl('')
      setDisplayAudioUrl('')
      setUserAudioUrl('')
      setDisplayAudioBlob(null)
      setUserAudioBlob(null)

      setIsTranscribing(false)
      setTranscriptionResult(null)

      // En uygun format'ı belirle
      const getSupportedMimeType = (): string => {
        const types = [
          'audio/wav',
          'audio/webm;codecs=opus',
          'audio/webm;codecs=pcm',
          'audio/webm',
          'audio/ogg;codecs=opus'
        ]

        for (const type of types) {
          if (MediaRecorder.isTypeSupported(type)) {
            console.log('Using supported MIME type:', type)
            return type
          }
        }

        console.log('No optimal MIME type found, using default')
        return 'audio/webm'
      }

      const mimeType = getSupportedMimeType()

      // Create separate recorders for each stream
      const displayRecorder = new MediaRecorder(displayStream, {
        mimeType,
        audioBitsPerSecond: 128000
      })
      const userRecorder = new MediaRecorder(userStream, {
        mimeType,
        audioBitsPerSecond: 128000
      })

      // Display recorder event listeners
      displayRecorder.addEventListener('dataavailable', (event) => {
        if (event.data.size > 0) {
          displayAudioChunksRef.current.push(event.data)
          setDisplayAudioChunks([...displayAudioChunksRef.current])
        }
      })

      displayRecorder.addEventListener('stop', () => {
        if (displayAudioChunksRef.current.length > 0) {
          console.log('Display chunks:', displayAudioChunksRef.current.length)

          const displayAudioBlob = new Blob(displayAudioChunksRef.current, {
            type: 'audio/webm' // Keep as webm for MediaRecorder compatibility
          })

          console.log('Display blob size:', displayAudioBlob.size)

          // ✅ Hem URL hem blob'u sakla
          setDisplayAudioUrl(URL.createObjectURL(displayAudioBlob))
          setDisplayAudioBlob(displayAudioBlob)
        }
      })

      // User recorder event listeners
      userRecorder.addEventListener('dataavailable', (event) => {
        if (event.data.size > 0) {
          userAudioChunksRef.current.push(event.data)
          setUserAudioChunks([...userAudioChunksRef.current])
        }
      })

      userRecorder.addEventListener('stop', () => {
        if (userAudioChunksRef.current.length > 0) {
          console.log('User chunks:', userAudioChunksRef.current.length)

          const userAudioBlob = new Blob(userAudioChunksRef.current, {
            type: 'audio/webm' // Keep as webm for MediaRecorder compatibility
          })

          console.log('User blob size:', userAudioBlob.size)

          // ✅ Hem URL hem blob'u sakla
          setUserAudioUrl(URL.createObjectURL(userAudioBlob))
          setUserAudioBlob(userAudioBlob)
        }
      })

      // Start both recorders with timeslice for regular chunks
      displayRecorder.start(1000) // Her saniye chunk
      userRecorder.start(1000) // Her saniye chunk

      setDisplayRecorder(displayRecorder)
      setUserRecorder(userRecorder)
      setIsRecording(true)

      setTimeout(() => {
        startRealtimeTranscription()
      }, 1000)
    } catch (error) {
      console.error('Error details:', {
        name: (error as Error).name,
        message: (error as Error).message,
        stack: (error as Error).stack,
        code: (error as any).code
      })
    }
  }

  const handleStopRecording = async () => {
    if (displayRecorder && userRecorder && isRecording) {
      displayRecorder.stop()
      userRecorder.stop()
      displayStream?.getTracks().forEach((track) => track.stop())
      userStream?.getTracks().forEach((track) => track.stop())
      setIsRecording(false)

      if (intervalRef.current) {
        clearInterval(intervalRef.current)
        intervalRef.current = null
      }
      setIsRealtimeMode(false)
    }
  }

  // Cleanup on unmount
  useEffect(() => {
    return () => {
      if (displayStream) {
        displayStream.getTracks().forEach((track) => track.stop())
      }
      if (userStream) {
        userStream.getTracks().forEach((track) => track.stop())
      }
    }
  }, [displayStream, userStream])

  return (
    <div className="flex flex-col items-center justify-start h-screen pt-10 space-y-3">
      <h1 className="text-2xl font-bold text-black pb-3 my-3">Screen & Microphone Recorder</h1>
      <Button onClick={isRecording ? handleStopRecording : handleStartRecording}>
        {isRecording ? 'Stop Recording' : 'Start Recording'}
      </Button>

      {/* Real-time toggle switch */}
      <div className="flex items-center space-x-3 my-3">
        <Switch
          checked={isRealtimeMode}
          className="mx-2"
          onCheckedChange={(checked) => {
            if (checked && isRecording) {
              startRealtimeTranscription()
            } else if (!checked && isRealtimeMode) {
              if (intervalRef.current) {
                clearInterval(intervalRef.current)
                intervalRef.current = null
              }
              setIsRealtimeMode(false)
            }
          }}
          disabled={!isRecording}
        />
        <label className="text-sm font-medium leading-none peer-disabled:cursor-not-allowed peer-disabled:opacity-70 text-black">
          {isRealtimeMode ? (
            <span className="flex items-center mx-2">Live Transcription Active</span>
          ) : (
            <span className="flex items-center mx-2">Enable Live Transcription</span>
          )}
        </label>
      </div>
      {/* Live Transcription Display */}
      {true && (
        <div className="mt-4 max-w-xl w-full text-black">
          <h3 className="text-md font-semibold mb-2 flex items-center">
            <svg className="w-4 h-4 mr-2 text-blue-500" fill="currentColor" viewBox="0 0 20 20">
              <circle cx="10" cy="10" r="8" className="animate-pulse" />
            </svg>
            Live Transcription
          </h3>
          <div className="bg-gray-50 border rounded-lg p-3 min-h-[48px] text-black whitespace-pre-line">
            {true ? (
              <span>{realtimeTranscript}</span>
            ) : (
              <span className="text-gray-400">Listening...</span>
            )}
          </div>
        </div>
      )}
      {combinedAudioUrl && (
        <div className="mt-4 space-y-4 max-w-xl">
          <div>
            <h3 className="text-lg font-semibold mb-2">Recording</h3>
          </div>

          {/* Transcription Status */}
          {isTranscribing && (
            <div className="flex items-center space-x-2 text-blue-600">
              <svg
                className="animate-spin h-5 w-5"
                xmlns="http://www.w3.org/2000/svg"
                fill="none"
                viewBox="0 0 24 24"
              >
                <circle
                  className="opacity-25"
                  cx="12"
                  cy="12"
                  r="10"
                  stroke="currentColor"
                  strokeWidth="4"
                ></circle>
                <path
                  className="opacity-75"
                  fill="currentColor"
                  d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"
                ></path>
              </svg>
              <span>Transcribing audio...</span>
            </div>
          )}

          {/* Transcription Results */}
          {transcriptionResult && (
            <div className="bg-white border rounded-lg shadow-sm w-full text-black min-w-xl">
              <div className="p-4 border-b">
                <div className="flex items-center space-x-4">
                  <DropdownMenu>
                    <DropdownMenuTrigger asChild>
                      <Button variant="outline">
                        {modes[mode].icon}
                        {modes[mode].title}
                      </Button>
                    </DropdownMenuTrigger>{' '}
                    <DropdownMenuContent>
                      {Object.values(modes).map((mode) => (
                        <DropdownMenuItem
                          key={mode.id}
                          onClick={() => setMode(mode.id as 'transcription' | 'summary' | 'video')}
                        >
                          {mode.icon}
                          {mode.title}
                        </DropdownMenuItem>
                      ))}
                    </DropdownMenuContent>
                  </DropdownMenu>
                  <Button
                    variant="outline"
                    onClick={async () => {
                      let success = false
                      switch (mode) {
                        case 'transcription':
                          const transcriptionText = transcriptionResult.segments
                            .map((segment) => segment.text)
                            .join(' ')
                          success = await window.api.writeClipboard(transcriptionText)
                          break
                        case 'summary':
                          success = await window.api.writeClipboard(summaryResult)
                      }
                      if (success) {
                        toast('Copied to clipboard')
                      } else {
                        toast('Failed to copy to clipboard')
                      }
                    }}
                    className="ml-4"
                  >
                    <CopyIcon />
                    Copy
                  </Button>
                </div>
              </div>
              <div className="p-4 border-b">
                <div className="flex items-center space-x-2">
                  <svg
                    className="w-5 h-5 text-gray-500"
                    fill="none"
                    stroke="currentColor"
                    viewBox="0 0 24 24"
                    xmlns="http://www.w3.org/2000/svg"
                  >
                    <path
                      strokeLinecap="round"
                      strokeLinejoin="round"
                      strokeWidth="2"
                      d="M19 11a7 7 0 01-7 7m0 0a7 7 0 01-7-7m7 7v4m0 0H8m4 0h4m-4-8a3 3 0 01-3-3V5a3 3 0 116 0v6a3 3 0 01-3 3z"
                    ></path>
                  </svg>
                  <audio src={combinedAudioUrl} controls className="w-full px-5" />
                </div>
              </div>

              {mode === 'transcription' && (
                <div className="divide-y">
                  {transcriptionResult.segments.map((segment, index) => (
                    <div key={index} className="p-4 hover:bg-gray-50">
                      <div className="flex items-center">
                        <div className="flex-shrink-0 text-xs text-gray-500 font-mono mt-1 pr-4">
                          {segment.timestamps
                            ? segment.timestamps.from
                            : segment.start
                              ? `${segment.start.toFixed(2)}s`
                              : '00:00:00,000'}
                        </div>
                        <div className="ml-4 flex-grow">
                          <p className="text-gray-900 select-text">{segment.text}</p>
                        </div>
                      </div>
                    </div>
                  ))}
                </div>
              )}

              {mode === 'summary' && (
                <div className="p-4">
                  <div className="w-full">
                    {summaryResult ? (
                      <div className="prose max-w-none">
                        <Editor initialMarkdown={summaryResult} />
                      </div>
                    ) : (
                      <div className="text-gray-500 text-center py-4">No summary available yet</div>
                    )}
                  </div>
                </div>
              )}

              {mode === 'video' && (
                <div className="p-4">
                  <div className="w-full flex flex-col items-center justify-center">
                    <h2 className="text-2xl font-bold">Come Later!</h2>
                    <p className="text-gray-500">Video mode is coming soon!</p>
                  </div>
                </div>
              )}

              <div className="p-4 bg-gray-50 rounded-b-lg">
                <div className="flex items-center justify-between text-sm text-gray-500">
                  <span>Language: {transcriptionResult.language.toUpperCase()}</span>
                  <span>{transcriptionResult.segments.length} segments</span>
                </div>
              </div>
            </div>
          )}
        </div>
      )}
      <Toaster />
    </div>
  )
}

export default AudioRecorder
