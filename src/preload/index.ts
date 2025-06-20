import { contextBridge, ipcRenderer } from 'electron'
import { electronAPI } from '@electron-toolkit/preload'

// Custom APIs for renderer
const api = {
  // Screen recording APIs
  getSources: () => ipcRenderer.invoke('get-sources'),
  saveRecording: (buffer: ArrayBuffer) => ipcRenderer.invoke('save-recording', buffer),
  getSystemAudio: () => ipcRenderer.invoke('get-system-audio'),
  saveCombinedAudio: (arrayBuffer: ArrayBuffer) =>
    ipcRenderer.invoke('save-combined-audio', arrayBuffer),

  // Transcription event listeners
  onTranscribeStart: (callback: () => void) => {
    ipcRenderer.on('transcribe-audio-start', callback)
  },
  onTranscribeResult: (callback: (result: any) => void) => {
    ipcRenderer.on('transcribe-audio-result', (_, result) => callback(result))
  },
  removeTranscribeListeners: () => {
    ipcRenderer.removeAllListeners('transcribe-audio-start')
    ipcRenderer.removeAllListeners('transcribe-audio-result')
  },
  onSummaryResult: (callback: (result: string) => void) => {
    ipcRenderer.on('summarize-transcription-result', (_, result) => callback(result))
  },
  removeSummaryListeners: () => {
    ipcRenderer.removeAllListeners('summarize-transcription-result')
  },
  transcribeCumulative: (arrayBuffer: ArrayBuffer) =>
    ipcRenderer.invoke('transcribe-cumulative', arrayBuffer),

  // Kümülatif transcription event listeners
  onCumulativeTranscribeStart: (callback: () => void) => {
    ipcRenderer.on('cumulative-transcribe-start', callback)
  },

  onCumulativeTranscribeResult: (callback: (result: any) => void) => {
    ipcRenderer.on('cumulative-transcribe-result', (_, result) => callback(result))
  },

  // Listener cleanup
  removeCumulativeTranscribeListeners: () => {
    ipcRenderer.removeAllListeners('cumulative-transcribe-start')
    ipcRenderer.removeAllListeners('cumulative-transcribe-result')
  },

  // Real-time transcription progress
  onRealtimeProgress: (callback: (progress: { elapsed: number; processing: boolean }) => void) => {
    ipcRenderer.on('realtime-progress', (_, progress) => callback(progress))
  },

  removeRealtimeProgressListeners: () => {
    ipcRenderer.removeAllListeners('realtime-progress')
  },

  writeClipboard: (text: string) => ipcRenderer.invoke('write-clipboard', text)

}

// Use `contextBridge` APIs to expose Electron APIs to
// renderer only if context isolation is enabled, otherwise
// just add to the DOM global.
if (process.contextIsolated) {
  try {
    contextBridge.exposeInMainWorld('electron', electronAPI)
    contextBridge.exposeInMainWorld('api', api)
  } catch (error) {
    console.error(error)
  }
} else {
  // @ts-ignore (define in dts)
  window.electron = electronAPI
  // @ts-ignore (define in dts)
  window.api = api
}
