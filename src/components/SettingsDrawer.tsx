import React, { useState, useEffect } from 'react';
import {
  X,
  Palette,
  Mic,
  Sliders,
  Check,
  RefreshCw,
  Volume2,
  VolumeX,
  Zap,
} from 'lucide-react';
import {
  VisualizerSettings,
  AudioEngineState,
  AudioMetrics,
  FrequencyWeighting,
  NoiseBaselineProfile,
  SpectrogramColorMap,
} from '../types';
import { COLOR_PRESETS } from '../utils/colorGradients';
import { MicSettingsSelector } from './MicSettingsSelector';
import { EqualizerPanel } from './EqualizerPanel';

interface SettingsDrawerProps {
  isOpen: boolean;
  initialSection?: 'color' | 'mic' | 'audio';
  onClose: () => void;
  settings: VisualizerSettings;
  updateSettings: (partial: Partial<VisualizerSettings>) => void;
  engineState: AudioEngineState;
  metrics: AudioMetrics;
  enableMicrophone: (deviceId?: string) => Promise<void>;
  toggleMicMonitoring: () => void;
  weighting: FrequencyWeighting;
  setWeighting: (w: FrequencyWeighting) => void;
  profile: NoiseBaselineProfile;
  isCalibrating: boolean;
  startCalibration: () => void;
  resetTransients?: () => void;
  setTransientSensitivity?: (mode: 'strict' | 'balanced' | 'sensitive') => void;
  setVolume: (val: number) => void;
  toggleMute: () => void;
  setEq: (index: number, gain: number) => void;
  setPlaybackRate: (rate: number) => void;
  setPan: (pan: number) => void;
}

