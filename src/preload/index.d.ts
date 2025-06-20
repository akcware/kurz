import { ElectronAPI } from '@electron-toolkit/preload'

declare global {
  interface Window {
    electron: ElectronAPI
    api: {
      getSources: () => Promise<any[]>
      saveRecording: (buffer: ArrayBuffer) => Promise<boolean>
      getSystemAudio: () => Promise<MediaStream | null>
      saveCombinedAudio: (
        arrayBuffer: ArrayBuffer
      ) => Promise<{ success: boolean; filePath?: string; error?: string }>
      onTranscribeStart: (callback: () => void) => void
      onTranscribeResult: (callback: (result: any) => void) => void
      removeTranscribeListeners: () => void
      onSummaryResult: (callback: (result: string) => void) => void
      removeSummaryListeners: () => void
      transcribeCumulative: (arrayBuffer: ArrayBuffer) => Promise<{
        success: boolean
        result?: any
        error?: string
      }>

      onCumulativeTranscribeStart: (callback: () => void) => void
      onCumulativeTranscribeResult: (
        callback: (result: CumulativeTranscriptionResult) => void
      ) => void
      removeCumulativeTranscribeListeners: () => void

      onRealtimeProgress: (callback: (progress: RealtimeProgress) => void) => void
      removeRealtimeProgressListeners: () => void
      writeClipboard: (text: string) => Promise<{ success: boolean }>
    }
  }
}

interface CumulativeTranscriptionResult {
  success: boolean
  transcription?: {
    text: string
    segments: Array<{
      text: string
      start?: number
      end?: number
      timestamps?: {
        from: string
        to: string
      }
    }>
    language: string
  }
  error?: string
  timestamp?: number
}

interface RealtimeProgress {
  elapsed: number
  processing: boolean
}
