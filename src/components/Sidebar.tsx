import React from 'react';
import {
  Activity,
  Mic,
  Music,
  Sliders,
  Disc,
  Settings,
  BookOpen,
  FileText,
  RefreshCw,
  Volume2,
  VolumeX,
  Bluetooth,
  Palette,
  AlertCircle,
  Sparkles,
} from 'lucide-react';
import {
  AudioEngineState,
  AudioMetrics,
  FrequencyWeighting,
  NoiseBaselineProfile,
  VisualizerSettings,
  WorkspaceTab,
} from '../types';
import { getPresetById } from '../utils/colorGradients';

interface SidebarProps {
  engineState: AudioEngineState;
  metrics: AudioMetrics;
  settings: VisualizerSettings;
  weighting: FrequencyWeighting;
  setWeighting: (w: FrequencyWeighting) => void;
  activeTab: WorkspaceTab;
  onSelectTab: (tab: WorkspaceTab) => void;
  enableMicrophone: (deviceId?: string) => Promise<void>;
  toggleMicMonitoring: () => void;
  loadSampleTrack?: (trackId: string) => Promise<void>;
  profile: NoiseBaselineProfile;
  isCalibrating: boolean;
  startCalibration: () => void;
  onOpenSettings: (initialSection?: 'color' | 'mic' | 'audio') => void;
  onOpenGuide: () => void;
  onOpenReport: () => void;
}

