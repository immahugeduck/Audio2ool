import React from 'react';
import { VisualizerSettings, VisualizationMode, FrequencyZoomPreset } from '../types';
import {
  Sliders,
  BarChart2,
  Layers,
  Waves,
  Sun,
  Grid,
  Eye,
  Activity,
  ZoomIn,
  Palette,
} from 'lucide-react';
import { getPresetById } from '../utils/colorGradients';

interface VisualizerControlsProps {
  settings: VisualizerSettings;
  updateSettings: (partial: Partial<VisualizerSettings>) => void;
  onOpenSettings?: (section?: 'color' | 'mic' | 'audio') => void;
}

export const VisualizerControls: React.FC<VisualizerControlsProps> = ({
  settings,
  updateSettings,
  onOpenSettings,
}) => {
  const modes: {
    id: VisualizationMode;
    label: string;
    desc: string;
    icon: React.ReactNode;
  }[] = [
    { id: 'bars', label: 'Precision Bars', desc: 'Calibrated FFT Spectrum', icon: <BarChart2 className="w-3.5 h-3.5" /> },
    { id: 'curve', label: 'Spectral Spline', desc: 'Continuous SPL Contour', icon: <Waves className="w-3.5 h-3.5" /> },
    { id: 'oscilloscope', label: 'Oscilloscope', desc: 'Zero-Cross Wave Line', icon: <Activity className="w-3.5 h-3.5" /> },
    { id: 'waveform', label: 'Waveform', desc: 'Time-Domain Envelope', icon: <Eye className="w-3.5 h-3.5" /> },
    { id: 'waterfall', label: '3D Waterfall', desc: '3D Spectral Rainfall', icon: <Layers className="w-3.5 h-3.5" /> },
    { id: 'spectrogram', label: '2D Heatmap', desc: 'Time-Frequency Map', icon: <Grid className="w-3.5 h-3.5" /> },
    { id: 'hybrid', label: 'Dual Scope', desc: 'FFT + Oscilloscope', icon: <Sun className="w-3.5 h-3.5" /> },
  ];

  const zoomPresets: {
    id: FrequencyZoomPreset;
    label: string;
    rangeLabel: string;
    min: number;
    max: number;
  }[] = [
    { id: 'full', label: 'Full Spectrum', rangeLabel: '20 Hz – 20 kHz', min: 20, max: 20000 },
    { id: 'sub-bass', label: 'Sub & Bass', rangeLabel: '20 – 250 Hz', min: 20, max: 250 },
    { id: 'mid-vocal', label: 'Speech & Mid', rangeLabel: '200 Hz – 4 kHz', min: 200, max: 4000 },
    { id: 'treble-air', label: 'Treble & Air', rangeLabel: '4 – 20 kHz', min: 4000, max: 20000 },
    {
      id: 'custom',
      label: 'Custom Span',
      rangeLabel: `${settings.minFreqHz} Hz – ${
        settings.maxFreqHz >= 1000
          ? `${(settings.maxFreqHz / 1000).toFixed(1)}k`
          : settings.maxFreqHz
      } Hz`,
      min: settings.minFreqHz,
      max: settings.maxFreqHz,
    },
  ];

  const fftSizes = [256, 512, 1024, 2048, 4096, 8192];
  const activeColorPreset = getPresetById(settings.spectrogramColorMap || settings.colorPresetId);

  const handleZoomSelect = (preset: typeof zoomPresets[0]) => {
    if (preset.id === 'custom') {
      updateSettings({ zoomPreset: 'custom' });
    } else {
      updateSettings({
        zoomPreset: preset.id,
        minFreqHz: preset.min,
        maxFreqHz: preset.max,
      });
    }
  };

  return (
    <div className="bg-slate-900 border border-slate-800 rounded-2xl p-4 flex flex-col gap-4">
      {/* Top Row: View Mode Switcher Header & Quick Settings Trigger */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2 pb-3 border-b border-slate-800">
        <div className="flex items-center gap-2">
          <div className="p-1.5 rounded-lg bg-cyan-500/10 border border-cyan-500/30 text-cyan-400">
            <Sliders className="w-4 h-4" />
          </div>
          <div>
            <h2 className="text-sm font-bold text-white">
              Visualizer Views, Frequency Span &amp; Scope Calibration
            </h2>
            <p className="text-xs text-slate-400">
              Select display mode, inspect sub-band frequency ranges, and calibrate dBFS floor/ceiling
            </p>
          </div>
        </div>

        {onOpenSettings && (
          <button
            onClick={() => onOpenSettings('color')}
            id="btn-controls-open-settings"
            className="px-3 py-1.5 rounded-xl bg-slate-950 hover:bg-slate-800 border border-slate-700 text-xs font-semibold text-cyan-300 flex items-center gap-2 cursor-pointer transition-colors self-start sm:self-auto shrink-0"
          >
            <Palette className="w-3.5 h-3.5 text-cyan-400" />
            <span>Heatmap: {activeColorPreset.name}</span>
          </button>
        )}
      </div>

      {/* 1. Display / View Mode Selector */}
      <div className="grid grid-cols-2 sm:grid-cols-4 xl:grid-cols-7 gap-2">
        {modes.map((m) => {
          const isSelected = settings.mode === m.id;
          return (
            <button
              key={m.id}
              onClick={() => updateSettings({ mode: m.id })}
              id={`btn-mode-${m.id}`}
              className={`flex items-center gap-2.5 p-2.5 rounded-xl text-left border transition-colors cursor-pointer ${
                isSelected
                  ? 'bg-cyan-500/15 border-cyan-400 text-white'
                  : 'bg-slate-950 border-slate-800 text-slate-400 hover:text-white hover:border-slate-700'
              }`}
            >
              <div
                className={`p-1.5 rounded-lg shrink-0 ${
                  isSelected
                    ? 'bg-cyan-500/20 text-cyan-300 border border-cyan-400/40'
                    : 'bg-slate-900 border border-slate-800 text-slate-400'
                }`}
              >
                {m.icon}
              </div>
              <div className="min-w-0">
                <div className="font-bold text-xs text-slate-100 truncate">{m.label}</div>
                <div className="text-[10px] text-slate-400 truncate">{m.desc}</div>
              </div>
            </button>
          );
        })}
      </div>

      {/* 2. Sub-Band Frequency Span Zoom */}
      <div className="bg-slate-950 rounded-xl p-3 border border-slate-800 flex flex-col gap-2.5">
        <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-2">
          <div className="flex items-center gap-2">
            <ZoomIn className="w-4 h-4 text-cyan-400 shrink-0" />
            <span className="text-xs font-bold text-slate-200">
              Frequency Span Zoom:
            </span>
            <span className="text-xs font-mono tabular-nums text-cyan-300">
              {settings.minFreqHz} Hz –{' '}
              {settings.maxFreqHz >= 1000
                ? `${(settings.maxFreqHz / 1000).toFixed(1)} kHz`
                : `${settings.maxFreqHz} Hz`}
            </span>
          </div>

          <div className="flex items-center gap-1.5 flex-wrap">
            {zoomPresets.map((zp) => {
              const active = settings.zoomPreset === zp.id;
              return (
                <button
                  key={zp.id}
                  onClick={() => handleZoomSelect(zp)}
                  id={`btn-zoom-${zp.id}`}
                  className={`px-2.5 py-1 rounded-lg text-xs font-semibold border transition-colors cursor-pointer whitespace-nowrap ${
                    active
                      ? 'bg-cyan-500 text-slate-950 border-cyan-400 font-bold'
                      : 'bg-slate-900 hover:bg-slate-800 text-slate-300 border-slate-800'
                  }`}
                >
                  {zp.label}{' '}
                  <span
                    className={`text-[10px] font-mono ${
                      active ? 'text-slate-900' : 'text-slate-400'
                    }`}
                  >
                    ({zp.rangeLabel})
                  </span>
                </button>
              );
            })}
          </div>
        </div>

        {settings.zoomPreset === 'custom' && (
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 pt-2 border-t border-slate-800">
            <div className="flex flex-col gap-1">
              <div className="flex justify-between text-xs">
                <span className="text-slate-400">Low Cutoff (Min Hz)</span>
                <span className="font-mono tabular-nums text-cyan-300 font-bold">
                  {settings.minFreqHz} Hz
                </span>
              </div>
              <input
                type="range"
                min={20}
                max={Math.max(40, settings.maxFreqHz - 100)}
                step={10}
                value={settings.minFreqHz}
                onChange={(e) =>
                  updateSettings({ zoomPreset: 'custom', minFreqHz: parseInt(e.target.value) })
                }
                className="w-full h-1.5 bg-slate-800 rounded-lg appearance-none cursor-pointer accent-cyan-400"
              />
            </div>

            <div className="flex flex-col gap-1">
              <div className="flex justify-between text-xs">
                <span className="text-slate-400">High Cutoff (Max Hz)</span>
                <span className="font-mono tabular-nums text-cyan-300 font-bold">
                  {settings.maxFreqHz} Hz
                </span>
              </div>
              <input
                type="range"
                min={Math.min(19900, settings.minFreqHz + 100)}
                max={20000}
                step={50}
                value={settings.maxFreqHz}
                onChange={(e) =>
                  updateSettings({ zoomPreset: 'custom', maxFreqHz: parseInt(e.target.value) })
                }
                className="w-full h-1.5 bg-slate-800 rounded-lg appearance-none cursor-pointer accent-cyan-400"
              />
            </div>
          </div>
        )}
      </div>

      {/* 3. Direct Calibration Bar: Floor dB, Ceiling dB, Smoothing, Gain, FFT */}
      <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-5 gap-2.5">
        <div className="bg-slate-950 p-2.5 rounded-xl border border-slate-800 flex flex-col gap-1">
          <div className="flex justify-between text-xs">
            <span className="text-slate-400">Floor</span>
            <span className="font-mono tabular-nums text-amber-400 font-bold">
              {settings.minDecibels} dB
            </span>
          </div>
          <input
            type="range"
            min={-110}
            max={Math.min(-40, settings.maxDecibels - 15)}
            step={2}
            value={settings.minDecibels}
            onChange={(e) => updateSettings({ minDecibels: parseInt(e.target.value) })}
            className="w-full h-1.5 bg-slate-800 rounded-lg appearance-none cursor-pointer accent-amber-400"
          />
        </div>

        <div className="bg-slate-950 p-2.5 rounded-xl border border-slate-800 flex flex-col gap-1">
          <div className="flex justify-between text-xs">
            <span className="text-slate-400">Ceiling</span>
            <span className="font-mono tabular-nums text-emerald-400 font-bold">
              {settings.maxDecibels} dB
            </span>
          </div>
          <input
            type="range"
            min={Math.max(-60, settings.minDecibels + 15)}
            max={0}
            step={2}
            value={settings.maxDecibels}
            onChange={(e) => updateSettings({ maxDecibels: parseInt(e.target.value) })}
            className="w-full h-1.5 bg-slate-800 rounded-lg appearance-none cursor-pointer accent-emerald-400"
          />
        </div>

        <div className="bg-slate-950 p-2.5 rounded-xl border border-slate-800 flex flex-col gap-1">
          <div className="flex justify-between text-xs">
            <span className="text-slate-400">Smoothing</span>
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
            className="w-full h-1.5 bg-slate-800 rounded-lg appearance-none cursor-pointer accent-cyan-400"
          />
        </div>

        <div className="bg-slate-950 p-2.5 rounded-xl border border-slate-800 flex flex-col gap-1">
          <div className="flex justify-between text-xs">
            <span className="text-slate-400">Gain</span>
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
            className="w-full h-1.5 bg-slate-800 rounded-lg appearance-none cursor-pointer accent-cyan-400"
          />
        </div>

        <div className="bg-slate-950 p-2.5 rounded-xl border border-slate-800 flex flex-col gap-1 col-span-2 sm:col-span-1">
          <div className="flex justify-between text-xs">
            <span className="text-slate-400">FFT Size</span>
            <span className="font-mono tabular-nums text-cyan-400 font-bold">
              {settings.fftSize}
            </span>
          </div>
          <select
            value={settings.fftSize}
            onChange={(e) => updateSettings({ fftSize: parseInt(e.target.value) })}
            className="bg-slate-900 border border-slate-700 text-xs text-slate-200 rounded px-1.5 py-0.5 focus:outline-none focus:border-cyan-500 cursor-pointer"
          >
            {fftSizes.map((size) => (
              <option key={size} value={size}>
                {size} ({size / 2} Bins)
              </option>
            ))}
          </select>
        </div>
      </div>
    </div>
  );
};
