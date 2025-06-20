// types.ts dosyası oluştur veya main.js'te tanımla

// Global type definitions

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
    transcription: TranscriptionSegment[]
  }
  
  // Whisper API response types
  export interface WhisperSegment {
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
  }
  
  export interface WhisperApiResponse {
    text: string
    segments: WhisperSegment[]
    language: string
  }
  
  // Global declarations
  declare global {
    interface Window {
      electron: ElectronAPI
      api: {
        getSources: () => Promise<any[]>
        saveRecording: (buffer: ArrayBuffer) => Promise<boolean>
        getSystemAudio: () => Promise<MediaStream | null>
        saveCombinedAudio: (arrayBuffer: ArrayBuffer) => Promise<{ success: boolean; filePath?: string; error?: string }>
        onTranscribeStart: (callback: () => void) => void
        onTranscribeResult: (callback: (result: WhisperApiResponse) => void) => void
        removeTranscribeListeners: () => void
        onSummaryResult: (callback: (result: string) => void) => void
        removeSummaryListeners: () => void
      }
    }
  }
  
  // Make these types globally available
  type WhisperApiResponse = WhisperApiResponse
  type WhisperSegment = WhisperSegment
  