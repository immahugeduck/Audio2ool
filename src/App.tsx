import React, { useState, useEffect, useCallback } from 'react';
import { VisualizerSettings, AiNoiseDetectionResult } from './types';
import { useAudioEngine } from './hooks/useAudioEngine';
import { useNoiseBaseline } from './hooks/useNoiseBaseline';
import { Header } from './components/Header';
import { CanvasVisualizer } from './components/CanvasVisualizer';
import { AudioControls } from './components/AudioControls';
import { VisualizerControls } from './components/VisualizerControls';
import { ColorGradientPicker } from './components/ColorGradientPicker';
import { EqualizerPanel } from './components/EqualizerPanel';
import { AiNoiseDetector } from './components/AiNoiseDetector';
import { NoiseBaselineMonitor } from './components/NoiseBaselineMonitor';
import { AcousticGuide } from './components/AcousticGuide';
import { ReportExporter } from './components/ReportExporter';
import { AudioMeters } from './components/AudioMeters';
import { DropZone } from './components/DropZone';
import { TranscriptionPanel } from './components/TranscriptionPanel';
import { SoundTimelineProfiler } from './components/SoundTimelineProfiler';
import { AcousticRoomRt60 } from './components/AcousticRoomRt60';
import { HarmonicTuner } from './components/HarmonicTuner';
import { EventAnomalyLog } from './components/EventAnomalyLog';
import { UrlAudioAnalyzer } from './components/UrlAudioAnalyzer';
import { MicSettingsSelector } from './components/MicSettingsSelector';
import { Mic, Music, Volume2 } from 'lucide-react';

