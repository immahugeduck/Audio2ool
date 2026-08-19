import React from 'react';
import { AudioEngineState } from '../types';
import { EQ_PRESETS } from '../utils/audioPresets';
import { SlidersHorizontal, RotateCcw, FastForward, Compass, Sliders } from 'lucide-react';

interface EqualizerPanelProps {
  engineState: AudioEngineState;
  setEq: (bass: number, mid: number, treble: number) => void;
  setPlaybackRate: (rate: number) => void;
  setPan: (pan: number) => void;
}

export const EqualizerPanel: React.FC<EqualizerPanelProps> = ({
  engineState,
  setEq,
  setPlaybackRate,
  setPan,
}) => {
  const speedOptions = [0.5, 0.75, 1.0, 1.25, 1.5, 2.0];

  const resetEq = () => {
    setEq(0, 0, 0);
  };

  return (
    <div className="bg-slate-900/90 rounded-2xl border border-slate-800 p-4 sm:p-5 shadow-xl flex flex-col gap-4">
      <div className="flex items-center justify-between pb-3 border-b border-slate-800">
        <div className="flex items-center gap-2">
          <SlidersHorizontal className="w-4 h-4 text-cyan-400" />
          <h2 className="text-sm font-semibold text-white">3-Band EQ & Spatial Pan</h2>
        </div>

        <button
          onClick={resetEq}
          id="btn-reset-eq"
          className="flex items-center gap-1.5 text-xs text-slate-400 hover:text-white transition-colors cursor-pointer"
        >
          <RotateCcw className="w-3 h-3" />
          Reset Filters
        </button>
      </div>

      {/* EQ Preset Badges */}
      <div className="flex flex-wrap items-center gap-2">
        <span className="text-xs text-slate-400 font-medium mr-1">Presets:</span>
        {EQ_PRESETS.map((preset) => {
          const isActive =
            engineState.bassGain === preset.bass &&
            engineState.midGain === preset.mid &&
            engineState.trebleGain === preset.treble;
          return (
            <button
              key={preset.id}
              onClick={() => setEq(preset.bass, preset.mid, preset.treble)}
              id={`btn-eq-preset-${preset.id}`}
              className={`px-2.5 py-1 rounded-lg text-xs font-medium border transition-all cursor-pointer ${
                isActive
                  ? 'bg-cyan-500/20 border-cyan-500 text-cyan-300 font-semibold shadow-sm'
                  : 'bg-slate-950 border-slate-800 text-slate-400 hover:text-white hover:border-slate-700'
              }`}
            >
              {preset.name}
            </button>
          );
        })}
      </div>

      {/* 3-Band Vertical/Horizontal Sliders */}
      <div className="grid grid-cols-3 gap-3">
        {/* Bass Band */}
        <div className="flex flex-col gap-2 bg-slate-950 p-3 rounded-xl border border-slate-800">
          <div className="flex justify-between text-xs">
            <span className="text-slate-400 font-medium">Bass (250Hz)</span>
            <span className={`font-mono font-semibold ${engineState.bassGain > 0 ? 'text-emerald-400' : engineState.bassGain < 0 ? 'text-rose-400' : 'text-slate-400'}`}>
              {engineState.bassGain > 0 ? `+${engineState.bassGain}` : engineState.bassGain} dB
            </span>
          </div>
          <input
            type="range"
            min={-20}
            max={20}
            step={1}
            value={engineState.bassGain}
            onChange={(e) => setEq(parseFloat(e.target.value), engineState.midGain, engineState.trebleGain)}
            id="input-eq-bass"
            className="w-full h-1.5 bg-slate-800 rounded-lg appearance-none cursor-pointer accent-cyan-400"
          />
        </div>

        {/* Mid Band */}
        <div className="flex flex-col gap-2 bg-slate-950 p-3 rounded-xl border border-slate-800">
          <div className="flex justify-between text-xs">
            <span className="text-slate-400 font-medium">Mid (1kHz)</span>
            <span className={`font-mono font-semibold ${engineState.midGain > 0 ? 'text-emerald-400' : engineState.midGain < 0 ? 'text-rose-400' : 'text-slate-400'}`}>
              {engineState.midGain > 0 ? `+${engineState.midGain}` : engineState.midGain} dB
            </span>
          </div>
          <input
            type="range"
            min={-20}
            max={20}
            step={1}
            value={engineState.midGain}
            onChange={(e) => setEq(engineState.bassGain, parseFloat(e.target.value), engineState.trebleGain)}
            id="input-eq-mid"
            className="w-full h-1.5 bg-slate-800 rounded-lg appearance-none cursor-pointer accent-cyan-400"
          />
        </div>

        {/* Treble Band */}
        <div className="flex flex-col gap-2 bg-slate-950 p-3 rounded-xl border border-slate-800">
          <div className="flex justify-between text-xs">
            <span className="text-slate-400 font-medium">Treble (4kHz)</span>
            <span className={`font-mono font-semibold ${engineState.trebleGain > 0 ? 'text-emerald-400' : engineState.trebleGain < 0 ? 'text-rose-400' : 'text-slate-400'}`}>
              {engineState.trebleGain > 0 ? `+${engineState.trebleGain}` : engineState.trebleGain} dB
            </span>
          </div>
          <input
            type="range"
            min={-20}
            max={20}
            step={1}
            value={engineState.trebleGain}
            onChange={(e) => setEq(engineState.bassGain, engineState.midGain, parseFloat(e.target.value))}
            id="input-eq-treble"
            className="w-full h-1.5 bg-slate-800 rounded-lg appearance-none cursor-pointer accent-cyan-400"
          />
        </div>
      </div>

      {/* Speed & Panner Grid */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-4 pt-2">
        {/* Playback Speed Selector */}
        <div className="flex flex-col gap-2 bg-slate-950 p-3 rounded-xl border border-slate-800">
          <div className="flex items-center gap-1.5 text-xs text-slate-400 font-medium">
            <FastForward className="w-3.5 h-3.5 text-cyan-400" />
            Playback Pitch & Speed
          </div>
          <div className="flex items-center gap-1">
            {speedOptions.map((rate) => (
              <button
                key={rate}
                onClick={() => setPlaybackRate(rate)}
                id={`btn-speed-${rate}`}
                className={`flex-1 py-1 text-xs font-mono font-medium rounded-lg border transition-all cursor-pointer ${
                  engineState.playbackRate === rate
                    ? 'bg-cyan-500/20 border-cyan-500 text-cyan-300 font-bold'
                    : 'bg-slate-900 border-slate-800 text-slate-400 hover:text-white'
                }`}
              >
                {rate}x
              </button>
            ))}
          </div>
        </div>

        {/* Stereo Panner Slider */}
        <div className="flex flex-col gap-2 bg-slate-950 p-3 rounded-xl border border-slate-800">
          <div className="flex justify-between items-center text-xs">
            <div className="flex items-center gap-1.5 text-slate-400 font-medium">
              <Compass className="w-3.5 h-3.5 text-cyan-400" />
              Stereo Balance (Pan)
            </div>
            <span className="font-mono text-cyan-400">
              {engineState.pan < 0
                ? `${Math.abs(Math.round(engineState.pan * 100))}% L`
                : engineState.pan > 0
                ? `${Math.round(engineState.pan * 100)}% R`
                : 'Center'}
            </span>
          </div>
          <input
            type="range"
            min={-1.0}
            max={1.0}
            step={0.05}
            value={engineState.pan}
            onChange={(e) => setPan(parseFloat(e.target.value))}
            id="input-stereo-pan"
            className="w-full h-1.5 bg-slate-800 rounded-lg appearance-none cursor-pointer accent-cyan-400"
          />
        </div>
      </div>
    </div>
  );
};
