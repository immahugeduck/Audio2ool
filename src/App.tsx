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
            activeTab={activeTab}
            onSelectTab={setActiveTab}
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

          {/* ============================================================== */}
          {/* GRAPH & VIEW CONTROLS (DIRECTLY UNDERNEATH VISUALIZER) */}
          {/* ============================================================== */}
          <div className="flex flex-col gap-5">
            {/* Visualizer Mode & Parameter Controls */}
            <VisualizerControls settings={settings} updateSettings={updateSettings} />

            {/* Neon Palettes & Custom Gradient Designer */}
            <ColorGradientPicker settings={settings} updateSettings={updateSettings} />

            {/* Multi-Band VU & Precision RMS / Peak Telemetry */}
            <AudioMeters metrics={metrics} />
          </div>

          {/* ============================================================== */}
          {/* TWO-PAGE EQUIPMENT WORKSPACE */}
          {/* ============================================================== */}
          <main className="flex flex-col gap-6 pt-2">
            
            {/* PAGE 1: LIVE MIC & ACOUSTIC STUDIO EQUIPMENT */}
            {activeTab === 'live' && (
              <div className="flex flex-col gap-6 animate-fadeIn">
                <div className="flex items-center justify-between px-2">
                  <div className="flex items-center gap-2 text-sm font-bold text-rose-300">
                    <Mic className="w-4 h-4 text-rose-400" />
                    <span>LIVE ACOUSTIC HARDWARE & DIAGNOSTIC EQUIPMENT</span>
                  </div>
                  <span className="text-xs text-slate-400 font-mono">Microphone Channel & Room Acoustics</span>
                </div>

                <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">
                  {/* Left Column (Hardware & Room Acoustics) */}
                  <div className="lg:col-span-6 flex flex-col gap-6">
                    {/* 1. Hardware Mic & Device Selector */}
                    <MicSettingsSelector
                      engineState={engineState}
                      enableMicrophone={enableMicrophone}
                      toggleMicMonitoring={toggleMicMonitoring}
                      metrics={metrics}
                    />

                    {/* 2. Room Noise Floor Baseline & SNR Monitor */}
                    <NoiseBaselineMonitor
                      profile={profile}
                      metrics={metrics}
                      isCalibrating={isCalibrating}
                      startCalibration={startCalibration}
                      resetTransients={resetTransients}
                      isListening={engineState.sourceType === 'mic' || engineState.isPlaying}
                    />

                    {/* 3. Room Acoustic RT60 Reverb Decay Measurement */}
                    <AcousticRoomRt60
                      metrics={metrics}
                      isListening={engineState.sourceType === 'mic' || engineState.isPlaying}
                      getFrequencyData={getFrequencyData}
                    />

                    {/* 4. Live Voice & Speech Transcription Panel */}
                    <TranscriptionPanel
                      mediaStreamDestinationRef={mediaStreamDestinationRef}
                      engineState={engineState}
                      loadedFile={loadedFile}
                    />
                  </div>

                  {/* Right Column (AI Intelligence, Pitch Tuning & Anomaly Tracking) */}
                  <div className="lg:col-span-6 flex flex-col gap-6">
                    {/* 1. AI Real-Time Sound Classifier */}
                    <AiNoiseDetector
                      engineState={engineState}
                      metrics={metrics}
                      enableMicrophone={enableMicrophone}
                      onDetectResult={setLatestAiResult}
                    />

                    {/* 2. Harmonic Musical Tuner & Fundamental Pitch */}
                    <HarmonicTuner
                      metrics={metrics}
                      getFrequencyData={getFrequencyData}
                    />

                    {/* 3. Sound Timeline Energy Profiler */}
                    <SoundTimelineProfiler
                      metrics={metrics}
                      isListening={engineState.sourceType === 'mic' || engineState.isPlaying}
                      getFrequencyData={getFrequencyData}
                    />

                    {/* 4. Sound Event & Transient Anomaly Log */}
                    <EventAnomalyLog
                      metrics={metrics}
                      currentTime={engineState.currentTime}
                      isPlaying={engineState.isPlaying || engineState.sourceType === 'mic'}
                    />
                  </div>
                </div>
              </div>
            )}

            {/* PAGE 2: MEDIA FILE, URL STREAM & PLAYBACK EQUIPMENT */}
            {activeTab === 'media' && (
              <div className="flex flex-col gap-6 animate-fadeIn">
                <div className="flex items-center justify-between px-2">
                  <div className="flex items-center gap-2 text-sm font-bold text-cyan-300">
                    <Music className="w-4 h-4 text-cyan-400" />
                    <span>MEDIA FILE & DIRECT URL STREAMING EQUIPMENT</span>
                  </div>
                  <span className="text-xs text-slate-400 font-mono">Audio Deck, EQ & Media Analysis</span>
                </div>

                <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">
                  {/* Left Column (Playback Deck, URL Analyzer, Equalizer) */}
                  <div className="lg:col-span-6 flex flex-col gap-6">
                    {/* 1. Direct URL & YouTube Audio Streamer */}
                    <UrlAudioAnalyzer
                      engineState={engineState}
                      loadAudioFromUrl={loadAudioFromUrl}
                      loadSampleTrack={loadSampleTrack}
                      enableMicrophone={enableMicrophone}
                      play={play}
                      pause={pause}
                    />

                    {/* 2. Precision Transport & Track Deck */}
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

                    {/* 3. 10-Band Graphic Equalizer, Spatial Panner & Speed */}
                    <EqualizerPanel
                      engineState={engineState}
                      setEq={setEq}
                      setPlaybackRate={setPlaybackRate}
                      setPan={setPan}
                    />
                  </div>

                  {/* Right Column (Transcription, Profiling, Harmonics & Anomaly Tracker) */}
                  <div className="lg:col-span-6 flex flex-col gap-6">
                    {/* 1. Media Speech Transcription Panel */}
                    <TranscriptionPanel
                      mediaStreamDestinationRef={mediaStreamDestinationRef}
                      engineState={engineState}
                      loadedFile={loadedFile}
                    />

                    {/* 2. Media Harmonic Pitch & Key Detection */}
                    <HarmonicTuner
                      metrics={metrics}
                      getFrequencyData={getFrequencyData}
                    />

                    {/* 3. Media Sound Timeline & Energy Profiler */}
                    <SoundTimelineProfiler
                      metrics={metrics}
                      isListening={engineState.sourceType === 'file' || engineState.sourceType === 'sample' || engineState.isPlaying}
                      getFrequencyData={getFrequencyData}
                    />

                    {/* 4. Playback Peak & Transient Anomaly Log */}
                    <EventAnomalyLog
                      metrics={metrics}
                      currentTime={engineState.currentTime}
                      isPlaying={engineState.isPlaying}
                    />
                  </div>
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