export default function App() {
  const [settings, setSettings] = useState<VisualizerSettings>({
    mode: 'bars',
    fftSize: 2048,
    smoothing: 0.8,
    minDecibels: -90,
    maxDecibels: -10,
    showHzScale: true,
    showDbGrid: true,
    showPeaks: true,
    colorPresetId: 'cyberpunk',
    customGradient: {
      start: '#00f0ff',
      middle: '#7000ff',
      end: '#ff007f',
      peak: '#ffffff',
    },
    useCustomGradient: false,
    sensitivity: 1.0,
    logScale: true,
    reactiveColors: true,
    beatPulseAnimation: false,
    fillOpacity: 0.6,
    barSpacing: 3,
    barWidthMultiplier: 1.0,
  });

  const [isGuideOpen, setIsGuideOpen] = useState(false);
  const [isReportOpen, setIsReportOpen] = useState(false);
  const [latestAiResult, setLatestAiResult] = useState<AiNoiseDetectionResult | null>(null);

  // Tab State: 'live' (Mic/Acoustic space) or 'media' (Audio files/YouTube streams)
  const [activeTab, setActiveTab] = useState<'live' | 'media'>('live');

  const updateSettings = useCallback((partial: Partial<VisualizerSettings>) => {
    setSettings((prev) => ({ ...prev, ...partial }));
  }, []);

  const {
    engineState,
    metrics,
    play,
    pause,
    seek,
    setVolume,
    toggleMute,
    setEq,
    setPlaybackRate,
    setPan,
    loadSampleTrack,
    loadAudioFile,
    loadAudioFromUrl,
    enableMicrophone,
    toggleMicMonitoring,
    getFrequencyData,
    getTimeDomainData,
    mediaStreamDestinationRef,
    loadedFile,
  } = useAudioEngine(settings);

  // Feature #1: Long-term noise baseline profiling
  const { profile, isCalibrating, startCalibration, resetTransients } = useNoiseBaseline(
    getFrequencyData,
    metrics,
    engineState.sourceType === 'mic' || engineState.isPlaying
  );

  // Tab Switcher Side Effects:
  // - When switching to 'live', auto-enable live microphone.
  // - When switching to 'media', pause/stop mic and load default sample track.
  useEffect(() => {
    if (activeTab === 'live') {
      enableMicrophone();
    } else {
      // Back to default playback sample
      loadSampleTrack('synthwave');
    }
  }, [activeTab, enableMicrophone, loadSampleTrack]);

  return (
    <DropZone onFileDrop={loadAudioFile}>
      <div className="min-h-screen bg-slate-950 text-slate-100 font-sans antialiased selection:bg-cyan-500 selection:text-slate-950">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-6 flex flex-col gap-6">
          
          {/* Header */}
          <Header
            sourceType={engineState.sourceType}
            metrics={metrics}
            onOpenGuide={() => setIsGuideOpen(true)}
            onOpenReport={() => setIsReportOpen(true)}
          />

          {/* Main Visualizer Top Stage Canvas */}
          <CanvasVisualizer
            settings={settings}
            getFrequencyData={getFrequencyData}
            getTimeDomainData={getTimeDomainData}
            metrics={metrics}
            isPlaying={engineState.isPlaying}
          />

          {/* Premium Tab Bar Navigation */}
          <div className="flex bg-slate-900 border border-slate-800 p-1.5 rounded-2xl gap-2 shadow-lg self-center md:self-stretch">
            <button
              onClick={() => setActiveTab('live')}
              id="tab-btn-live-space"
              className={`flex-1 py-3 px-4 rounded-xl font-extrabold text-sm flex items-center justify-center gap-2.5 transition-all cursor-pointer ${
                activeTab === 'live'
                  ? 'bg-gradient-to-r from-rose-500/20 to-pink-500/20 border border-rose-500/50 text-rose-300 shadow-[0_0_12px_rgba(244,63,94,0.15)]'
                  : 'text-slate-400 hover:text-slate-200 border border-transparent hover:bg-slate-850'
              }`}
            >
              <Mic className={`w-4 h-4 ${activeTab === 'live' ? 'text-rose-400 animate-pulse' : 'text-slate-400'}`} />
              <span>🎙️ Live Acoustic Space Analyzer</span>
            </button>
            
            <button
              onClick={() => setActiveTab('media')}
              id="tab-btn-media-analyzer"
              className={`flex-1 py-3 px-4 rounded-xl font-extrabold text-sm flex items-center justify-center gap-2.5 transition-all cursor-pointer ${
                activeTab === 'media'
                  ? 'bg-gradient-to-r from-cyan-500/20 to-blue-500/20 border border-cyan-500/50 text-cyan-300 shadow-[0_0_12px_rgba(6,182,212,0.15)]'
                  : 'text-slate-400 hover:text-slate-200 border border-transparent hover:bg-slate-850'
              }`}
            >
              <Music className={`w-4 h-4 ${activeTab === 'media' ? 'text-cyan-400 animate-pulse' : 'text-slate-400'}`} />
              <span>🎵 File & YouTube Stream Analyzer</span>
            </button>
          </div>

          {/* Responsive Dashboard Grid */}
          <main className="flex flex-col gap-6">
            
            {/* TAB 1: LIVE ACOUSTIC SPACE MONITORING */}
            {activeTab === 'live' && (
              <div className="grid grid-cols-1 lg:grid-cols-12 gap-6 animate-fadeIn">
                
                {/* Left Primary Space (Calibration, RT60 & Timeline Graphs) */}
                <div className="lg:col-span-8 flex flex-col gap-6">
                  {/* 1. Custom Mic & Bluetooth Device Selector Settings */}
                  <MicSettingsSelector
                    engineState={engineState}
                    enableMicrophone={enableMicrophone}
                    toggleMicMonitoring={toggleMicMonitoring}
                    metrics={metrics}
                  />

                  {/* 2. Background Noise Baseline (Calibrate Room - Runs Default) */}
                  <NoiseBaselineMonitor
                    profile={profile}
                    metrics={metrics}
                    isCalibrating={isCalibrating}
                    startCalibration={startCalibration}
                    resetTransients={resetTransients}
                    isListening={engineState.sourceType === 'mic' || engineState.isPlaying}
                  />

                  {/* 3. Room Acoustic Response (RT60 decay - Runs Default) */}
                  <AcousticRoomRt60
                    metrics={metrics}
                    isListening={engineState.sourceType === 'mic' || engineState.isPlaying}
                    getFrequencyData={getFrequencyData}
                  />

                  {/* 4. Room Continuous Sound Timeline Profiler (Runs Default) */}
                  <SoundTimelineProfiler
                    metrics={metrics}
                    isListening={engineState.sourceType === 'mic' || engineState.isPlaying}
                    getFrequencyData={getFrequencyData}
                  />
                </div>

                {/* Right Secondary Space (AI classification, Logs, and UI Color Tools) */}
                <div className="lg:col-span-4 flex flex-col gap-6">
                  {/* 1. AI Live Mic Classifier & Sound Guesser */}
                  <AiNoiseDetector
                    engineState={engineState}
                    metrics={metrics}
                    enableMicrophone={enableMicrophone}
                    onDetectResult={setLatestAiResult}
                  />

                  {/* 2. Harmonic Pitch Tuner */}
                  <HarmonicTuner
                    metrics={metrics}
                    getFrequencyData={getFrequencyData}
                  />

                  {/* 3. Live Sound Event & Anomaly Log */}
                  <EventAnomalyLog
                    metrics={metrics}
                    currentTime={engineState.currentTime}
                    isPlaying={engineState.isPlaying || engineState.sourceType === 'mic'}
                  />

                  {/* 4. Live Voice Transcription Panel */}
                  <TranscriptionPanel
                    mediaStreamDestinationRef={mediaStreamDestinationRef}
                    engineState={engineState}
                    loadedFile={loadedFile}
                  />

                  {/* 5. Tweak Canvas Visual Parameters & Modes */}
                  <div className="bg-slate-900 border border-slate-800 rounded-2xl p-4 shadow-md">
                    <h3 className="text-xs font-black text-slate-400 uppercase tracking-widest mb-3 flex items-center gap-1.5">
                      <Volume2 className="w-3.5 h-3.5 text-cyan-400" />
                      Visual Scale Options
                    </h3>
                    <VisualizerControls settings={settings} updateSettings={updateSettings} />
                  </div>

                  {/* 6. Color Schemes & Gradient Designer */}
                  <ColorGradientPicker settings={settings} updateSettings={updateSettings} />

                  {/* 7. Live Telemetry & Gauges */}
                  <AudioMeters metrics={metrics} />
                </div>

              </div>
            )}

            {/* TAB 2: PLAYBACK MEDIA & STREAM ANALYZER */}
            {activeTab === 'media' && (
              <div className="grid grid-cols-1 lg:grid-cols-12 gap-6 animate-fadeIn">
                
                {/* Left Primary Space (Files & Control Playback decks) */}
                <div className="lg:col-span-8 flex flex-col gap-6">
                  {/* 1. YouTube Extraction & Direct URL Streaming */}
                  <UrlAudioAnalyzer
                    engineState={engineState}
                    loadAudioFromUrl={loadAudioFromUrl}
                    loadSampleTrack={loadSampleTrack}
                    enableMicrophone={enableMicrophone}
                    play={play}
                    pause={pause}
                  />

                  {/* 2. Core Playback Slider & Audio Decks */}
                  <AudioControls
                    engineState={engineState}
                    play={play}
                    pause={pause}
                    seek={seek}
                    setVolume={setVolume}
                    toggleMute={toggleMute}
                    loadSampleTrack={loadSampleTrack}
                    loadAudioFile={loadAudioFile}
                    enableMicrophone={enableMicrophone}
                    toggleMicMonitoring={toggleMicMonitoring}
                  />

                  {/* 3. Graphic Equalizer & Spatial Panner Panel */}
                  <EqualizerPanel
                    engineState={engineState}
                    setEq={setEq}
                    setPlaybackRate={setPlaybackRate}
                    setPan={setPan}
                  />
                </div>

                {/* Right Secondary Space (Voice transcript & Styling controls) */}
                <div className="lg:col-span-4 flex flex-col gap-6">
                  {/* 1. File Speech-to-Text Transcription Panel */}
                  <TranscriptionPanel
                    mediaStreamDestinationRef={mediaStreamDestinationRef}
                    engineState={engineState}
                    loadedFile={loadedFile}
                  />

                  {/* 2. Tweak Canvas Visual Parameters & Modes */}
                  <div className="bg-slate-900 border border-slate-800 rounded-2xl p-4 shadow-md">
                    <h3 className="text-xs font-black text-slate-400 uppercase tracking-widest mb-3 flex items-center gap-1.5">
                      <Volume2 className="w-3.5 h-3.5 text-cyan-400" />
                      Visual Scale Options
                    </h3>
                    <VisualizerControls settings={settings} updateSettings={updateSettings} />
                  </div>

                  {/* 3. Color Schemes & Gradient Designer */}
                  <ColorGradientPicker settings={settings} updateSettings={updateSettings} />

                  {/* 4. Live Telemetry & Gauges */}
                  <AudioMeters metrics={metrics} />
                </div>

              </div>
            )}

          </main>

          {/* Interactive Acoustic Diagnostic Guide Modal */}
          <AcousticGuide isOpen={isGuideOpen} onClose={() => setIsGuideOpen(false)} />

          {/* Exportable Sound Audit Report Modal */}
          <ReportExporter
            metrics={metrics}
            profile={profile}
            latestAiResult={latestAiResult}
            isOpen={isReportOpen}
            onClose={() => setIsReportOpen(false)}
          />

          {/* Footer */}
          <footer className="pt-6 border-t border-slate-800/60 text-center text-xs text-slate-500 flex items-center justify-between flex-wrap gap-2">
            <span>
              Professional Audio Analysis Suite &bull; Web Audio API &bull; Gemini 3.6 AI Noise Classifier
            </span>
            <div className="flex items-center gap-4 text-slate-400">
              <span className="font-semibold text-cyan-500">Live Calibration Mode Default</span>
            </div>
          </footer>
          
        </div>
      </div>
    </DropZone>
  );
}
