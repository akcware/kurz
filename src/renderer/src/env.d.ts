/// <reference types="vite/client" />

declare global {
  interface Window {
    electron: {
      ipcRenderer: {
        send: (channel: string, ...args: any[]) => void
        invoke: (channel: string, ...args: any[]) => Promise<any>
      }
    }
    api: {
      getSources: () => Promise<any[]>
      saveRecording: (buffer: ArrayBuffer) => Promise<boolean>
      getSystemAudio: () => Promise<MediaStream | null>
      saveCombinedAudio: (arrayBuffer: ArrayBuffer) => Promise<{ success: boolean; filePath?: string; error?: string }>
      onTranscribeStart: (callback: () => void) => void
      onTranscribeResult: (callback: (result: any) => void) => void
      removeTranscribeListeners: () => void
      onSummaryResult: (callback: (result: string) => void) => void
      removeSummaryListeners: () => void
    }
  }
}

export {}