export const Sidebar: React.FC<SidebarProps> = ({
  engineState,
  metrics,
  settings,
  weighting,
  setWeighting,
  activeTab,
  onSelectTab,
  enableMicrophone,
  toggleMicMonitoring,
  loadSampleTrack,
  profile,
  isCalibrating,
  startCalibration,
  onOpenSettings,
  onOpenGuide,
  onOpenReport,
}) => {
  const currentWeighting = metrics.weighting || weighting;
  const weightingUnit =
    currentWeighting === 'A' ? 'dBA' : currentWeighting === 'C' ? 'dBC' : 'dBFS';
  const activeColorPreset = getPresetById(settings.spectrogramColorMap || settings.colorPresetId);

  const bands = [
    { label: 'Sub-Bass (20–60 Hz)', value: metrics.subBass, barColor: 'bg-fuchsia-500' },
    { label: 'Bass (60–250 Hz)', value: metrics.bass, barColor: 'bg-cyan-400' },
    { label: 'Midrange (250–4k Hz)', value: metrics.mid, barColor: 'bg-emerald-400' },
    { label: 'Treble (4k–20k Hz)', value: metrics.treble, barColor: 'bg-amber-400' },
  ];

  const isListening = engineState.sourceType === 'mic' || engineState.isPlaying;

  return (
    <aside className="w-full lg:w-80 xl:w-84 shrink-0 bg-slate-900 border-b lg:border-b-0 lg:border-r border-slate-800 flex flex-col lg:h-screen lg:sticky lg:top-0 select-none overflow-y-auto">
      {/* 1. Brand Wordmark & Settings Trigger */}
      <div className="px-4 py-3.5 border-b border-slate-800 flex items-center justify-between gap-2">
        <div className="flex items-center gap-2.5 min-w-0">
          <div className="p-2 bg-cyan-500/10 border border-cyan-500/30 rounded-lg text-cyan-400 shrink-0">
            <Activity className="w-5 h-5" />
          </div>
          <div className="min-w-0">
            <h1 className="text-base font-bold tracking-tight text-white truncate">
              SPECTRA LAB
            </h1>
            <p className="text-[11px] text-slate-400 truncate">
              Acoustic Spectrum &amp; Telemetry
            </p>
          </div>
        </div>

        <button
          onClick={() => onOpenSettings('color')}
          id="btn-sidebar-open-settings-top"
          className="px-2.5 py-1.5 rounded-lg bg-slate-950 hover:bg-slate-800 border border-slate-700/80 text-xs font-medium text-slate-200 flex items-center gap-1.5 cursor-pointer transition-colors shrink-0"
          title="Open Settings, Audio & Color Map Drawer"
        >
          <Settings className="w-3.5 h-3.5 text-cyan-400" />
          <span>Settings</span>
        </button>
      </div>

      {/* 2. Workspace View Navigation */}
      <div className="p-3 border-b border-slate-800 flex flex-col gap-1">
        <div className="text-[11px] font-medium text-slate-400 px-2 pb-1">
          Workspace Views
        </div>
        <div className="grid grid-cols-2 lg:grid-cols-1 gap-1">
          <button
            onClick={() => onSelectTab('live')}
            id="sidebar-tab-live"
            className={`px-3 py-2 rounded-lg text-xs font-semibold flex items-center gap-2.5 transition-colors cursor-pointer whitespace-nowrap ${
              activeTab === 'live'
                ? 'bg-cyan-500/15 text-cyan-300 border border-cyan-500/40'
                : 'text-slate-400 hover:text-slate-200 hover:bg-slate-800/60 border border-transparent'
            }`}
          >
            <Mic className="w-4 h-4 shrink-0 text-cyan-400" />
            <span className="truncate">Visualizer &amp; Calibration</span>
          </button>

          <button
            onClick={() => onSelectTab('tools')}
            id="sidebar-tab-tools"
            className={`px-3 py-2 rounded-lg text-xs font-semibold flex items-center gap-2.5 transition-colors cursor-pointer whitespace-nowrap ${
              activeTab === 'tools'
                ? 'bg-cyan-500/15 text-cyan-300 border border-cyan-500/40'
                : 'text-slate-400 hover:text-slate-200 hover:bg-slate-800/60 border border-transparent'
            }`}
          >
            <Sliders className="w-4 h-4 shrink-0 text-amber-400" />
            <span className="truncate">Frequency Workbench &amp; RTA</span>
          </button>

          <button
            onClick={() => onSelectTab('media')}
            id="sidebar-tab-media"
            className={`px-3 py-2 rounded-lg text-xs font-semibold flex items-center gap-2.5 transition-colors cursor-pointer whitespace-nowrap ${
              activeTab === 'media'
                ? 'bg-cyan-500/15 text-cyan-300 border border-cyan-500/40'
                : 'text-slate-400 hover:text-slate-200 hover:bg-slate-800/60 border border-transparent'
            }`}
          >
            <Music className="w-4 h-4 shrink-0 text-indigo-400" />
            <span className="truncate">Media &amp; Stream Analyzer</span>
          </button>

          <button
            onClick={() => onSelectTab('recorder')}
            id="sidebar-tab-recorder"
            className={`px-3 py-2 rounded-lg text-xs font-semibold flex items-center gap-2.5 transition-colors cursor-pointer whitespace-nowrap ${
              activeTab === 'recorder'
                ? 'bg-cyan-500/15 text-cyan-300 border border-cyan-500/40'
                : 'text-slate-400 hover:text-slate-200 hover:bg-slate-800/60 border border-transparent'
            }`}
          >
            <Disc className="w-4 h-4 shrink-0 text-rose-400" />
            <span className="truncate">Studio WAV Recorder</span>
          </button>

          <button
            onClick={() => onSelectTab('ai')}
            id="sidebar-tab-ai"
            className={`px-3 py-2 rounded-lg text-xs font-semibold flex items-center justify-between transition-colors cursor-pointer whitespace-nowrap ${
              activeTab === 'ai'
                ? 'bg-purple-500/20 text-purple-200 border border-purple-500/50 shadow-sm shadow-purple-500/10'
                : 'text-slate-400 hover:text-slate-200 hover:bg-slate-800/60 border border-transparent'
            }`}
          >
            <div className="flex items-center gap-2.5 truncate">
              <Sparkles className="w-4 h-4 shrink-0 text-purple-400" />
              <span className="truncate">AI Acoustic Lab</span>
            </div>
            <span className="text-[10px] font-mono px-1.5 py-0.5 rounded bg-purple-500/20 text-purple-300 font-bold border border-purple-500/30">
              Gemini
            </span>
          </button>
        </div>
      </div>

      {/* 3. Persistent Input & Mic Status Box (Isolated from Main Viewport) */}
      <div className="p-3 border-b border-slate-800 flex flex-col gap-2.5">
        <div className="flex items-center justify-between">
          <span className="text-[11px] font-medium text-slate-400">
            Active Input Status
          </span>
          <button
            onClick={() => onOpenSettings('mic')}
            className="text-[11px] text-cyan-400 hover:text-cyan-300 font-medium cursor-pointer"
          >
            Configure Mic &rarr;
          </button>
        </div>

        <div className="bg-slate-950 border border-slate-800 rounded-xl p-2.5 flex flex-col gap-2">
          <div className="flex items-center justify-between gap-2">
            <div className="flex items-center gap-2 min-w-0">
              <span
                className={`w-2 h-2 rounded-full shrink-0 ${
                  engineState.micActive
                    ? 'bg-emerald-400 animate-pulse'
                    : engineState.isPlaying
                    ? 'bg-cyan-400'
                    : 'bg-slate-600'
                }`}
              />
              <span className="text-xs font-mono font-bold text-slate-200 truncate">
                {engineState.sourceType === 'mic'
                  ? engineState.micActive
                    ? 'MIC LIVE'
                    : 'MIC STANDBY'
                  : `SOURCE: ${engineState.sourceType.toUpperCase()}`}
              </span>
            </div>

            <span className="text-[11px] font-mono tabular-nums text-slate-400 shrink-0">
              {metrics.fps} FPS
            </span>
          </div>

          {engineState.isBluetoothConnected && (
            <div className="flex items-center gap-1.5 text-[11px] text-cyan-300 font-mono truncate">
              <Bluetooth className="w-3 h-3 text-cyan-400 shrink-0" />
              <span className="truncate">
                {engineState.bluetoothDeviceName || 'Bluetooth Audio Input'}
              </span>
            </div>
          )}

          <div className="grid grid-cols-2 gap-1.5 pt-0.5">
            <button
              onClick={() => enableMicrophone(engineState.selectedDeviceId || undefined)}
              className={`px-2.5 py-1.5 rounded-lg text-[11px] font-semibold border flex items-center justify-center gap-1.5 cursor-pointer transition-colors whitespace-nowrap ${
                engineState.sourceType === 'mic' && engineState.micActive
                  ? 'bg-emerald-500/15 border-emerald-500/40 text-emerald-300'
                  : 'bg-slate-900 hover:bg-slate-800 border-slate-800 text-slate-300'
              }`}
            >
              <Mic className="w-3.5 h-3.5 shrink-0" />
              <span>{engineState.micActive ? 'Mic Active' : 'Enable Mic'}</span>
            </button>

            <button
              onClick={toggleMicMonitoring}
              className={`px-2.5 py-1.5 rounded-lg text-[11px] font-semibold border flex items-center justify-center gap-1.5 cursor-pointer transition-colors whitespace-nowrap ${
                engineState.micMonitoring
                  ? 'bg-amber-500/15 border-amber-500/40 text-amber-300'
                  : 'bg-slate-900 hover:bg-slate-800 border-slate-800 text-slate-400'
              }`}
              title="Toggle live speaker pass-through monitoring"
            >
              {engineState.micMonitoring ? (
                <Volume2 className="w-3.5 h-3.5 shrink-0 text-amber-400" />
              ) : (
                <VolumeX className="w-3.5 h-3.5 shrink-0" />
              )}
              <span>{engineState.micMonitoring ? 'Monitor ON' : 'Monitor OFF'}</span>
            </button>
          </div>

          {/* Microphone Permission / Error Alert */}
          {engineState.micError && (
            <div className="mt-1 p-2.5 rounded-lg bg-rose-500/10 border border-rose-500/30 text-rose-300 text-[11px] flex flex-col gap-1.5">
              <div className="flex items-start gap-1.5">
                <AlertCircle className="w-3.5 h-3.5 text-rose-400 shrink-0 mt-0.5" />
                <span className="leading-snug">{engineState.micError}</span>
              </div>
              <div className="flex items-center gap-1.5 pt-0.5">
                <button
                  onClick={() => enableMicrophone(engineState.selectedDeviceId || undefined)}
                  className="px-2 py-0.5 rounded bg-rose-500/20 hover:bg-rose-500/30 text-rose-200 text-[10px] font-bold border border-rose-500/40 cursor-pointer transition-colors"
                >
                  Retry Mic
                </button>
                {loadSampleTrack && (
                  <button
                    onClick={() => loadSampleTrack('synthwave')}
                    className="px-2 py-0.5 rounded bg-slate-900 hover:bg-slate-800 text-slate-300 text-[10px] font-semibold border border-slate-700 cursor-pointer transition-colors"
                  >
                    Demo Audio
                  </button>
                )}
              </div>
            </div>
          )}
        </div>
      </div>

      {/* 4. High-Frequency Telemetry Readouts (Fixed-Geometry Tabular Box) */}
      <div className="p-3 border-b border-slate-800 flex flex-col gap-2.5">
        <div className="flex items-center justify-between">
          <span className="text-[11px] font-medium text-slate-400">
            Live Frequency &amp; SPL Telemetry
          </span>
          {/* Weighting pill buttons */}
          <div className="flex items-center gap-0.5 bg-slate-950 p-0.5 rounded-lg border border-slate-800">
            {(['Z', 'A', 'C'] as FrequencyWeighting[]).map((w) => (
              <button
                key={w}
                onClick={() => setWeighting(w)}
                className={`px-1.5 py-0.5 rounded text-[10px] font-mono font-bold cursor-pointer transition-colors ${
                  currentWeighting === w
                    ? 'bg-cyan-500 text-slate-950'
                    : 'text-slate-400 hover:text-white'
                }`}
                title={`Switch to ${w}-Weighting`}
              >
                {w}
              </button>
            ))}
          </div>
        </div>

        {/* Fixed-Height Prominent Frequency Card (Never wraps or shifts height) */}
        <div className="bg-slate-950 border border-slate-800 rounded-xl p-3 flex flex-col gap-2">
          <div className="flex items-center justify-between text-[11px] text-slate-400">
            <span>Prominent Peak Frequency</span>
            <span className="font-mono tabular-nums text-amber-300 font-semibold">
              {metrics.peakFrequencyHz > 16 ? metrics.peakNoteName : '---'}
            </span>
          </div>

          <div className="flex items-baseline justify-between gap-2">
            <span className="text-2xl font-mono tabular-nums font-bold text-cyan-300 tracking-tight whitespace-nowrap">
              {metrics.peakFrequencyHz > 16 ? metrics.peakFrequencyFormatted : '0.0 Hz'}
            </span>
            <span className="text-xs font-mono tabular-nums text-slate-400 whitespace-nowrap">
              {metrics.peakFrequencyHz > 16 ? `${metrics.prominenceDb} dBFS` : '-100 dBFS'}
            </span>
          </div>

          {/* 3-Column Fixed Tabular Readouts: RMS, Peak, Crest */}
          <div className="grid grid-cols-3 gap-1.5 pt-2 border-t border-slate-800/80 text-center">
            <div className="bg-slate-900/90 rounded-lg p-1.5 border border-slate-800/60">
              <div className="text-[10px] text-slate-400">RMS ({weightingUnit})</div>
              <div className="text-xs font-mono tabular-nums font-bold text-emerald-400 mt-0.5">
                {metrics.rmsDb}
              </div>
            </div>
            <div className="bg-slate-900/90 rounded-lg p-1.5 border border-slate-800/60">
              <div className="text-[10px] text-slate-400">Peak dBFS</div>
              <div className="text-xs font-mono tabular-nums font-bold text-amber-300 mt-0.5">
                {metrics.peakDb}
              </div>
            </div>
            <div className="bg-slate-900/90 rounded-lg p-1.5 border border-slate-800/60">
              <div className="text-[10px] text-slate-400">Crest</div>
              <div className="text-xs font-mono tabular-nums font-bold text-cyan-300 mt-0.5">
                +{metrics.crestFactorDb} dB
              </div>
            </div>
          </div>
        </div>

        {/* 4-Band Live Energy Bars */}
        <div className="bg-slate-950 border border-slate-800 rounded-xl p-2.5 flex flex-col gap-2">
          {bands.map((b) => (
            <div key={b.label} className="flex flex-col gap-1">
              <div className="flex items-center justify-between text-[11px]">
                <span className="text-slate-400 truncate">{b.label}</span>
                <span className="font-mono tabular-nums font-bold text-slate-200 w-9 text-right">
                  {b.value}%
                </span>
              </div>
              <div className="w-full h-1.5 bg-slate-900 rounded-full overflow-hidden">
                <div
                  className={`h-full ${b.barColor} transition-all duration-75`}
                  style={{ width: `${Math.min(100, Math.max(0, b.value))}%` }}
                />
              </div>
            </div>
          ))}
        </div>

        {/* Fixed-Height THD & SNR Status Row */}
        <div className="bg-slate-950 border border-slate-800 rounded-xl px-2.5 py-2 flex items-center justify-between text-[11px] font-mono tabular-nums">
          <span className="text-slate-400">THD / Floor:</span>
          <span className="text-slate-200 font-semibold">
            {metrics.distortion && metrics.distortion.isToneDetected
              ? `${metrics.distortion.thdPercent}% THD`
              : `${profile.noiseFloorDb} dB Floor`}
          </span>
          <span className="text-emerald-400 font-semibold">+{profile.snrDb} dB SNR</span>
        </div>
      </div>

      {/* 5. Global Calibration & Slide-Out Settings Controls */}
      <div className="p-3 mt-auto flex flex-col gap-2">
        {/* Quick Room Floor Calibration Trigger */}
        <button
          onClick={startCalibration}
          disabled={isCalibrating || !isListening}
          id="btn-sidebar-calibrate"
          className={`w-full px-3 py-2 rounded-xl text-xs font-semibold border flex items-center justify-between gap-2 transition-colors cursor-pointer ${
            isCalibrating
              ? 'bg-amber-500/20 border-amber-500 text-amber-300'
              : 'bg-slate-950 hover:bg-slate-800 border-slate-800 text-slate-200'
          } ${!isListening ? 'opacity-50 cursor-not-allowed' : ''}`}
        >
          <div className="flex items-center gap-2">
            <RefreshCw className={`w-3.5 h-3.5 text-cyan-400 ${isCalibrating ? 'animate-spin' : ''}`} />
            <span>
              {isCalibrating
                ? `Calibrating (${profile.calibrationProgress}%)`
                : 'Calibrate Room Floor'}
            </span>
          </div>
          <span className="text-[10px] font-mono text-slate-400">
            {profile.isCalibrated ? 'Calibrated' : '3s Sample'}
          </span>
        </button>

        {/* Slide-Out Settings & Heatmap Color Scheme Button */}
        <button
          onClick={() => onOpenSettings('color')}
          id="btn-sidebar-open-color-settings"
          className="w-full px-3 py-2 rounded-xl bg-slate-950 hover:bg-slate-800 border border-cyan-500/30 text-xs font-semibold text-cyan-300 flex items-center justify-between gap-2 cursor-pointer transition-colors"
        >
          <div className="flex items-center gap-2">
            <Palette className="w-3.5 h-3.5 text-cyan-400" />
            <span>Color Map &amp; Audio Settings</span>
          </div>
          <span className="text-[10px] font-mono text-slate-300 bg-slate-900 px-1.5 py-0.5 rounded border border-slate-800">
            {activeColorPreset.name.split(' ')[0]}
          </span>
        </button>

        {/* Guide & Export Report Row */}
        <div className="grid grid-cols-2 gap-2">
          <button
            onClick={onOpenGuide}
            id="btn-sidebar-guide"
            className="px-2.5 py-1.5 rounded-lg bg-slate-950 hover:bg-slate-800 border border-slate-800 text-xs font-medium text-slate-300 flex items-center justify-center gap-1.5 cursor-pointer transition-colors"
          >
            <BookOpen className="w-3.5 h-3.5 text-cyan-400" />
            <span>Guide</span>
          </button>
          <button
            onClick={onOpenReport}
            id="btn-sidebar-report"
            className="px-2.5 py-1.5 rounded-lg bg-slate-950 hover:bg-slate-800 border border-slate-800 text-xs font-medium text-slate-300 flex items-center justify-center gap-1.5 cursor-pointer transition-colors"
          >
            <FileText className="w-3.5 h-3.5 text-emerald-400" />
            <span>Audit Report</span>
          </button>
        </div>
      </div>
    </aside>
  );
};
