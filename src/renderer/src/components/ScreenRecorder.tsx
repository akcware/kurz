import React, { useState, useRef, useEffect } from 'react'
import { Button } from './ui/button'
import { Select } from './ui/select'
import { Mic, MicOff, Monitor, Save, Square, Video, Settings, Play, Settings2 } from 'lucide-react'

interface ScreenRecorderProps {}

interface MediaDevice {
  deviceId: string
  label: string
  kind: string
}

type VideoQuality = '720p' | '1080p' | '1440p' | '4K'

const ScreenRecorder: React.FC<ScreenRecorderProps> = () => {
  const [isRecording, setIsRecording] = useState(false)
  const [mediaRecorder, setMediaRecorder] = useState<MediaRecorder | null>(null)
  const [recordedChunks, setRecordedChunks] = useState<Blob[]>([])
  const [audioDevices, setAudioDevices] = useState<MediaDevice[]>([])
  const [selectedAudioDevice, setSelectedAudioDevice] = useState<string>('')
  const [captureSystemAudio, setCaptureSystemAudio] = useState(false)
  const [availableScreens, setAvailableScreens] = useState<any[]>([])
  const [selectedScreen, setSelectedScreen] = useState<string>('')
  const [videoQuality, setVideoQuality] = useState<VideoQuality>('1080p')
  const [frameRate, setFrameRate] = useState<number>(30)
  
  const videoRef = useRef<HTMLVideoElement>(null)

  // Video quality presets
  const qualityPresets = [
    { quality: '720p', width: 1280, height: 720 },
    { quality: '1080p', width: 1920, height: 1080 },
    { quality: '1440p', width: 2560, height: 1440 },
    { quality: '4K', width: 3840, height: 2160 }
  ]

  const calculateQualityPreset = (quality: VideoQuality) => {
    const screen = availableScreens.find(screen => screen.id === selectedScreen)
    const aspectRatio = screen?.width / screen?.height
    return {
      width: quality === '4K' ? 3840 : quality === '1440p' ? 2560 : quality === '1080p' ? 1920 : 1280,
      height: Math.round(quality === '4K' ? 3840 : quality === '1440p' ? 2560 : quality === '1080p' ? 1920 : 1280 / aspectRatio)
    }
  }

  // Frame rate options
  const frameRateOptions = [24, 30, 60]

  useEffect(() => {
    // Get available audio devices
    navigator.mediaDevices.enumerateDevices().then((devices) => {
      const audioInputs = devices
        .filter(device => device.kind === 'audioinput')
        .map(device => ({
          deviceId: device.deviceId,
          label: device.label || `Microphone ${device.deviceId.slice(0, 8)}`,
          kind: device.kind
        }))
      setAudioDevices(audioInputs)
      if (audioInputs.length > 0) {
        setSelectedAudioDevice(audioInputs[0].deviceId)
      }
      console.log('Available audio devices:', audioInputs)
    })

    // Get available screens
    window.api.getSources().then((sources: any[]) => {
      console.log('Available screen sources:', sources)
      setAvailableScreens(sources)
      if (sources.length > 0) {
        setSelectedScreen(sources[0].id)

        qualityPresets.forEach((preset) => {
          preset.width = calculateQualityPreset(preset.quality as VideoQuality).width
          preset.height = calculateQualityPreset(preset.quality as VideoQuality).height
        })
      }
    }).catch(error => {
      console.error('Error getting screen sources:', error)
    })
  }, [])

  const startRecording = async () => {
    try {
      console.log('Starting recording...')
      console.log('Selected screen:', selectedScreen)
      
      // Basic screen capture without audio first
      const stream = await navigator.mediaDevices.getUserMedia({
        audio: false,
        video: {
          mandatory: {
            chromeMediaSource: 'desktop',
            chromeMediaSourceId: selectedScreen,
            minWidth: qualityPresets[videoQuality].width,
            maxWidth: qualityPresets[videoQuality].width,
            minHeight: qualityPresets[videoQuality].height,
            maxHeight: qualityPresets[videoQuality].height,
            minFrameRate: frameRate,
            maxFrameRate: frameRate
          }
        } as any
      })

      console.log('Got video stream:', stream)
      console.log('Video tracks:', stream.getVideoTracks())

      // Check for supported MIME types
      const mimeTypes = [
        'video/webm;codecs=vp9',
        'video/webm;codecs=vp8',
        'video/webm',
        'video/mp4;codecs=h264',
        'video/mp4'
      ]
      
      let selectedMimeType: string | null = null
      for (const mimeType of mimeTypes) {
        if (MediaRecorder.isTypeSupported(mimeType)) {
          selectedMimeType = mimeType
          break
        }
      }
      
      if (!selectedMimeType) {
        throw new Error('No supported video format found')
      }
      
      console.log('Using MIME type:', selectedMimeType)

      const recorder = new MediaRecorder(stream, {
        mimeType: selectedMimeType,
        videoBitsPerSecond: videoQuality === '4K' ? 8000000 : videoQuality === '1440p' ? 6000000 : videoQuality === '1080p' ? 4000000 : 2000000
      })

      const chunks: Blob[] = []
      
      recorder.ondataavailable = (event) => {
        console.log('Data available:', event.data.size)
        if (event.data.size > 0) {
          chunks.push(event.data)
        }
      }

      recorder.onstop = () => {
        console.log('Recording stopped, chunks:', chunks.length)
        setRecordedChunks(chunks)
        stream.getTracks().forEach(track => track.stop())
      }

      recorder.onerror = (event) => {
        console.error('MediaRecorder error:', event)
      }

      recorder.start(1000) // Collect data every second
      setMediaRecorder(recorder)
      setIsRecording(true)
      console.log('Recording started successfully')
    } catch (error) {
      console.error('Error starting recording:', error)
      const errorMessage = error instanceof Error ? error.message : 'Unknown error occurred'
      alert(`Failed to start recording: ${errorMessage}`)
    }
  }

  const stopRecording = () => {
    if (mediaRecorder && isRecording) {
      mediaRecorder.stop()
      setIsRecording(false)
    }
  }

  const saveRecording = async () => {
    if (recordedChunks.length === 0) return

    const blob = new Blob(recordedChunks, { type: 'video/webm' })
    const buffer = await blob.arrayBuffer()
    
    const saved = await window.api.saveRecording(buffer)
    if (saved) {
      setRecordedChunks([])
      alert('Recording saved successfully!')
    }
  }

  const previewRecording = () => {
    if (recordedChunks.length === 0) return

    const blob = new Blob(recordedChunks, { type: 'video/webm' })
    const url = URL.createObjectURL(blob)
    if (videoRef.current) {
      videoRef.current.src = url
    }
  }

  return (
    <div className="min-h-screen bg-gradient-to-br from-slate-900 via-purple-900 to-slate-900">
      <div className="container mx-auto py-8">
        {/* Header */}
        <div className="text-center mb-12">
          <div className="inline-flex items-center justify-center w-16 h-16 bg-gradient-to-r from-red-500 to-pink-500 rounded-full mb-6">
            <Video className="w-8 h-8 text-white" />
          </div>
          <h1 className="text-4xl font-bold text-white mb-2">Screen Recorder</h1>
          <p className="text-slate-300 text-lg">Professional screen recording with audio options</p>
        </div>

        <div className="w-max mx-auto">
          {/* Main Recording Card */}
          <div className="bg-white/10 backdrop-blur-lg rounded-2xl p-8 border border-white/20 shadow-2xl">
            {/* Settings Section */}
            <div className="grid md:grid-cols-2 gap-8 mb-8">
              {/* Screen Selection */}
              <div className="space-y-3">
                <div className="flex items-center space-x-2 mb-3">
                  <Monitor className="w-5 h-5 text-blue-400" />
                  <label className="text-sm font-semibold text-white">Select Screen</label>
                </div>
                <Select
                  value={selectedScreen}
                  onChange={(e) => setSelectedScreen(e.target.value)}
                  disabled={isRecording}
                  className="bg-white/10 border-white/20 text-white placeholder:text-slate-400 focus:border-blue-400 focus:ring-blue-400"
                >
                  {availableScreens.map((screen) => (
                    <option key={screen.id} value={screen.id} className="bg-slate-800 text-white">
                      {screen.name}
                    </option>
                  ))}
                </Select>
              </div>

              {/* Audio Device Selection */}
              <div className="space-y-3">
                <div className="flex items-center space-x-2 mb-3">
                  <Mic className="w-5 h-5 text-green-400" />
                  <label className="text-sm font-semibold text-white">Microphone Input</label>
                </div>
                <Select
                  value={selectedAudioDevice}
                  onChange={(e) => setSelectedAudioDevice(e.target.value)}
                  disabled={isRecording}
                  className="bg-white/10 border-white/20 text-white placeholder:text-slate-400 focus:border-green-400 focus:ring-green-400"
                >
                  {audioDevices.map((device) => (
                    <option key={device.deviceId} value={device.deviceId} className="bg-slate-800 text-white">
                      {device.label}
                    </option>
                  ))}
                </Select>
              </div>
            </div>

            {/* Quality Settings */}
            <div className="grid md:grid-cols-2 gap-8 mb-8">
              {/* Video Quality */}
              <div className="space-y-3">
                <div className="flex items-center space-x-2 mb-3">
                  <Settings2 className="w-5 h-5 text-purple-400" />
                  <label className="text-sm font-semibold text-white">Video Quality</label>
                </div>
                <Select
                  value={videoQuality}
                  onChange={(e) => setVideoQuality(e.target.value as VideoQuality)}
                  disabled={isRecording}
                  className="bg-white/10 border-white/20 text-white placeholder:text-slate-400 focus:border-purple-400 focus:ring-purple-400"
                >
                  <option value="720p" className="bg-slate-800 text-white">720p HD</option>
                  <option value="1080p" className="bg-slate-800 text-white">1080p Full HD</option>
                  <option value="1440p" className="bg-slate-800 text-white">1440p QHD</option>
                  <option value="4K" className="bg-slate-800 text-white">4K Ultra HD</option>
                </Select>
                <p className="text-xs text-slate-400">
                  {qualityPresets[videoQuality].width} × {qualityPresets[videoQuality].height}
                </p>
              </div>

              {/* Frame Rate */}
              <div className="space-y-3">
                <div className="flex items-center space-x-2 mb-3">
                  <Video className="w-5 h-5 text-yellow-400" />
                  <label className="text-sm font-semibold text-white">Frame Rate</label>
                </div>
                <Select
                  value={frameRate}
                  onChange={(e) => setFrameRate(Number(e.target.value))}
                  disabled={isRecording}
                  className="bg-white/10 border-white/20 text-white placeholder:text-slate-400 focus:border-yellow-400 focus:ring-yellow-400"
                >
                  {frameRateOptions.map((fps) => (
                    <option key={fps} value={fps} className="bg-slate-800 text-white">
                      {fps} FPS
                    </option>
                  ))}
                </Select>
                <p className="text-xs text-slate-400">
                  Higher frame rates for smoother motion
                </p>
              </div>
            </div>

            {/* Quality Indicator */}
            <div className="bg-white/5 rounded-xl border border-white/10 p-4 mb-8">
              <div className="flex items-center justify-between">
                <div className="flex items-center space-x-3">
                  <div className="w-10 h-10 bg-gradient-to-r from-purple-500 to-blue-500 rounded-lg flex items-center justify-center">
                    <Settings2 className="w-5 h-5 text-white" />
                  </div>
                  <div>
                    <h4 className="text-sm font-semibold text-white">Current Quality Settings</h4>
                    <p className="text-xs text-slate-400">
                      {qualityPresets[videoQuality].width} × {qualityPresets[videoQuality].height} @ {frameRate}fps
                    </p>
                  </div>
                </div>
                <div className="text-right">
                  <div className="text-sm font-semibold text-white">
                    {videoQuality === '4K' ? '8 Mbps' : videoQuality === '1440p' ? '6 Mbps' : videoQuality === '1080p' ? '4 Mbps' : '2 Mbps'}
                  </div>
                  <div className="text-xs text-slate-400">Bitrate</div>
                </div>
              </div>
            </div>

            {/* System Audio Toggle */}
            <div className="flex items-center justify-between p-4 bg-white/5 rounded-xl border border-white/10 mb-8">
              <div className="flex items-center space-x-3">
                <div className="w-10 h-10 bg-orange-500/20 rounded-lg flex items-center justify-center">
                  <Settings className="w-5 h-5 text-orange-400" />
                </div>
                <div>
                  <label htmlFor="systemAudio" className="text-sm font-semibold text-white">
                    Capture System Audio
                  </label>
                  <p className="text-xs text-slate-400">Record computer sounds and system audio</p>
                </div>
              </div>
              <label className="relative inline-flex items-center cursor-pointer">
                <input
                  type="checkbox"
                  id="systemAudio"
                  checked={captureSystemAudio}
                  onChange={(e) => setCaptureSystemAudio(e.target.checked)}
                  disabled={isRecording}
                  className="sr-only peer"
                />
                <div className="w-11 h-6 bg-slate-600 peer-focus:outline-none peer-focus:ring-4 peer-focus:ring-orange-300/20 rounded-full peer peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:rounded-full after:h-5 after:w-5 after:transition-all peer-checked:bg-orange-500"></div>
              </label>
            </div>

            {/* Recording Controls */}
            <div className="flex justify-center mb-8">
              {!isRecording ? (
                <Button
                  onClick={startRecording}
                  className="bg-gradient-to-r from-red-500 to-pink-500 hover:from-red-600 hover:to-pink-600 text-white px-8 py-4 rounded-xl text-lg font-semibold flex items-center space-x-3 shadow-lg hover:shadow-xl transition-all duration-200 transform hover:scale-105"
                >
                  <Video className="w-6 h-6" />
                  <span>Start Recording</span>
                </Button>
              ) : (
                <Button
                  onClick={stopRecording}
                  className="bg-gradient-to-r from-gray-600 to-gray-700 hover:from-gray-700 hover:to-gray-800 text-white px-8 py-4 rounded-xl text-lg font-semibold flex items-center space-x-3 shadow-lg hover:shadow-xl transition-all duration-200 transform hover:scale-105"
                >
                  <Square className="w-6 h-6" />
                  <span>Stop Recording</span>
                </Button>
              )}
            </div>

            {/* Recording Status */}
            {isRecording && (
              <div className="text-center mb-8">
                <div className="inline-flex items-center space-x-3 bg-red-500/20 border border-red-500/30 text-red-300 px-6 py-3 rounded-full">
                  <div className="w-3 h-3 bg-red-500 rounded-full animate-pulse"></div>
                  <span className="font-semibold">Recording in progress...</span>
                </div>
              </div>
            )}
          </div>

          {/* Preview and Save Section */}
          {recordedChunks.length > 0 && (
            <div className="mt-8 bg-white/10 backdrop-blur-lg rounded-2xl p-8 border border-white/20 shadow-2xl">
              <h3 className="text-xl font-semibold text-white mb-6 text-center">Recording Complete</h3>
              
              <div className="grid md:grid-cols-2 gap-8">
                {/* Video Preview */}
                <div className="space-y-4">
                  <h4 className="text-sm font-semibold text-slate-300">Preview</h4>
                  <video
                    ref={videoRef}
                    controls
                    className="w-full h-64 object-cover rounded-xl border border-white/20 bg-black"
                  />
                </div>

                {/* Action Buttons */}
                <div className="space-y-4">
                  <h4 className="text-sm font-semibold text-slate-300">Actions</h4>
                  <div className="space-y-3">
                    <Button
                      onClick={previewRecording}
                      className="w-full bg-gradient-to-r from-blue-500 to-blue-600 hover:from-blue-600 hover:to-blue-700 text-white py-3 rounded-xl font-semibold flex items-center justify-center space-x-2"
                    >
                      <Play className="w-5 h-5" />
                      <span>Preview Recording</span>
                    </Button>
                    <Button
                      onClick={saveRecording}
                      className="w-full bg-gradient-to-r from-green-500 to-green-600 hover:from-green-600 hover:to-green-700 text-white py-3 rounded-xl font-semibold flex items-center justify-center space-x-2"
                    >
                      <Save className="w-5 h-5" />
                      <span>Save Recording</span>
                    </Button>
                  </div>
                </div>
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  )
}

export default ScreenRecorder 