export const SettingsDrawer: React.FC<SettingsDrawerProps> = ({
  isOpen,
  initialSection = 'color',
  onClose,
  settings,
  updateSettings,
  engineState,
  metrics,
  enableMicrophone,
  toggleMicMonitoring,
  weighting,
  setWeighting,
  profile,
  isCalibrating,
  startCalibration,
  resetTransients,
  setTransientSensitivity,
  setVolume,
  toggleMute,
  setEq,
  setPlaybackRate,
  setPan,
}) => {
  const [activeSection, setActiveSection] = useState<'color' | 'mic' | 'audio'>(initialSection);

  useEffect(() => {
    if (isOpen && initialSection) {
      setActiveSection(initialSection);
    }
  }, [isOpen, initialSection]);

  if (!isOpen) return null;

  const fftSizes = [128, 256, 512, 1024, 2048, 4096, 8192];
  const activeColorId = (settings.spectrogramColorMap || settings.colorPresetId) as SpectrogramColorMap;

  const handleSelectColorMap = (id: SpectrogramColorMap) => {
    updateSettings({
      spectrogramColorMap: id,
      colorPresetId: id,
      useCustomGradient: false,
    });
  };

  return (
    <div className="fixed inset-0 z-50 flex justify-end">
      {/* Backdrop */}
      <div
        className="fixed inset-0 bg-black/60 backdrop-blur-xs transition-opacity"
        onClick={onClose}
      />

      {/* Slide-out Panel */}
      <div className="relative z-10 w-full max-w-xl bg-slate-900 border-l border-slate-800 h-full flex flex-col shadow-2xl overflow-hidden">
        {/* Drawer Header */}
        <div className="px-5 py-4 border-b border-slate-800 flex items-center justify-between bg-slate-950/80">
          <div>
            <h2 className="text-base font-bold text-white">
              Instrument Settings &amp; Calibration
            </h2>
            <p className="text-xs text-slate-400">
              Scientific heatmap schemes, microphone hardware &amp; audio adjustments
            </p>
          </div>
          <button
            onClick={onClose}
            id="btn-close-settings-drawer"
            className="p-2 rounded-lg bg-slate-900 hover:bg-slate-800 border border-slate-800 text-slate-400 hover:text-white cursor-pointer transition-colors"
            title="Close Settings"
          >
            <X className="w-4 h-4" />
          </button>
        </div>

        {/* Settings Tab Navigation */}
        <div className="px-5 pt-3 pb-2 border-b border-slate-800 bg-slate-950/40 flex items-center gap-2">
          <button
            onClick={() => setActiveSection('color')}
            id="tab-settings-color"
            className={`flex-1 py-2 px-3 rounded-lg text-xs font-semibold flex items-center justify-center gap-1.5 border transition-colors cursor-pointer whitespace-nowrap ${
              activeSection === 'color'
                ? 'bg-cyan-500/15 border-cyan-500/40 text-cyan-300'
                : 'bg-slate-900 border-slate-800 text-slate-400 hover:text-slate-200'
            }`}
          >
            <Palette className="w-3.5 h-3.5" />
            <span>Heatmap &amp; Display</span>
          </button>

          <button
            onClick={() => setActiveSection('mic')}
            id="tab-settings-mic"
            className={`flex-1 py-2 px-3 rounded-lg text-xs font-semibold flex items-center justify-center gap-1.5 border transition-colors cursor-pointer whitespace-nowrap ${
              activeSection === 'mic'
                ? 'bg-cyan-500/15 border-cyan-500/40 text-cyan-300'
                : 'bg-slate-900 border-slate-800 text-slate-400 hover:text-slate-200'
            }`}
          >
            <Mic className="w-3.5 h-3.5" />
            <span>Mic &amp; Calibration</span>
          </button>

          <button
            onClick={() => setActiveSection('audio')}
            id="tab-settings-audio"
            className={`flex-1 py-2 px-3 rounded-lg text-xs font-semibold flex items-center justify-center gap-1.5 border transition-colors cursor-pointer whitespace-nowrap ${
              activeSection === 'audio'
                ? 'bg-cyan-500/15 border-cyan-500/40 text-cyan-300'
                : 'bg-slate-900 border-slate-800 text-slate-400 hover:text-slate-200'
            }`}
          >
            <Sliders className="w-3.5 h-3.5" />
            <span>Audio &amp; 10-Band EQ</span>
          </button>
        </div>

        {/* Drawer Scrollable Content */}
        <div className="flex-1 overflow-y-auto p-5 flex flex-col gap-5">
          {/* SECTION 1: HEATMAP COLOR SCHEMES & DISPLAY PARAMETERS */}
          {activeSection === 'color' && (
            <div className="flex flex-col gap-5">
              {/* Scientific Heatmap Colormaps */}
              <div className="bg-slate-950 border border-slate-800 rounded-xl p-4 flex flex-col gap-3">
                <div>
                  <h3 className="text-sm font-bold text-white">
                    Scientific Heatmap Color Schemes
                  </h3>
                  <p className="text-xs text-slate-400">
                    Unified perceptual color transfer functions applied across all spectrum, waterfall, and spectrogram views
                  </p>
                </div>

                <div className="flex flex-col gap-2">
                  {COLOR_PRESETS.map((preset) => {
                    const isSelected = activeColorId === preset.id;
                    return (
                      <button
                        key={preset.id}
                        onClick={() => handleSelectColorMap(preset.id)}
                        id={`btn-drawer-colormap-${preset.id}`}
                        className={`p-3 rounded-xl border text-left transition-colors cursor-pointer flex flex-col gap-2 ${
                          isSelected
                            ? 'bg-slate-900 border-cyan-400 text-white'
                            : 'bg-slate-900/50 border-slate-800 text-slate-300 hover:border-slate-700'
                        }`}
                      >
                        <div className="flex items-center justify-between gap-2">
                          <div>
                            <div className="text-xs font-bold text-white flex items-center gap-2">
                              <span>{preset.name}</span>
                              {isSelected && (
                                <span className="text-[10px] font-mono text-cyan-300">
                                  Active
                                </span>
                              )}
                            </div>
                            <div className="text-[11px] text-slate-400">
                              {preset.description}
                            </div>
                          </div>
                          {isSelected && <Check className="w-4 h-4 text-cyan-400 shrink-0" />}
                        </div>

                        <div
                          className={`w-full h-3 rounded-md bg-gradient-to-r ${preset.previewGradient} border border-white/10`}
                        />
                      </button>
                    );
                  })}
                </div>
              </div>

              {/* FFT & Scope Display Parameters */}
              <div className="bg-slate-950 border border-slate-800 rounded-xl p-4 flex flex-col gap-4">
                <div>
                  <h3 className="text-sm font-bold text-white">
                    Spectrum &amp; Scope Engine Parameters
                  </h3>
                  <p className="text-xs text-slate-400">
                    Adjust FFT bin resolution, temporal smoothing, and dBFS dynamic range
                  </p>
                </div>

                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                  {/* FFT Size */}
                  <div className="flex flex-col gap-1.5 bg-slate-900 p-3 rounded-lg border border-slate-800">
                    <div className="flex justify-between text-xs">
                      <span className="text-slate-300 font-medium">FFT Resolution</span>
                      <span className="font-mono tabular-nums text-cyan-400 font-bold">
                        {settings.fftSize / 2} Bands
                      </span>
                    </div>
                    <select
                      value={settings.fftSize}
                      onChange={(e) => updateSettings({ fftSize: parseInt(e.target.value) })}
                      className="bg-slate-950 border border-slate-700 text-xs text-slate-200 rounded-lg px-2.5 py-1.5 focus:outline-none focus:border-cyan-500 cursor-pointer"
                    >
                      {fftSizes.map((size) => (
                        <option key={size} value={size}>
                          {size} Bins ({size / 2} Bands)
                        </option>
                      ))}
                    </select>
                  </div>

                  {/* Smoothing */}
                  <div className="flex flex-col gap-1.5 bg-slate-900 p-3 rounded-lg border border-slate-800">
                    <div className="flex justify-between text-xs">
                      <span className="text-slate-300 font-medium">Smoothing Decay</span>
                      <span className="font-mono tabular-nums text-cyan-400 font-bold">
                        {settings.smoothing.toFixed(2)}
                      </span>
                    </div>
                    <input
                      type="range"
                      min={0.0}
                      max={0.95}
                      step={0.01}
                      value={settings.smoothing}
                      onChange={(e) => updateSettings({ smoothing: parseFloat(e.target.value) })}
                      className="w-full h-1.5 bg-slate-800 rounded-lg appearance-none cursor-pointer accent-cyan-400 mt-1"
                    />
                  </div>

                  {/* Sensitivity */}
                  <div className="flex flex-col gap-1.5 bg-slate-900 p-3 rounded-lg border border-slate-800">
                    <div className="flex justify-between text-xs">
                      <span className="text-slate-300 font-medium">Visual Gain</span>
                      <span className="font-mono tabular-nums text-cyan-400 font-bold">
                        {settings.sensitivity.toFixed(1)}x
                      </span>
                    </div>
                    <input
                      type="range"
                      min={0.5}
                      max={2.5}
                      step={0.1}
                      value={settings.sensitivity}
                      onChange={(e) => updateSettings({ sensitivity: parseFloat(e.target.value) })}
                      className="w-full h-1.5 bg-slate-800 rounded-lg appearance-none cursor-pointer accent-cyan-400 mt-1"
                    />
                  </div>

                  {/* Floor & Ceiling dB */}
                  <div className="flex flex-col gap-1.5 bg-slate-900 p-3 rounded-lg border border-slate-800">
                    <div className="flex justify-between text-xs">
                      <span className="text-slate-300 font-medium">Floor / Ceiling</span>
                      <span className="font-mono tabular-nums text-amber-400 font-bold">
                        {settings.minDecibels} / {settings.maxDecibels} dB
                      </span>
                    </div>
                    <div className="flex items-center gap-2 mt-1">
                      <input
                        type="range"
                        min={-110}
                        max={Math.min(-40, settings.maxDecibels - 15)}
                        step={2}
                        value={settings.minDecibels}
                        onChange={(e) => updateSettings({ minDecibels: parseInt(e.target.value) })}
                        className="w-full h-1.5 bg-slate-800 rounded-lg appearance-none cursor-pointer accent-amber-400"
                        title="Noise Floor (Min dBFS)"
                      />
                      <input
                        type="range"
                        min={Math.max(-60, settings.minDecibels + 15)}
                        max={0}
                        step={2}
                        value={settings.maxDecibels}
                        onChange={(e) => updateSettings({ maxDecibels: parseInt(e.target.value) })}
                        className="w-full h-1.5 bg-slate-800 rounded-lg appearance-none cursor-pointer accent-emerald-400"
                        title="Ceiling (Max dBFS)"
                      />
                    </div>
                  </div>
                </div>

                {/* Grid & Reticle Checkboxes */}
                <div className="grid grid-cols-2 gap-2 pt-1">
                  <label className="flex items-center gap-2 text-xs text-slate-300 bg-slate-900 px-3 py-2 rounded-lg border border-slate-800 cursor-pointer">
                    <input
                      type="checkbox"
                      checked={settings.logScale}
                      onChange={(e) => updateSettings({ logScale: e.target.checked })}
                      className="accent-cyan-400 cursor-pointer"
                    />
                    <span>Logarithmic Hz Scale</span>
                  </label>

                  <label className="flex items-center gap-2 text-xs text-slate-300 bg-slate-900 px-3 py-2 rounded-lg border border-slate-800 cursor-pointer">
                    <input
                      type="checkbox"
                      checked={settings.showHzScale}
                      onChange={(e) => updateSettings({ showHzScale: e.target.checked })}
                      className="accent-cyan-400 cursor-pointer"
                    />
                    <span>Show Hz Axis Labels</span>
                  </label>

                  <label className="flex items-center gap-2 text-xs text-slate-300 bg-slate-900 px-3 py-2 rounded-lg border border-slate-800 cursor-pointer">
                    <input
                      type="checkbox"
                      checked={settings.showDbGrid}
                      onChange={(e) => updateSettings({ showDbGrid: e.target.checked })}
                      className="accent-cyan-400 cursor-pointer"
                    />
                    <span>Show dB Reticle Grid</span>
                  </label>

                  <label className="flex items-center gap-2 text-xs text-slate-300 bg-slate-900 px-3 py-2 rounded-lg border border-slate-800 cursor-pointer">
                    <input
                      type="checkbox"
                      checked={settings.showPeaks}
                      onChange={(e) => updateSettings({ showPeaks: e.target.checked })}
                      className="accent-cyan-400 cursor-pointer"
                    />
                    <span>Peak Hold Caps</span>
                  </label>
                </div>
              </div>
            </div>
          )}

          {/* SECTION 2: MICROPHONE & ACOUSTIC CALIBRATION SETTINGS */}
          {activeSection === 'mic' && (
            <div className="flex flex-col gap-5">
              {/* Hardware Mic Selector */}
              <MicSettingsSelector
                engineState={engineState}
                enableMicrophone={enableMicrophone}
                toggleMicMonitoring={toggleMicMonitoring}
                metrics={metrics}
              />

              {/* Acoustic Weighting & Transient Threshold Calibration */}
              <div className="bg-slate-950 border border-slate-800 rounded-xl p-4 flex flex-col gap-4">
                <div>
                  <h3 className="text-sm font-bold text-white">
                    Acoustic Weighting &amp; Transient Calibration
                  </h3>
                  <p className="text-xs text-slate-400">
                    Configure IEC 61672 weighting filters and Schmitt-trigger impulse sensitivity
                  </p>
                </div>

                {/* Weighting Buttons */}
                <div className="flex flex-col gap-1.5">
                  <label className="text-xs font-semibold text-slate-300">
                    Frequency Weighting Standard
                  </label>
                  <div className="grid grid-cols-3 gap-2">
                    {(['Z', 'A', 'C'] as FrequencyWeighting[]).map((w) => (
                      <button
                        key={w}
                        onClick={() => setWeighting(w)}
                        className={`p-2.5 rounded-lg border text-xs font-mono font-bold cursor-pointer transition-colors ${
                          weighting === w
                            ? 'bg-cyan-500/20 border-cyan-400 text-cyan-300'
                            : 'bg-slate-900 border-slate-800 text-slate-400 hover:text-white'
                        }`}
                      >
                        {w === 'Z' ? 'Z (Flat Linear)' : w === 'A' ? 'A (dBA Ear)' : 'C (dBC Bass)'}
                      </button>
                    ))}
                  </div>
                </div>

                {/* Transient Sensitivity */}
                {setTransientSensitivity && (
                  <div className="flex flex-col gap-1.5">
                    <div className="flex items-center justify-between">
                      <label className="text-xs font-semibold text-slate-300 flex items-center gap-1.5">
                        <Zap className="w-3.5 h-3.5 text-amber-400" />
                        <span>Transient Spike Detection Sensitivity</span>
                      </label>
                      {resetTransients && (
                        <button
                          onClick={resetTransients}
                          className="text-xs text-amber-400 hover:text-amber-300 font-medium cursor-pointer"
                        >
                          Reset Count ({profile.transientCount})
                        </button>
                      )}
                    </div>
                    <div className="grid grid-cols-3 gap-2">
                      {(['strict', 'balanced', 'sensitive'] as const).map((mode) => (
                        <button
                          key={mode}
                          onClick={() => setTransientSensitivity(mode)}
                          className={`p-2.5 rounded-lg border text-xs font-semibold capitalize cursor-pointer transition-colors ${
                            (profile.transientSensitivity || 'balanced') === mode
                              ? 'bg-amber-500/20 border-amber-400 text-amber-300'
                              : 'bg-slate-900 border-slate-800 text-slate-400 hover:text-white'
                          }`}
                        >
                          {mode}
                        </button>
                      ))}
                    </div>
                  </div>
                )}

                {/* Room Noise Baseline Calibration Trigger */}
                <div className="pt-2 border-t border-slate-800 flex items-center justify-between gap-3">
                  <div>
                    <div className="text-xs font-semibold text-white">
                      Ambient Room Floor Calibration
                    </div>
                    <div className="text-[11px] text-slate-400">
                      Current Floor: <strong className="text-cyan-300 font-mono">{profile.noiseFloorDb} dB</strong> &middot; Rating: <strong className="text-slate-200">{profile.noiseCriteriaRating}</strong>
                    </div>
                  </div>
                  <button
                    onClick={startCalibration}
                    disabled={isCalibrating}
                    className="px-3 py-2 rounded-lg bg-cyan-500 hover:bg-cyan-400 text-slate-950 font-bold text-xs flex items-center gap-1.5 cursor-pointer transition-colors shrink-0 disabled:opacity-50"
                  >
                    <RefreshCw className={`w-3.5 h-3.5 ${isCalibrating ? 'animate-spin' : ''}`} />
                    <span>{isCalibrating ? `${profile.calibrationProgress}%` : 'Calibrate Now'}</span>
                  </button>
                </div>
              </div>
            </div>
          )}

          {/* SECTION 3: AUDIO GAIN, PAN & 10-BAND GRAPHIC EQ */}
          {activeSection === 'audio' && (
            <div className="flex flex-col gap-5">
              {/* Master Output Gain & Mute */}
              <div className="bg-slate-950 border border-slate-800 rounded-xl p-4 flex flex-col gap-3">
                <div className="flex items-center justify-between">
                  <div>
                    <h3 className="text-sm font-bold text-white">Master Output Volume</h3>
                    <p className="text-xs text-slate-400">
                      Controls media playback &amp; signal generator output gain
                    </p>
                  </div>
                  <button
                    onClick={toggleMute}
                    className={`px-3 py-1.5 rounded-lg text-xs font-semibold border flex items-center gap-1.5 cursor-pointer ${
                      engineState.isMuted
                        ? 'bg-rose-500/20 border-rose-500/40 text-rose-300'
                        : 'bg-slate-900 border-slate-800 text-slate-300'
                    }`}
                  >
                    {engineState.isMuted ? (
                      <>
                        <VolumeX className="w-3.5 h-3.5 text-rose-400" />
                        <span>Muted</span>
                      </>
                    ) : (
                      <>
                        <Volume2 className="w-3.5 h-3.5 text-cyan-400" />
                        <span>{Math.round(engineState.volume * 100)}%</span>
                      </>
                    )}
                  </button>
                </div>

                <input
                  type="range"
                  min={0}
                  max={1}
                  step={0.01}
                  value={engineState.isMuted ? 0 : engineState.volume}
                  onChange={(e) => setVolume(parseFloat(e.target.value))}
                  className="w-full h-2 bg-slate-800 rounded-lg appearance-none cursor-pointer accent-cyan-400"
                />
              </div>

              {/* 10-Band Equalizer & Spatial Pan */}
              <EqualizerPanel
                engineState={engineState}
                setEq={setEq}
                setPlaybackRate={setPlaybackRate}
                setPan={setPan}
              />
            </div>
          )}
        </div>
      </div>
    </div>
  );
};
