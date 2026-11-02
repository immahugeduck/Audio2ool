import React, { useState, useEffect, useCallback } from 'react';
import { VisualizerSettings, AiNoiseDetectionResult } from './types';
import { useAudioEngine } from './hooks/useAudioEngine';
import { useNoiseBaseline } from './hooks/useNoiseBaseline';
import { Sidebar } from './components/Sidebar';
import { SettingsDrawer } from './components/SettingsDrawer';
import { CanvasVisualizer } from './components/CanvasVisualizer';
import { AudioControls } from './components/AudioControls';
import { VisualizerControls } from './components/VisualizerControls';
import { EqualizerPanel } from './components/EqualizerPanel';
import { NoiseBaselineMonitor } from './components/NoiseBaselineMonitor';
import { AcousticGuide } from './components/AcousticGuide';
import { ReportExporter } from './components/ReportExporter';
import { AudioMeters } from './components/AudioMeters';
import { DropZone } from './components/DropZone';
import { SoundTimelineProfiler } from './components/SoundTimelineProfiler';
import { AcousticRoomRt60 } from './components/AcousticRoomRt60';
import { HarmonicTuner } from './components/HarmonicTuner';
import { EventAnomalyLog } from './components/EventAnomalyLog';
import { UrlAudioAnalyzer } from './components/UrlAudioAnalyzer';
import { FrequencyToolsPanel } from './components/FrequencyToolsPanel';
import { StudioRecorder } from './components/StudioRecorder';
import { Music, Sliders, Disc, Settings, Mic } from 'lucide-react';

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
    colorPresetId: 'thermal',
    customGradient: {
      start: '#06b6d4',
      middle: '#eab308',
      end: '#ec4899',
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
    zoomPreset: 'full',
    minFreqHz: 20,
    maxFreqHz: 20000,
    spectrogramColorMap: 'thermal',
  });

  const [isGuideOpen, setIsGuideOpen] = useState(false);
  const [isReportOpen, setIsReportOpen] = useState(false);
  const [isSettingsOpen, setIsSettingsOpen] = useState(false);
  const [settingsSection, setSettingsSection] = useState<'color' | 'mic' | 'audio'>('color');
  const [latestAiResult] = useState<AiNoiseDetectionResult | null>(null);

  // Workspace View State: 'live' | 'media' | 'tools' | 'recorder'
  const [activeTab, setActiveTab] = useState<'live' | 'media' | 'tools' | 'recorder'>('live');

  const updateSettings = useCallback((partial: Partial<VisualizerSettings>) => {
    setSettings((prev) => ({ ...prev, ...partial }));
  }, []);

  const openSettingsDrawer = useCallback((section: 'color' | 'mic' | 'audio' = 'color') => {
    setSettingsSection(section);
    setIsSettingsOpen(true);
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
    getFloatFrequencyData,
    getTimeDomainData,
    weighting,
    setWeighting,
    // Frequency Generator & Isolator tools
    signalGenState,
    startSignalGen,
    stopSignalGen,
    updateSignalGen,
    isolatorState,
    updateIsolator,
    // Audio stream getters for Studio Recorder
    getAudioContext,
    getMasterStream,
    getMicStream,
  } = useAudioEngine(settings);

  // Long-term noise baseline profiling & calibration
  const {
    profile,
    isCalibrating,
    startCalibration,
    resetTransients,
    setTransientSensitivity,
  } = useNoiseBaseline(
    getFrequencyData,
    metrics,
    engineState.sourceType === 'mic' || engineState.isPlaying
  );

  // Initial audio setup: start with procedural sample track so the visualizer
  // has active signal immediately without triggering unprompted browser mic permission denials.
  useEffect(() => {
    if (activeTab === 'media' && engineState.sourceType !== 'file' && engineState.sourceType !== 'url') {
      loadSampleTrack('synthwave');
    } else if (activeTab === 'live' && !engineState.micActive && engineState.sourceType !== 'mic' && !engineState.isPlaying) {
      loadSampleTrack('synthwave');
    }
  }, [activeTab]);

  return (
    <DropZone onFileDrop={loadAudioFile}>
      <div className="min-h-screen bg-slate-950 text-slate-100 font-sans antialiased flex flex-col lg:flex-row selection:bg-cyan-500 selection:text-slate-950">
        {/* Persistent Left Sidebar: Status Indicators, High-Frequency Telemetry & Global Controls */}
        <Sidebar
          engineState={engineState}
          metrics={metrics}
          settings={settings}
          weighting={weighting}
          setWeighting={setWeighting}
          activeTab={activeTab}
          onSelectTab={setActiveTab}
          enableMicrophone={enableMicrophone}
          toggleMicMonitoring={toggleMicMonitoring}
          loadSampleTrack={loadSampleTrack}
          profile={profile}
          isCalibrating={isCalibrating}
          startCalibration={startCalibration}
          onOpenSettings={openSettingsDrawer}
          onOpenGuide={() => setIsGuideOpen(true)}
          onOpenReport={() => setIsReportOpen(true)}
        />

        {/* Primary Main Content Area (Isolated from High-Frequency Sidebar Telemetry) */}
        <div className="flex-1 min-w-0 flex flex-col">
          <div className="max-w-[1600px] w-full mx-auto px-4 sm:px-6 py-5 flex flex-col gap-5 flex-1">
            {/* Microphone Permission Notice Banner */}
            {engineState.micError && (
              <div className="bg-rose-500/10 border border-rose-500/30 rounded-xl px-4 py-2.5 text-xs text-rose-300 flex items-center justify-between gap-3 flex-wrap">
                <div className="flex items-center gap-2">
                  <span className="w-2 h-2 rounded-full bg-rose-400 shrink-0" />
                  <span>{engineState.micError}</span>
                </div>
                <div className="flex items-center gap-2 shrink-0">
                  <button
                    onClick={() => enableMicrophone(engineState.selectedDeviceId || undefined)}
                    className="px-3 py-1 rounded-lg bg-rose-500/20 hover:bg-rose-500/30 text-rose-200 text-xs font-bold border border-rose-500/40 cursor-pointer transition-colors"
                  >
                    Enable Mic
                  </button>
                  <button
                    onClick={() => loadSampleTrack('synthwave')}
                    className="px-3 py-1 rounded-lg bg-slate-900 hover:bg-slate-800 text-slate-300 text-xs font-semibold border border-slate-700 cursor-pointer transition-colors"
                  >
                    Demo Audio
                  </button>
                </div>
              </div>
            )}

            {/* 1. Primary Spectrum, Oscilloscope, 3D Waterfall & 2D Heatmap Graph */}
            <CanvasVisualizer
              settings={settings}
              getFrequencyData={getFrequencyData}
              getTimeDomainData={getTimeDomainData}
              metrics={metrics}
              isPlaying={engineState.isPlaying}
              sampleRate={getAudioContext()?.sampleRate || 44100}
            />

            {/* 2. Visualizer Views, Frequency Span Zoom & Scope Calibration Bar */}
            <VisualizerControls
              settings={settings}
              updateSettings={updateSettings}
              onOpenSettings={openSettingsDrawer}
            />

            {/* ============================================================== */}
            {/* WORKSPACE CONTENT AREA */}
            {/* ============================================================== */}
            <main className="flex flex-col gap-5">
              {/* VIEW 1: VISUALIZER, MIC INPUT FREQUENCIES & ROOM CALIBRATION */}
              {activeTab === 'live' && (
                <div className="flex flex-col gap-5">
                  {/* Multi-Band Frequency Energy & THD Telemetry */}
                  <AudioMeters
                    metrics={metrics}
                    weighting={weighting}
                    setWeighting={setWeighting}
                  />

                  {/* Mic Input Frequencies, Pitch Calibration & Room Floor Calibration */}
                  <div className="grid grid-cols-1 xl:grid-cols-12 gap-5">
                    {/* Left Column: Mic Input Frequencies, Harmonic Pitch Tuner & Energy Timeline */}
                    <div className="xl:col-span-6 flex flex-col gap-5">
                      <HarmonicTuner
                        metrics={metrics}
                        getFrequencyData={getFrequencyData}
                        sampleRate={getAudioContext()?.sampleRate || 44100}
                      />

                      <SoundTimelineProfiler
                        metrics={metrics}
                        isListening={engineState.sourceType === 'mic' || engineState.isPlaying}
                        getFrequencyData={getFrequencyData}
                      />
                    </div>

                    {/* Right Column: Room Noise Floor Calibration, RT60 Decay & Impulse Log */}
                    <div className="xl:col-span-6 flex flex-col gap-5">
                      <NoiseBaselineMonitor
                        profile={profile}
                        metrics={metrics}
                        isCalibrating={isCalibrating}
                        startCalibration={startCalibration}
                        resetTransients={resetTransients}
                        setTransientSensitivity={setTransientSensitivity}
                        isListening={engineState.sourceType === 'mic' || engineState.isPlaying}
                      />

                      <AcousticRoomRt60
                        metrics={metrics}
                        isListening={engineState.sourceType === 'mic' || engineState.isPlaying}
                        getFrequencyData={getFrequencyData}
                        sampleRate={getAudioContext()?.sampleRate || 44100}
                      />
                    </div>
                  </div>
                </div>
              )}

              {/* VIEW 2: PRECISION FREQUENCY WORKBENCH & ISO 1/3-OCTAVE RTA */}
              {activeTab === 'tools' && (
                <div className="flex flex-col gap-5">
                  <div className="flex items-center justify-between px-1">
                    <div className="flex items-center gap-2 text-sm font-bold text-amber-300">
                      <Sliders className="w-4 h-4 text-amber-400" />
                      <span>Frequency Workbench, ISO 1/3-Octave RTA &amp; THD Analyzer</span>
                    </div>
                    <button
                      onClick={() => openSettingsDrawer('audio')}
                      className="text-xs text-cyan-400 hover:text-cyan-300 font-medium flex items-center gap-1 cursor-pointer"
                    >
                      <Settings className="w-3.5 h-3.5" />
                      <span>Open 10-Band EQ &amp; Audio Settings</span>
                    </button>
                  </div>

                  <FrequencyToolsPanel
                    signalGenState={signalGenState}
                    startSignalGen={startSignalGen}
                    stopSignalGen={stopSignalGen}
                    updateSignalGen={updateSignalGen}
                    isolatorState={isolatorState}
                    updateIsolator={updateIsolator}
                    getFrequencyData={getFrequencyData}
                    getFloatFrequencyData={getFloatFrequencyData}
                    metrics={metrics}
                    sampleRate={getAudioContext()?.sampleRate || 44100}
                  />

                  <div className="grid grid-cols-1 xl:grid-cols-12 gap-5">
                    <div className="xl:col-span-6">
                      <HarmonicTuner
                        metrics={metrics}
                        getFrequencyData={getFrequencyData}
                        sampleRate={getAudioContext()?.sampleRate || 44100}
                      />
                    </div>
                    <div className="xl:col-span-6">
                      <EqualizerPanel
                        engineState={engineState}
                        setEq={setEq}
                        setPlaybackRate={setPlaybackRate}
                        setPan={setPan}
                      />
                    </div>
                  </div>
                </div>
              )}

              {/* VIEW 3: MEDIA FILE & STREAM VISUALIZER */}
              {activeTab === 'media' && (
                <div className="flex flex-col gap-5">
                  <div className="flex items-center justify-between px-1">
                    <div className="flex items-center gap-2 text-sm font-bold text-cyan-300">
                      <Music className="w-4 h-4 text-cyan-400" />
                      <span>Media File &amp; Stream Spectrum Analysis</span>
                    </div>
                    <button
                      onClick={() => openSettingsDrawer('audio')}
                      className="text-xs text-cyan-400 hover:text-cyan-300 font-medium flex items-center gap-1 cursor-pointer"
                    >
                      <Settings className="w-3.5 h-3.5" />
                      <span>Audio &amp; EQ Settings</span>
                    </button>
                  </div>

                  <div className="grid grid-cols-1 xl:grid-cols-12 gap-5">
                    <div className="xl:col-span-6 flex flex-col gap-5">
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

                      <UrlAudioAnalyzer
                        engineState={engineState}
                        loadAudioFromUrl={loadAudioFromUrl}
                        loadSampleTrack={loadSampleTrack}
                        enableMicrophone={enableMicrophone}
                        play={play}
                        pause={pause}
                      />
                    </div>

                    <div className="xl:col-span-6 flex flex-col gap-5">
                      <HarmonicTuner
                        metrics={metrics}
                        getFrequencyData={getFrequencyData}
                        sampleRate={getAudioContext()?.sampleRate || 44100}
                      />

                      <EventAnomalyLog
                        metrics={metrics}
                        currentTime={engineState.currentTime}
                        isPlaying={engineState.isPlaying}
                      />
                    </div>
                  </div>
                </div>
              )}

              {/* VIEW 4: STUDIO WAV RECORDER */}
              {activeTab === 'recorder' && (
                <div className="flex flex-col gap-5">
                  <div className="flex items-center justify-between px-1">
                    <div className="flex items-center gap-2 text-sm font-bold text-rose-300">
                      <Disc className="w-4 h-4 text-rose-400" />
                      <span>Studio 32-Bit Float &amp; 16-Bit PCM WAV Recorder</span>
                    </div>
                    <button
                      onClick={() => openSettingsDrawer('mic')}
                      className="text-xs text-cyan-400 hover:text-cyan-300 font-medium flex items-center gap-1 cursor-pointer"
                    >
                      <Mic className="w-3.5 h-3.5" />
                      <span>Mic Input Settings</span>
                    </button>
                  </div>

                  <StudioRecorder
                    getMasterStream={getMasterStream}
                    getMicStream={getMicStream}
                    getAudioContext={getAudioContext}
                    enableMicrophone={enableMicrophone}
                    loadAudioFile={loadAudioFile}
                  />
                </div>
              )}
            </main>
          </div>
        </div>

        {/* Slide-Out Settings Drawer (Heatmap Color Schemes, Mic Hardware & Audio/EQ) */}
        <SettingsDrawer
          isOpen={isSettingsOpen}
          initialSection={settingsSection}
          onClose={() => setIsSettingsOpen(false)}
          settings={settings}
          updateSettings={updateSettings}
          engineState={engineState}
          metrics={metrics}
          enableMicrophone={enableMicrophone}
          toggleMicMonitoring={toggleMicMonitoring}
          weighting={weighting}
          setWeighting={setWeighting}
          profile={profile}
          isCalibrating={isCalibrating}
          startCalibration={startCalibration}
          resetTransients={resetTransients}
          setTransientSensitivity={setTransientSensitivity}
          setVolume={setVolume}
          toggleMute={toggleMute}
          setEq={setEq}
          setPlaybackRate={setPlaybackRate}
          setPan={setPan}
        />

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
      </div>
    </DropZone>
  );
}
