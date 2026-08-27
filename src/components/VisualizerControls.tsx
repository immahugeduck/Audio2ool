import React from 'react';
import { VisualizerSettings, VisualizationMode } from '../types';
import { Sliders, BarChart2, Layers, Waves, Sun, Grid, Eye, Activity } from 'lucide-react';

interface VisualizerControlsProps {
  settings: VisualizerSettings;
  updateSettings: (partial: Partial<VisualizerSettings>) => void;
}

export const VisualizerControls: React.FC<VisualizerControlsProps> = ({
  settings,
  updateSettings,
}) => {
  const modes: { id: VisualizationMode; label: string; desc: string; icon: React.ReactNode; color: string }[] = [
    { id: 'bars', label: 'Precision Bars', desc: 'Calibrated FFT Spectrum', icon: <BarChart2 className="w-3.5 h-3.5" />, color: 'cyan' },
    { id: 'curve', label: 'Spectral Spline', desc: 'Continuous SPL Contour', icon: <Waves className="w-3.5 h-3.5" />, color: 'emerald' },
    { id: 'oscilloscope', label: 'Oscilloscope', desc: 'Continuous Neon Wave Line', icon: <Activity className="w-3.5 h-3.5" />, color: 'lime' },
    { id: 'waveform', label: 'Waveform', desc: 'Time-Domain Voltage', icon: <Eye className="w-3.5 h-3.5" />, color: 'rose' },
    { id: 'waterfall', label: '3D Waterfall', desc: '3D Spectrogram Rainfall', icon: <Layers className="w-3.5 h-3.5" />, color: 'amber' },
    { id: 'spectrogram', label: '2D Heatmap', desc: 'Time-Frequency Heatmap', icon: <Grid className="w-3.5 h-3.5" />, color: 'purple' },
    { id: 'hybrid', label: 'Dual Multi-Scope', desc: 'FFT + Oscilloscope', icon: <Sun className="w-3.5 h-3.5" />, color: 'indigo' },
  ];

  const fftSizes = [128, 256, 512, 1024, 2048, 4096, 8192];

  return (
    <div className="bg-slate-900/95 rounded-2xl border border-cyan-500/20 p-4 sm:p-5 shadow-2xl backdrop-blur-md flex flex-col gap-4">
      <div className="flex items-center justify-between pb-3 border-b border-slate-800">
        <div className="flex items-center gap-2">
          <div className="p-1.5 rounded-lg bg-cyan-500/10 border border-cyan-500/30 text-cyan-400">
            <Sliders className="w-4 h-4" />
          </div>
          <div>
            <h2 className="text-sm font-bold text-white tracking-wide flex items-center gap-2">
              Visualizer Controls & Scope Parameters
              <span className="text-[10px] uppercase font-mono px-2 py-0.5 rounded bg-cyan-500/20 text-cyan-300 border border-cyan-500/30">
                Direct Controls
              </span>
            </h2>
            <p className="text-[11px] text-slate-400">Real-time spectrum mode, oscilloscope timebase, sensitivity & resolution</p>
          </div>
        </div>
      </div>

      {/* Mode Selector Buttons */}
      <div className="flex flex-col gap-1.5">
        <label className="text-xs text-slate-300 font-semibold flex items-center justify-between">
          <span>Acoustic View Mode</span>
          <span className="text-[10px] font-mono text-cyan-400 uppercase">{settings.mode} ACTIVE</span>
        </label>
        <div className="grid grid-cols-2 sm:grid-cols-4 lg:grid-cols-7 gap-2">
          {modes.map((m) => {
            const isSelected = settings.mode === m.id;
            return (
              <button
                key={m.id}
                onClick={() => updateSettings({ mode: m.id })}
                id={`btn-mode-${m.id}`}
                className={`flex flex-col items-start gap-1 p-2.5 rounded-xl text-xs font-medium border transition-all cursor-pointer text-left ${
                  isSelected
                    ? 'bg-gradient-to-b from-cyan-500/20 to-blue-600/10 border-cyan-400 text-cyan-200 font-bold shadow-[0_0_15px_rgba(6,182,212,0.25)] ring-1 ring-cyan-400/40'
                    : 'bg-slate-950/80 border-slate-800/90 text-slate-400 hover:text-white hover:border-slate-700 hover:bg-slate-900/90'
                }`}
              >
                <div className={`p-1.5 rounded-lg shrink-0 ${isSelected ? 'bg-cyan-500/20 text-cyan-300 border border-cyan-400/40' : 'bg-slate-900 border border-slate-800 text-slate-400'}`}>
                  {m.icon}
                </div>
                <div className="flex flex-col min-w-0 w-full mt-1">
                  <span className="font-bold text-[11px] text-slate-100 truncate">{m.label}</span>
                  <span className="text-[9px] text-slate-500 font-normal truncate">{m.desc}</span>
                </div>
              </button>
            );
          })}
        </div>
      </div>

      {/* Sliders Grid: Smoothing, Sensitivity, FFT Size */}
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-3 pt-1">
        {/* Smoothing Slider */}
        <div className="flex flex-col gap-1.5 bg-slate-950/90 p-3 rounded-xl border border-slate-800/80">
          <div className="flex justify-between items-center text-xs">
            <span className="text-slate-300 font-medium">Smoothing Decay</span>
            <span className="font-mono text-cyan-400 font-bold">{settings.smoothing.toFixed(2)}</span>
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
        <div className="flex flex-col gap-1.5 bg-slate-950/90 p-3 rounded-xl border border-slate-800/80">
          <div className="flex justify-between items-center text-xs">
            <span className="text-slate-300 font-medium">Gain / Beam Sensitivity</span>
            <span className="font-mono text-cyan-400 font-bold">{settings.sensitivity.toFixed(1)}x</span>
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
        <div className="flex flex-col gap-1.5 bg-slate-950/90 p-3 rounded-xl border border-slate-800/80">
          <div className="flex justify-between items-center text-xs">
            <span className="text-slate-300 font-medium">FFT Resolution</span>
            <span className="font-mono text-cyan-400 font-bold">{settings.fftSize / 2} Bands</span>
          </div>
          <select
            value={settings.fftSize}
            onChange={(e) => updateSettings({ fftSize: parseInt(e.target.value) })}
            id="select-fft-size"
            className="bg-slate-900 border border-slate-700 text-xs text-slate-200 rounded-lg px-2.5 py-1.5 focus:outline-none focus:border-cyan-500 cursor-pointer"
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
      <div className="flex flex-wrap items-center gap-2 pt-1">
        <label className="flex items-center gap-2 text-xs text-slate-300 bg-slate-950/90 px-3 py-1.5 rounded-xl border border-slate-800/80 hover:border-cyan-500/40 transition-all cursor-pointer">
          <input
            type="checkbox"
            checked={settings.logScale}
            onChange={(e) => updateSettings({ logScale: e.target.checked })}
            className="accent-cyan-400 cursor-pointer"
          />
          Logarithmic Scale
        </label>

        <label className="flex items-center gap-2 text-xs text-slate-300 bg-slate-950/90 px-3 py-1.5 rounded-xl border border-slate-800/80 hover:border-cyan-500/40 transition-all cursor-pointer">
          <input
            type="checkbox"
            checked={settings.showHzScale}
            onChange={(e) => updateSettings({ showHzScale: e.target.checked })}
            className="accent-cyan-400 cursor-pointer"
          />
          Hz Axis Scale
        </label>

        <label className="flex items-center gap-2 text-xs text-slate-300 bg-slate-950/90 px-3 py-1.5 rounded-xl border border-slate-800/80 hover:border-cyan-500/40 transition-all cursor-pointer">
          <input
            type="checkbox"
            checked={settings.showDbGrid}
            onChange={(e) => updateSettings({ showDbGrid: e.target.checked })}
            className="accent-cyan-400 cursor-pointer"
          />
          dB / Reticle Grid
        </label>

        <label className="flex items-center gap-2 text-xs text-slate-300 bg-slate-950/90 px-3 py-1.5 rounded-xl border border-slate-800/80 hover:border-cyan-500/40 transition-all cursor-pointer">
          <input
            type="checkbox"
            checked={settings.showPeaks}
            onChange={(e) => updateSettings({ showPeaks: e.target.checked })}
            className="accent-cyan-400 cursor-pointer"
          />
          Peak Caps Hold
        </label>

        <label className="flex items-center gap-2 text-xs text-slate-300 bg-slate-950/90 px-3 py-1.5 rounded-xl border border-slate-800/80 hover:border-cyan-500/40 transition-all cursor-pointer">
          <input
            type="checkbox"
            checked={settings.reactiveColors}
            onChange={(e) => updateSettings({ reactiveColors: e.target.checked })}
            className="accent-cyan-400 cursor-pointer"
          />
          Neon Reactive Glow
        </label>
      </div>
    </div>
  );
};
