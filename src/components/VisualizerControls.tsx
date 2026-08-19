import React from 'react';
import { VisualizerSettings, VisualizationMode } from '../types';
import { Sliders, BarChart2, Layers, Waves, Sun, Grid, Eye } from 'lucide-react';

interface VisualizerControlsProps {
  settings: VisualizerSettings;
  updateSettings: (partial: Partial<VisualizerSettings>) => void;
}

export const VisualizerControls: React.FC<VisualizerControlsProps> = ({
  settings,
  updateSettings,
}) => {
  const modes: { id: VisualizationMode; label: string; desc: string; icon: React.ReactNode }[] = [
    { id: 'bars', label: 'Precision Bars', desc: 'Calibrated FFT Spectrum', icon: <BarChart2 className="w-3.5 h-3.5 text-cyan-400" /> },
    { id: 'curve', label: 'Spectral Spline', desc: 'Continuous SPL Contour', icon: <Waves className="w-3.5 h-3.5 text-emerald-400" /> },
    { id: 'waterfall', label: '3D Waterfall', desc: '3D Spectrogram Rainfall', icon: <Layers className="w-3.5 h-3.5 text-amber-400" /> },
    { id: 'spectrogram', label: '2D Heatmap', desc: 'Time-Frequency Heatmap', icon: <Grid className="w-3.5 h-3.5 text-purple-400" /> },
    { id: 'waveform', label: 'Oscilloscope', desc: 'Time-Domain Voltage', icon: <Eye className="w-3.5 h-3.5 text-rose-400" /> },
    { id: 'hybrid', label: 'Dual Multi-Scope', desc: 'FFT + Oscilloscope', icon: <Sun className="w-3.5 h-3.5 text-indigo-400" /> },
  ];

  const fftSizes = [128, 256, 512, 1024, 2048, 4096, 8192];

  return (
    <div className="bg-slate-900/90 rounded-2xl border border-slate-800 p-4 sm:p-5 shadow-xl flex flex-col gap-4">
      <div className="flex items-center gap-2 pb-3 border-b border-slate-800">
        <Sliders className="w-4 h-4 text-cyan-400" />
        <h2 className="text-sm font-semibold text-white">Visualizer Parameters</h2>
      </div>

      {/* Mode Selector Buttons */}
      <div className="flex flex-col gap-1.5">
        <label className="text-xs text-slate-400 font-medium">Acoustic View Selection</label>
        <div className="grid grid-cols-2 sm:grid-cols-3 gap-2">
          {modes.map((m) => (
            <button
              key={m.id}
              onClick={() => updateSettings({ mode: m.id })}
              id={`btn-mode-${m.id}`}
              className={`flex items-start gap-2.5 p-2.5 rounded-xl text-xs font-medium border transition-all cursor-pointer text-left ${
                settings.mode === m.id
                  ? 'bg-gradient-to-r from-cyan-500/20 to-blue-500/10 border-cyan-500 text-cyan-300 font-semibold shadow-md ring-1 ring-cyan-500/30'
                  : 'bg-slate-950 border-slate-800 text-slate-400 hover:text-white hover:border-slate-700'
              }`}
            >
              <div className="p-1 rounded-lg bg-slate-900 border border-slate-800 shrink-0 mt-0.5">
                {m.icon}
              </div>
              <div className="flex flex-col min-w-0">
                <span className="font-bold text-slate-200 truncate">{m.label}</span>
                <span className="text-[10px] text-slate-500 font-normal truncate">{m.desc}</span>
              </div>
            </button>
          ))}
        </div>
      </div>

      {/* Sliders Grid: Smoothing, Sensitivity, FFT Size */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4 pt-2">
        {/* Smoothing Slider */}
        <div className="flex flex-col gap-1.5 bg-slate-950 p-3 rounded-xl border border-slate-800">
          <div className="flex justify-between items-center text-xs">
            <span className="text-slate-400 font-medium">Smoothing</span>
            <span className="font-mono text-cyan-400">{settings.smoothing.toFixed(2)}</span>
          </div>
          <input
            type="range"
            min={0.0}
            max={0.95}
            step={0.01}
            value={settings.smoothing}
            onChange={(e) => updateSettings({ smoothing: parseFloat(e.target.value) })}
            id="input-smoothing-slider"
            className="w-full h-1.5 bg-slate-800 rounded-lg appearance-none cursor-pointer accent-cyan-400"
          />
        </div>

        {/* Sensitivity Slider */}
        <div className="flex flex-col gap-1.5 bg-slate-950 p-3 rounded-xl border border-slate-800">
          <div className="flex justify-between items-center text-xs">
            <span className="text-slate-400 font-medium">Gain Sensitivity</span>
            <span className="font-mono text-cyan-400">{settings.sensitivity.toFixed(1)}x</span>
          </div>
          <input
            type="range"
            min={0.5}
            max={2.5}
            step={0.1}
            value={settings.sensitivity}
            onChange={(e) => updateSettings({ sensitivity: parseFloat(e.target.value) })}
            id="input-sensitivity-slider"
            className="w-full h-1.5 bg-slate-800 rounded-lg appearance-none cursor-pointer accent-cyan-400"
          />
        </div>

        {/* FFT Resolution Dropdown */}
        <div className="flex flex-col gap-1.5 bg-slate-950 p-3 rounded-xl border border-slate-800">
          <label className="text-xs text-slate-400 font-medium">FFT Resolution (Bins)</label>
          <select
            value={settings.fftSize}
            onChange={(e) => updateSettings({ fftSize: parseInt(e.target.value) })}
            id="select-fft-size"
            className="bg-slate-900 border border-slate-700 text-xs text-slate-200 rounded-lg px-2.5 py-1 focus:outline-none focus:border-cyan-500 cursor-pointer"
          >
            {fftSizes.map((size) => (
              <option key={size} value={size}>
                {size} Bins ({size / 2} Frequency Bands)
              </option>
            ))}
          </select>
        </div>
      </div>

      {/* Feature Toggles Checklist */}
      <div className="flex flex-wrap items-center gap-3 pt-2">
        <label className="flex items-center gap-2 text-xs text-slate-300 bg-slate-950 px-3 py-1.5 rounded-xl border border-slate-800 cursor-pointer">
          <input
            type="checkbox"
            checked={settings.logScale}
            onChange={(e) => updateSettings({ logScale: e.target.checked })}
            className="accent-cyan-400 cursor-pointer"
          />
          Logarithmic Scale
        </label>

        <label className="flex items-center gap-2 text-xs text-slate-300 bg-slate-950 px-3 py-1.5 rounded-xl border border-slate-800 cursor-pointer">
          <input
            type="checkbox"
            checked={settings.showHzScale}
            onChange={(e) => updateSettings({ showHzScale: e.target.checked })}
            className="accent-cyan-400 cursor-pointer"
          />
          Hz Axis Scale
        </label>

        <label className="flex items-center gap-2 text-xs text-slate-300 bg-slate-950 px-3 py-1.5 rounded-xl border border-slate-800 cursor-pointer">
          <input
            type="checkbox"
            checked={settings.showDbGrid}
            onChange={(e) => updateSettings({ showDbGrid: e.target.checked })}
            className="accent-cyan-400 cursor-pointer"
          />
          dB Level Grid
        </label>

        <label className="flex items-center gap-2 text-xs text-slate-300 bg-slate-950 px-3 py-1.5 rounded-xl border border-slate-800 cursor-pointer">
          <input
            type="checkbox"
            checked={settings.showPeaks}
            onChange={(e) => updateSettings({ showPeaks: e.target.checked })}
            className="accent-cyan-400 cursor-pointer"
          />
          Peak Caps Hold
        </label>

        <label className="flex items-center gap-2 text-xs text-slate-300 bg-slate-950 px-3 py-1.5 rounded-xl border border-slate-800 cursor-pointer">
          <input
            type="checkbox"
            checked={settings.reactiveColors}
            onChange={(e) => updateSettings({ reactiveColors: e.target.checked })}
            className="accent-cyan-400 cursor-pointer"
          />
          Audio Reactive Glow
        </label>
      </div>
    </div>
  );
};
