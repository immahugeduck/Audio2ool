import React, { useState, useEffect, useMemo, useRef } from 'react';
import { 
  Radio, 
  Activity, 
  Sliders, 
  Volume2, 
  VolumeX, 
  Play, 
  Square, 
  RefreshCw, 
  Zap, 
  Filter, 
  Flame, 
  ChevronRight,
  Info,
  CheckCircle2,
  Maximize2
} from 'lucide-react';
import { 
  SignalGeneratorState, 
  SignalGeneratorWaveform, 
  FrequencyIsolatorState, 
  FrequencyIsolatorType,
  AudioMetrics 
} from '../types';
import { 
  ISO_1_3_OCTAVE_FREQUENCIES, 
  CALIBRATION_PRESETS, 
  computeOctaveBands, 
  formatOctaveFreqLabel 
} from '../utils/frequencyTools';
import { formatFrequency, frequencyToNote } from '../utils/audioPresets';

interface FrequencyToolsPanelProps {
  signalGenState: SignalGeneratorState;
  startSignalGen: (opts?: Partial<SignalGeneratorState>) => void;
  stopSignalGen: () => void;
  updateSignalGen: (partial: Partial<SignalGeneratorState>) => void;
  isolatorState: FrequencyIsolatorState;
  updateIsolator: (partial: Partial<FrequencyIsolatorState>) => void;
  getFrequencyData: () => Uint8Array | null;
  metrics: AudioMetrics;
  sampleRate?: number;
}

export const FrequencyToolsPanel: React.FC<FrequencyToolsPanelProps> = ({
  signalGenState,
  startSignalGen,
  stopSignalGen,
  updateSignalGen,
  isolatorState,
  updateIsolator,
  getFrequencyData,
  metrics,
  sampleRate = 44100,
}) => {
  // Sub-tabs: 'generator' | 'rta' | 'isolator' | 'peaks'
  const [activeSubTab, setActiveSubTab] = useState<'generator' | 'rta' | 'isolator' | 'peaks'>('generator');
  const [rtaSpeed, setRtaSpeed] = useState<'fast' | 'slow'>('fast');
  const [octaveData, setOctaveData] = useState(() => computeOctaveBands(new Uint8Array(1024), sampleRate));
  const [hoveredBand, setHoveredBand] = useState<number | null>(null);

  // Peak hold state for 1/3-octave RTA
  const peakHoldRef = useRef<{ [hz: number]: { db: number; decayTime: number } }>({});

  // 1/3-Octave RTA loop
  useEffect(() => {
    let animId: number;
    let lastUpdate = 0;
    const intervalMs = rtaSpeed === 'fast' ? 40 : 120; // 25fps or ~8fps

    const loop = (now: number) => {
      if (now - lastUpdate >= intervalMs) {
        lastUpdate = now;
        const freqData = getFrequencyData();
        if (freqData && freqData.length > 0) {
          const bands = computeOctaveBands(freqData, sampleRate);
          
          // Update peak hold
          bands.forEach((b) => {
            const currentHold = peakHoldRef.current[b.centerHz];
            if (!currentHold || b.peakDb >= currentHold.db) {
              peakHoldRef.current[b.centerHz] = { db: b.peakDb, decayTime: now };
            } else if (now - currentHold.decayTime > 1500) {
              // Decay peak slowly after 1.5s
              peakHoldRef.current[b.centerHz].db = Math.max(b.peakDb, currentHold.db - 1.5);
            }
          });

          setOctaveData(bands);
        }
      }
      animId = requestAnimationFrame(loop);
    };

    animId = requestAnimationFrame(loop);
    return () => cancelAnimationFrame(animId);
  }, [getFrequencyData, rtaSpeed, sampleRate]);

  const resetRtaPeaks = () => {
    peakHoldRef.current = {};
    const freqData = getFrequencyData();
    if (freqData) {
      setOctaveData(computeOctaveBands(freqData, sampleRate));
    }
  };

  // Waveform options
  const waveforms: { id: SignalGeneratorWaveform; label: string; icon: string }[] = [
    { id: 'sine', label: 'Sine (Pure)', icon: '∿' },
    { id: 'triangle', label: 'Triangle (Warm)', icon: '▲' },
    { id: 'square', label: 'Square (Odd Harmonics)', icon: '⊓' },
    { id: 'sawtooth', label: 'Saw (Full Overtones)', icon: '◺' },
    { id: 'pink', label: 'Pink Noise (1/f)', icon: '≋' },
    { id: 'white', label: 'White Noise', icon: '░' },
    { id: 'sweep', label: 'Freq Sweep', icon: '➔' },
  ];

  // Frequency step adjustments
  const adjustFrequency = (deltaHz: number) => {
    const nextHz = Math.max(20, Math.min(20000, signalGenState.frequency + deltaHz));
    updateSignalGen({ frequency: Math.round(nextHz) });
  };

  const multiplyFrequency = (factor: number) => {
    const nextHz = Math.max(20, Math.min(20000, signalGenState.frequency * factor));
    updateSignalGen({ frequency: Math.round(nextHz) });
  };

  const currentGenNote = useMemo(() => {
    return frequencyToNote(signalGenState.frequency);
  }, [signalGenState.frequency]);

  const currentIsolatorNote = useMemo(() => {
    return frequencyToNote(isolatorState.frequency);
  }, [isolatorState.frequency]);

  // Extract top 5 prominent frequency peaks from FFT data
  const topPeaks = useMemo(() => {
    const freqData = getFrequencyData();
    if (!freqData || freqData.length === 0) return [];

    const nyquist = 22050;
    const binCount = freqData.length;
    const hzPerBin = nyquist / binCount;

    const peaks: { hz: number; bin: number; val: number; note: string; db: number }[] = [];

    for (let i = 2; i < binCount - 2; i++) {
      const val = freqData[i];
      if (val > 35 && val >= freqData[i - 1] && val >= freqData[i + 1] && val > freqData[i - 2] && val > freqData[i + 2]) {
        const hz = Math.round(i * hzPerBin);
        const note = frequencyToNote(hz).formatted;
        // Map 0-255 to dBFS approx (-90 to -10)
        const db = Math.round(-90 + (val / 255) * 80);
        peaks.push({ hz, bin: i, val, note, db });
      }
    }

    // Sort descending by magnitude and take top 5
    peaks.sort((a, b) => b.val - a.val);
    return peaks.slice(0, 5);
  }, [getFrequencyData, metrics.peakFrequencyHz]);

  return (
    <div className="bg-slate-900/90 rounded-2xl border border-slate-800 p-4 sm:p-6 shadow-xl flex flex-col gap-6">
      {/* Top Header & Sub-Tab Bar */}
      <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4 pb-4 border-b border-slate-800">
        <div className="flex items-center gap-3">
          <div className="p-2.5 bg-gradient-to-br from-cyan-500/20 to-blue-600/20 rounded-xl border border-cyan-500/40 text-cyan-300 shadow-[0_0_15px_rgba(6,182,212,0.2)]">
            <Radio className="w-5 h-5 animate-pulse" />
          </div>
          <div>
            <div className="flex items-center gap-2">
              <h2 className="text-base sm:text-lg font-bold text-white tracking-tight">
                PRECISION FREQUENCY WORKBENCH
              </h2>
              <span className="text-[10px] font-mono px-2 py-0.5 rounded-full bg-cyan-500/20 text-cyan-300 border border-cyan-500/40">
                PRO SUITE
              </span>
            </div>
            <p className="text-xs text-slate-400">
              Reference Test Tones, 1/3-Octave ISO RTA, Bandpass Audition Isolator & Peak Tracker
            </p>
          </div>
        </div>

        {/* Sub-Tab Navigation */}
        <div className="flex items-center gap-1 bg-slate-950 p-1 rounded-xl border border-slate-800 self-stretch sm:self-auto overflow-x-auto">
          <button
            onClick={() => setActiveSubTab('generator')}
            id="subtab-signal-generator"
            className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-semibold transition-all cursor-pointer whitespace-nowrap ${
              activeSubTab === 'generator'
                ? 'bg-cyan-500 text-slate-950 shadow-md'
                : 'text-slate-400 hover:text-white hover:bg-slate-800'
            }`}
          >
            <Activity className="w-3.5 h-3.5" />
            Signal Generator
            {signalGenState.isActive && (
              <span className="w-2 h-2 rounded-full bg-emerald-400 animate-ping ml-0.5" />
            )}
          </button>

          <button
            onClick={() => setActiveSubTab('rta')}
            id="subtab-1-3-octave-rta"
            className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-semibold transition-all cursor-pointer whitespace-nowrap ${
              activeSubTab === 'rta'
                ? 'bg-cyan-500 text-slate-950 shadow-md'
                : 'text-slate-400 hover:text-white hover:bg-slate-800'
            }`}
          >
            <Sliders className="w-3.5 h-3.5" />
            1/3-Octave RTA
          </button>

          <button
            onClick={() => setActiveSubTab('isolator')}
            id="subtab-frequency-isolator"
            className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-semibold transition-all cursor-pointer whitespace-nowrap ${
              activeSubTab === 'isolator'
                ? 'bg-cyan-500 text-slate-950 shadow-md'
                : 'text-slate-400 hover:text-white hover:bg-slate-800'
            }`}
          >
            <Filter className="w-3.5 h-3.5" />
            Band Isolator
            {isolatorState.enabled && (
              <span className="w-2 h-2 rounded-full bg-amber-400 animate-pulse ml-0.5" />
            )}
          </button>

          <button
            onClick={() => setActiveSubTab('peaks')}
            id="subtab-peak-harmonics"
            className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-semibold transition-all cursor-pointer whitespace-nowrap ${
              activeSubTab === 'peaks'
                ? 'bg-cyan-500 text-slate-950 shadow-md'
                : 'text-slate-400 hover:text-white hover:bg-slate-800'
            }`}
          >
            <Zap className="w-3.5 h-3.5" />
            Peak Tracker
          </button>
        </div>
      </div>

      {/* ===================================================================== */}
      {/* 1. SIGNAL GENERATOR & FREQUENCY SWEEPER */}
      {/* ===================================================================== */}
      {activeSubTab === 'generator' && (
        <div className="flex flex-col gap-5 animate-fadeIn">
          {/* Main Controls Card */}
          <div className="bg-slate-950/80 rounded-xl p-4 sm:p-5 border border-slate-800/80 flex flex-col gap-4">
            <div className="flex flex-col md:flex-row items-start md:items-center justify-between gap-4">
              {/* Primary On/Off & Level Transport */}
              <div className="flex items-center gap-3 flex-wrap">
                <button
                  onClick={() => {
                    if (signalGenState.isActive) {
                      stopSignalGen();
                    } else {
                      startSignalGen();
                    }
                  }}
                  id="btn-signal-gen-toggle"
                  className={`flex items-center gap-2 px-5 py-2.5 rounded-xl font-bold text-sm transition-all cursor-pointer shadow-lg ${
                    signalGenState.isActive
                      ? 'bg-rose-500 hover:bg-rose-600 text-white shadow-rose-500/30'
                      : 'bg-emerald-500 hover:bg-emerald-600 text-slate-950 shadow-emerald-500/30'
                  }`}
                >
                  {signalGenState.isActive ? (
                    <>
                      <Square className="w-4 h-4 fill-current" />
                      Stop Test Signal
                    </>
                  ) : (
                    <>
                      <Play className="w-4 h-4 fill-current" />
                      Generate Test Tone
                    </>
                  )}
                </button>

                {/* Generator Volume & Mute */}
                <div className="flex items-center gap-2 bg-slate-900 px-3 py-2 rounded-xl border border-slate-800">
                  <button
                    onClick={() => updateSignalGen({ isMuted: !signalGenState.isMuted })}
                    id="btn-signal-gen-mute"
                    className="text-slate-400 hover:text-cyan-300 transition-colors cursor-pointer"
                    title="Mute Signal Generator"
                  >
                    {signalGenState.isMuted ? (
                      <VolumeX className="w-4 h-4 text-rose-400" />
                    ) : (
                      <Volume2 className="w-4 h-4 text-cyan-400" />
                    )}
                  </button>
                  <input
                    type="range"
                    min="0"
                    max="1"
                    step="0.01"
                    value={signalGenState.volume}
                    onChange={(e) => updateSignalGen({ volume: parseFloat(e.target.value) })}
                    id="slider-signal-gen-volume"
                    className="w-24 sm:w-28 accent-cyan-400 h-1.5 bg-slate-800 rounded-lg cursor-pointer"
                    title="Test Tone Output Level"
                  />
                  <span className="text-[11px] font-mono text-slate-400 w-9 text-right">
                    {Math.round(signalGenState.volume * 100)}%
                  </span>
                </div>
              </div>

              {/* Readout Display */}
              <div className="flex items-center gap-3 bg-slate-900/90 px-4 py-2 rounded-xl border border-cyan-500/30 shadow-[0_0_12px_rgba(6,182,212,0.15)]">
                <div>
                  <div className="text-[10px] font-mono text-slate-400 uppercase tracking-wider">
                    {signalGenState.isSweeping ? 'Sweeping Frequency' : 'Target Frequency'}
                  </div>
                  <div className="text-xl sm:text-2xl font-black font-mono text-cyan-300">
                    {formatFrequency(signalGenState.frequency)}
                  </div>
                </div>
                <div className="border-l border-slate-800 pl-3">
                  <div className="text-[10px] font-mono text-slate-400 uppercase tracking-wider">
                    Chromatic Pitch
                  </div>
                  <div className="text-sm font-bold font-mono text-amber-300">
                    {currentGenNote.formatted}
                  </div>
                </div>
              </div>
            </div>

            {/* Waveform Selector Chips */}
            <div className="flex flex-col gap-2 pt-2 border-t border-slate-800/60">
              <label className="text-xs font-semibold text-slate-300">Waveform & Test Signal Type:</label>
              <div className="grid grid-cols-2 sm:grid-cols-4 lg:grid-cols-7 gap-2">
                {waveforms.map((w) => {
                  const isSelected = signalGenState.waveform === w.id;
                  return (
                    <button
                      key={w.id}
                      onClick={() => {
                        updateSignalGen({ waveform: w.id });
                        if (!signalGenState.isActive) {
                          startSignalGen({ waveform: w.id });
                        }
                      }}
                      id={`btn-waveform-${w.id}`}
                      className={`flex flex-col items-center justify-center p-2.5 rounded-xl border text-xs font-semibold transition-all cursor-pointer ${
                        isSelected
                          ? 'bg-cyan-500/20 border-cyan-400 text-cyan-200 shadow-[0_0_10px_rgba(6,182,212,0.3)]'
                          : 'bg-slate-900 border-slate-800 text-slate-400 hover:text-white hover:bg-slate-800/80'
                      }`}
                    >
                      <span className="text-base mb-0.5">{w.icon}</span>
                      <span>{w.label}</span>
                    </button>
                  );
                })}
              </div>
            </div>

            {/* Frequency Slider & Step Controls (For non-noise modes) */}
            {signalGenState.waveform !== 'pink' && signalGenState.waveform !== 'white' && (
              <div className="flex flex-col gap-3 pt-2 border-t border-slate-800/60">
                <div className="flex items-center justify-between">
                  <label className="text-xs font-semibold text-slate-300 flex items-center gap-1.5">
                    <span>Frequency Tuning (Logarithmic):</span>
                    <span className="text-slate-400 font-mono font-normal">20 Hz to 20,000 Hz</span>
                  </label>
                  <div className="flex items-center gap-1">
                    <input
                      type="number"
                      min="20"
                      max="20000"
                      value={signalGenState.frequency}
                      onChange={(e) => {
                        const val = parseInt(e.target.value, 10);
                        if (!isNaN(val)) {
                          updateSignalGen({ frequency: Math.max(20, Math.min(20000, val)) });
                        }
                      }}
                      id="input-signal-gen-direct-hz"
                      className="w-20 bg-slate-900 border border-slate-700 rounded-lg px-2 py-1 text-xs font-mono text-cyan-300 text-right focus:outline-none focus:border-cyan-400"
                    />
                    <span className="text-xs font-mono text-slate-400">Hz</span>
                  </div>
                </div>

                {/* Logarithmic Slider */}
                <input
                  type="range"
                  min="0"
                  max="1000"
                  step="1"
                  value={Math.round(
                    (Math.log10(signalGenState.frequency / 20) / Math.log10(20000 / 20)) * 1000
                  )}
                  onChange={(e) => {
                    const pos = parseFloat(e.target.value) / 1000;
                    const hz = 20 * Math.pow(20000 / 20, pos);
                    updateSignalGen({ frequency: Math.round(hz) });
                  }}
                  id="slider-signal-gen-log-hz"
                  className="w-full accent-cyan-400 h-2 bg-slate-800 rounded-lg cursor-pointer"
                />

                {/* Step & Octave Multiplier Buttons */}
                <div className="flex items-center justify-between flex-wrap gap-2 pt-1">
                  <div className="flex items-center gap-1">
                    <span className="text-[10px] font-mono text-slate-400 mr-1">Steps:</span>
                    <button
                      onClick={() => adjustFrequency(-100)}
                      id="btn-step-minus-100hz"
                      className="px-2 py-1 bg-slate-900 hover:bg-slate-800 border border-slate-800 rounded text-[11px] font-mono text-slate-300 cursor-pointer"
                    >
                      -100Hz
                    </button>
                    <button
                      onClick={() => adjustFrequency(-10)}
                      id="btn-step-minus-10hz"
                      className="px-2 py-1 bg-slate-900 hover:bg-slate-800 border border-slate-800 rounded text-[11px] font-mono text-slate-300 cursor-pointer"
                    >
                      -10Hz
                    </button>
                    <button
                      onClick={() => adjustFrequency(-1)}
                      id="btn-step-minus-1hz"
                      className="px-2 py-1 bg-slate-900 hover:bg-slate-800 border border-slate-800 rounded text-[11px] font-mono text-slate-300 cursor-pointer"
                    >
                      -1Hz
                    </button>
                    <button
                      onClick={() => adjustFrequency(1)}
                      id="btn-step-plus-1hz"
                      className="px-2 py-1 bg-slate-900 hover:bg-slate-800 border border-slate-800 rounded text-[11px] font-mono text-slate-300 cursor-pointer"
                    >
                      +1Hz
                    </button>
                    <button
                      onClick={() => adjustFrequency(10)}
                      id="btn-step-plus-10hz"
                      className="px-2 py-1 bg-slate-900 hover:bg-slate-800 border border-slate-800 rounded text-[11px] font-mono text-slate-300 cursor-pointer"
                    >
                      +10Hz
                    </button>
                    <button
                      onClick={() => adjustFrequency(100)}
                      id="btn-step-plus-100hz"
                      className="px-2 py-1 bg-slate-900 hover:bg-slate-800 border border-slate-800 rounded text-[11px] font-mono text-slate-300 cursor-pointer"
                    >
                      +100Hz
                    </button>
                  </div>

                  {/* Octave Halving / Doubling */}
                  <div className="flex items-center gap-1">
                    <span className="text-[10px] font-mono text-slate-400 mr-1">Octave:</span>
                    <button
                      onClick={() => multiplyFrequency(0.5)}
                      id="btn-octave-down"
                      className="px-2.5 py-1 bg-slate-900 hover:bg-cyan-950/60 border border-slate-700 hover:border-cyan-500/50 rounded text-[11px] font-mono text-cyan-300 cursor-pointer font-bold"
                    >
                      ÷ 2 (Octave Down)
                    </button>
                    <button
                      onClick={() => multiplyFrequency(2)}
                      id="btn-octave-up"
                      className="px-2.5 py-1 bg-slate-900 hover:bg-cyan-950/60 border border-slate-700 hover:border-cyan-500/50 rounded text-[11px] font-mono text-cyan-300 cursor-pointer font-bold"
                    >
                      × 2 (Octave Up)
                    </button>
                  </div>
                </div>
              </div>
            )}

            {/* Sweep Configuration Mode (If sweep selected) */}
            {signalGenState.waveform === 'sweep' && (
              <div className="bg-slate-900/90 rounded-xl p-4 border border-cyan-500/30 flex flex-col gap-3">
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-2">
                    <Zap className="w-4 h-4 text-cyan-400" />
                    <span className="text-xs font-bold text-cyan-200">Logarithmic Frequency Sweep Parameters</span>
                  </div>
                  <div className="flex items-center gap-2">
                    <label className="text-xs text-slate-400 flex items-center gap-1.5 cursor-pointer">
                      <input
                        type="checkbox"
                        checked={signalGenState.sweepLoop}
                        onChange={(e) => updateSignalGen({ sweepLoop: e.target.checked })}
                        className="rounded accent-cyan-400"
                        id="checkbox-sweep-loop"
                      />
                      <span>Loop Continuously</span>
                    </label>
                  </div>
                </div>

                <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
                  <div>
                    <label className="text-[11px] text-slate-400">Start Frequency:</label>
                    <div className="flex items-center gap-1 mt-1">
                      <input
                        type="number"
                        value={signalGenState.sweepStartHz}
                        onChange={(e) => updateSignalGen({ sweepStartHz: parseInt(e.target.value, 10) || 20 })}
                        id="input-sweep-start-hz"
                        className="w-full bg-slate-950 border border-slate-700 rounded-lg px-2.5 py-1.5 text-xs font-mono text-white"
                      />
                      <span className="text-xs text-slate-400">Hz</span>
                    </div>
                  </div>

                  <div>
                    <label className="text-[11px] text-slate-400">End Frequency:</label>
                    <div className="flex items-center gap-1 mt-1">
                      <input
                        type="number"
                        value={signalGenState.sweepEndHz}
                        onChange={(e) => updateSignalGen({ sweepEndHz: parseInt(e.target.value, 10) || 20000 })}
                        id="input-sweep-end-hz"
                        className="w-full bg-slate-950 border border-slate-700 rounded-lg px-2.5 py-1.5 text-xs font-mono text-white"
                      />
                      <span className="text-xs text-slate-400">Hz</span>
                    </div>
                  </div>

                  <div>
                    <label className="text-[11px] text-slate-400">Sweep Duration:</label>
                    <select
                      value={signalGenState.sweepDurationSec}
                      onChange={(e) => updateSignalGen({ sweepDurationSec: parseFloat(e.target.value) })}
                      id="select-sweep-duration"
                      className="w-full bg-slate-950 border border-slate-700 rounded-lg px-2.5 py-1.5 text-xs font-mono text-white mt-1"
                    >
                      <option value="2">2 Seconds (Quick)</option>
                      <option value="5">5 Seconds (Standard Room Check)</option>
                      <option value="10">10 Seconds (High Precision)</option>
                      <option value="20">20 Seconds (Ultra High Resolution)</option>
                    </select>
                  </div>
                </div>

                {/* Sweep Progress Bar */}
                <div className="flex flex-col gap-1 mt-1">
                  <div className="flex items-center justify-between text-[11px] font-mono">
                    <span className="text-slate-400">Sweep Progress:</span>
                    <span className="text-cyan-300 font-bold">{Math.round(signalGenState.sweepProgress * 100)}%</span>
                  </div>
                  <div className="w-full h-2 bg-slate-950 rounded-full overflow-hidden border border-slate-800">
                    <div
                      className="h-full bg-gradient-to-r from-cyan-500 via-blue-500 to-fuchsia-500 transition-all duration-75"
                      style={{ width: `${Math.round(signalGenState.sweepProgress * 100)}%` }}
                    />
                  </div>
                </div>
              </div>
            )}
          </div>

          {/* Quick Acoustic Calibration Presets Grid */}
          <div className="flex flex-col gap-2.5">
            <div className="flex items-center justify-between">
              <span className="text-xs font-bold text-slate-300 uppercase tracking-wider flex items-center gap-1.5">
                <Flame className="w-3.5 h-3.5 text-amber-400" />
                Industry Calibration & Diagnostic Presets
              </span>
              <span className="text-[11px] text-slate-400 font-mono">Click to test instantly</span>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-2.5">
              {CALIBRATION_PRESETS.map((preset) => {
                const isSelected = 
                  signalGenState.waveform === preset.waveform && 
                  Math.abs(signalGenState.frequency - preset.freqHz) < 1;

                return (
                  <button
                    key={preset.id}
                    onClick={() => {
                      updateSignalGen({
                        waveform: preset.waveform,
                        frequency: preset.freqHz,
                      });
                      startSignalGen({
                        waveform: preset.waveform,
                        frequency: preset.freqHz,
                      });
                    }}
                    id={`btn-preset-${preset.id}`}
                    className={`flex flex-col text-left p-3 rounded-xl border transition-all cursor-pointer ${
                      isSelected
                        ? 'bg-cyan-500/20 border-cyan-400 shadow-[0_0_12px_rgba(6,182,212,0.25)] ring-1 ring-cyan-400/40'
                        : 'bg-slate-950/70 border-slate-800 hover:border-slate-700 hover:bg-slate-900'
                    }`}
                  >
                    <div className="flex items-center justify-between mb-1">
                      <span className="text-xs font-bold text-white group-hover:text-cyan-300">
                        {preset.name}
                      </span>
                      <span className="text-[10px] font-mono px-1.5 py-0.5 rounded bg-slate-900 border border-slate-800 text-cyan-400">
                        {preset.waveform === 'pink' ? 'Pink Noise' : preset.waveform === 'white' ? 'White Noise' : `${preset.freqHz} Hz`}
                      </span>
                    </div>
                    <p className="text-[11px] text-slate-400 leading-snug">
                      {preset.description}
                    </p>
                  </button>
                );
              })}
            </div>
          </div>
        </div>
      )}

      {/* ===================================================================== */}
      {/* 2. ISO 1/3-OCTAVE ACOUSTIC REAL-TIME ANALYZER (RTA) */}
      {/* ===================================================================== */}
      {activeSubTab === 'rta' && (
        <div className="flex flex-col gap-4 animate-fadeIn">
          {/* Controls Bar */}
          <div className="flex flex-wrap items-center justify-between gap-3 bg-slate-950/80 p-3 rounded-xl border border-slate-800">
            <div className="flex items-center gap-3">
              <span className="text-xs font-bold text-slate-300">ISO 266 Standard 31 Bands (20Hz - 20kHz)</span>
              <div className="flex items-center gap-1 bg-slate-900 p-1 rounded-lg border border-slate-800 text-xs">
                <button
                  onClick={() => setRtaSpeed('fast')}
                  id="btn-rta-fast"
                  className={`px-2.5 py-1 rounded font-mono text-[11px] cursor-pointer ${
                    rtaSpeed === 'fast' ? 'bg-cyan-500 text-slate-950 font-bold' : 'text-slate-400 hover:text-white'
                  }`}
                >
                  Fast (40ms)
                </button>
                <button
                  onClick={() => setRtaSpeed('slow')}
                  id="btn-rta-slow"
                  className={`px-2.5 py-1 rounded font-mono text-[11px] cursor-pointer ${
                    rtaSpeed === 'slow' ? 'bg-cyan-500 text-slate-950 font-bold' : 'text-slate-400 hover:text-white'
                  }`}
                >
                  Slow (120ms)
                </button>
              </div>
            </div>

            <button
              onClick={resetRtaPeaks}
              id="btn-reset-rta-peaks"
              className="flex items-center gap-1.5 px-3 py-1 bg-slate-900 hover:bg-slate-800 border border-slate-800 rounded-lg text-xs font-semibold text-slate-300 cursor-pointer"
            >
              <RefreshCw className="w-3.5 h-3.5 text-cyan-400" />
              Reset Peak Hold
            </button>
          </div>

          {/* 31-Band Bar Chart Display */}
          <div className="bg-slate-950 rounded-xl p-4 border border-slate-800 flex flex-col gap-2">
            {/* Hover Telemetry */}
            <div className="h-6 flex items-center justify-between text-xs font-mono text-slate-400">
              {hoveredBand !== null ? (
                <div className="flex items-center gap-2 text-cyan-300">
                  <span className="font-bold">Band Center: {hoveredBand < 1000 ? `${hoveredBand} Hz` : `${hoveredBand / 1000} kHz`}</span>
                  <span>|</span>
                  <span>RMS: {octaveData.find((b) => b.centerHz === hoveredBand)?.rmsDb} dBFS</span>
                  <span>|</span>
                  <span>Peak Hold: {octaveData.find((b) => b.centerHz === hoveredBand)?.peakDb} dBFS</span>
                </div>
              ) : (
                <span className="text-[11px] text-slate-500">Hover over any 1/3-octave band to view exact dBFS and peak telemetry</span>
              )}

              <div className="flex items-center gap-3 text-[11px]">
                <div className="flex items-center gap-1">
                  <span className="w-2.5 h-2.5 bg-cyan-400 rounded-xs" />
                  <span>RMS Level</span>
                </div>
                <div className="flex items-center gap-1">
                  <span className="w-2.5 h-0.5 bg-amber-400" />
                  <span>Peak Hold</span>
                </div>
              </div>
            </div>

            {/* Bars Area */}
            <div className="h-60 flex items-end justify-between gap-1 pt-4 pb-2 border-b border-slate-800/80">
              {octaveData.map((b) => {
                const heldPeak = peakHoldRef.current[b.centerHz]?.db ?? b.peakDb;
                // Map dBFS (-90 to -10) to 0 - 100% height
                const rmsHeight = Math.max(4, Math.min(100, ((b.rmsDb + 90) / 80) * 100));
                const peakHeight = Math.max(4, Math.min(100, ((heldPeak + 90) / 80) * 100));

                return (
                  <div
                    key={b.centerHz}
                    onMouseEnter={() => setHoveredBand(b.centerHz)}
                    onMouseLeave={() => setHoveredBand(null)}
                    className="flex-1 h-full flex flex-col justify-end items-center relative group cursor-pointer"
                  >
                    {/* Peak Hold Marker line */}
                    <div
                      className="absolute w-full h-0.5 bg-amber-400 rounded-full z-10 transition-all duration-150"
                      style={{ bottom: `${peakHeight}%` }}
                    />

                    {/* RMS Bar */}
                    <div
                      className={`w-full rounded-t transition-all duration-100 ${
                        b.isDominant
                          ? 'bg-gradient-to-t from-cyan-600 via-cyan-400 to-amber-300 shadow-[0_0_10px_rgba(6,182,212,0.6)]'
                          : 'bg-gradient-to-t from-blue-600/80 via-cyan-500/90 to-cyan-300'
                      }`}
                      style={{ height: `${rmsHeight}%` }}
                    />
                  </div>
                );
              })}
            </div>

            {/* Frequency Labels */}
            <div className="flex items-center justify-between gap-1 pt-1 overflow-x-hidden">
              {octaveData.map((b) => (
                <span
                  key={b.centerHz}
                  className={`flex-1 text-center font-mono text-[9px] truncate ${
                    b.isDominant ? 'text-cyan-300 font-bold' : 'text-slate-500'
                  }`}
                >
                  {b.label}
                </span>
              ))}
            </div>
          </div>
        </div>
      )}

      {/* ===================================================================== */}
      {/* 3. REAL-TIME FREQUENCY BANDPASS & SURGICAL NOTCH ISOLATOR */}
      {/* ===================================================================== */}
      {activeSubTab === 'isolator' && (
        <div className="flex flex-col gap-4 animate-fadeIn">
          <div className="bg-slate-950/80 rounded-xl p-4 sm:p-5 border border-slate-800 flex flex-col gap-4">
            {/* Top Toggle & Status */}
            <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3 pb-3 border-b border-slate-800">
              <div className="flex items-center gap-3">
                <button
                  onClick={() => updateIsolator({ enabled: !isolatorState.enabled })}
                  id="btn-toggle-isolator"
                  className={`flex items-center gap-2 px-4 py-2 rounded-xl font-bold text-xs sm:text-sm cursor-pointer transition-all ${
                    isolatorState.enabled
                      ? 'bg-amber-500 hover:bg-amber-600 text-slate-950 shadow-lg shadow-amber-500/20'
                      : 'bg-slate-800 hover:bg-slate-700 text-slate-300'
                  }`}
                >
                  <Filter className="w-4 h-4" />
                  {isolatorState.enabled ? 'Filter Active (Listening)' : 'Filter Bypassed (Click to Enable)'}
                </button>

                <span className="text-xs font-mono text-slate-400">
                  {isolatorState.enabled ? 'Audio routed through surgical DSP filter' : 'Audio passing direct 100% unaltered'}
                </span>
              </div>

              {/* Target Readout */}
              <div className="bg-slate-900 px-3 py-1.5 rounded-lg border border-slate-800 font-mono text-xs flex items-center gap-2">
                <span className="text-slate-400">Center:</span>
                <span className="font-bold text-amber-300">{formatFrequency(isolatorState.frequency)}</span>
                <span className="text-slate-600">|</span>
                <span className="text-cyan-300 font-bold">{currentIsolatorNote.formatted}</span>
              </div>
            </div>

            {/* Filter Mode Selector */}
            <div className="flex flex-col gap-2">
              <label className="text-xs font-semibold text-slate-300">Filter Mode:</label>
              <div className="grid grid-cols-2 sm:grid-cols-4 gap-2">
                {[
                  { type: 'bandpass' as FrequencyIsolatorType, title: 'Band-Pass (Solo Band)', desc: 'Hear ONLY this frequency range (mutes everything else)' },
                  { type: 'notch' as FrequencyIsolatorType, title: 'Notch (Surgical Cut)', desc: 'Cut target frequency (-40dB) to remove hum or feedback' },
                  { type: 'highpass' as FrequencyIsolatorType, title: 'High-Pass (Low Cut)', desc: 'Attenuate rumble and bass below target Hz' },
                  { type: 'lowpass' as FrequencyIsolatorType, title: 'Low-Pass (High Cut)', desc: 'Attenuate treble and hiss above target Hz' },
                ].map((mode) => {
                  const isSelected = isolatorState.type === mode.type && isolatorState.enabled;
                  return (
                    <button
                      key={mode.type}
                      onClick={() => updateIsolator({ enabled: true, type: mode.type })}
                      id={`btn-isolator-mode-${mode.type}`}
                      className={`flex flex-col text-left p-3 rounded-xl border transition-all cursor-pointer ${
                        isSelected
                          ? 'bg-amber-500/15 border-amber-400/80 shadow-[0_0_12px_rgba(245,158,11,0.2)] text-amber-200'
                          : 'bg-slate-900 border-slate-800 text-slate-400 hover:text-white hover:bg-slate-800'
                      }`}
                    >
                      <span className="text-xs font-bold text-white mb-1">{mode.title}</span>
                      <span className="text-[11px] text-slate-400 leading-snug">{mode.desc}</span>
                    </button>
                  );
                })}
              </div>
            </div>

            {/* Sliders for Frequency and Q */}
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4 pt-2 border-t border-slate-800/60">
              {/* Frequency Slider */}
              <div className="flex flex-col gap-2">
                <div className="flex items-center justify-between text-xs">
                  <span className="font-semibold text-slate-300">Filter Center Frequency:</span>
                  <span className="font-mono text-amber-300 font-bold">{formatFrequency(isolatorState.frequency)}</span>
                </div>
                <input
                  type="range"
                  min="0"
                  max="1000"
                  step="1"
                  value={Math.round(
                    (Math.log10(isolatorState.frequency / 20) / Math.log10(20000 / 20)) * 1000
                  )}
                  onChange={(e) => {
                    const pos = parseFloat(e.target.value) / 1000;
                    const hz = 20 * Math.pow(20000 / 20, pos);
                    updateIsolator({ frequency: Math.round(hz) });
                  }}
                  id="slider-isolator-frequency"
                  className="w-full accent-amber-400 h-2 bg-slate-800 rounded-lg cursor-pointer"
                />
                <div className="flex items-center justify-between text-[10px] font-mono text-slate-500">
                  <span>20 Hz (Sub)</span>
                  <span>1 kHz (Mids)</span>
                  <span>20 kHz (Air)</span>
                </div>
              </div>

              {/* Q / Resonance Slider */}
              <div className="flex flex-col gap-2">
                <div className="flex items-center justify-between text-xs">
                  <span className="font-semibold text-slate-300">Q Bandwidth (Resonance Sharpness):</span>
                  <span className="font-mono text-cyan-300 font-bold">Q = {isolatorState.q.toFixed(1)}</span>
                </div>
                <input
                  type="range"
                  min="0.5"
                  max="20"
                  step="0.1"
                  value={isolatorState.q}
                  onChange={(e) => updateIsolator({ q: parseFloat(e.target.value) })}
                  id="slider-isolator-q"
                  className="w-full accent-cyan-400 h-2 bg-slate-800 rounded-lg cursor-pointer"
                />
                <div className="flex items-center justify-between text-[10px] font-mono text-slate-500">
                  <span>0.5 (Wide Band)</span>
                  <span>4.0 (Standard)</span>
                  <span>20.0 (Surgical Pinpoint)</span>
                </div>
              </div>
            </div>

            {/* Quick Filter Targets */}
            <div className="flex items-center gap-2 flex-wrap pt-2 border-t border-slate-800/60">
              <span className="text-[11px] font-mono text-slate-400">Quick Targets:</span>
              <button
                onClick={() => updateIsolator({ enabled: true, type: 'notch', frequency: 60, q: 12 })}
                id="btn-quick-notch-60hz"
                className="px-2.5 py-1 rounded bg-slate-900 hover:bg-slate-800 border border-slate-800 text-[11px] font-mono text-rose-300 cursor-pointer"
              >
                Notch 60Hz Ground Hum
              </button>
              <button
                onClick={() => updateIsolator({ enabled: true, type: 'highpass', frequency: 80, q: 0.7 })}
                id="btn-quick-hp-80hz"
                className="px-2.5 py-1 rounded bg-slate-900 hover:bg-slate-800 border border-slate-800 text-[11px] font-mono text-cyan-300 cursor-pointer"
              >
                80Hz Mic Rumble Cut
              </button>
              <button
                onClick={() => updateIsolator({ enabled: true, type: 'bandpass', frequency: 1000, q: 2.5 })}
                id="btn-quick-solo-vocal"
                className="px-2.5 py-1 rounded bg-slate-900 hover:bg-slate-800 border border-slate-800 text-[11px] font-mono text-amber-300 cursor-pointer"
              >
                Solo 1kHz Voice Band
              </button>
              <button
                onClick={() => updateIsolator({ enabled: true, type: 'notch', frequency: 4000, q: 10 })}
                id="btn-quick-notch-whistle"
                className="px-2.5 py-1 rounded bg-slate-900 hover:bg-slate-800 border border-slate-800 text-[11px] font-mono text-pink-300 cursor-pointer"
              >
                Notch 4kHz Feedback Whistle
              </button>
            </div>
          </div>
        </div>
      )}

      {/* ===================================================================== */}
      {/* 4. PROMINENT FREQUENCY PEAKS & HARMONIC SERIES TABLE */}
      {/* ===================================================================== */}
      {activeSubTab === 'peaks' && (
        <div className="flex flex-col gap-4 animate-fadeIn">
          <div className="bg-slate-950 rounded-xl p-4 border border-slate-800 flex flex-col gap-3">
            <div className="flex items-center justify-between">
              <span className="text-xs font-bold text-slate-300 uppercase tracking-wider">
                Top Detected Spectral Peaks & Harmonics
              </span>
              <span className="text-[11px] text-slate-400 font-mono">Real-time FFT Peak Analysis</span>
            </div>

            {topPeaks.length > 0 ? (
              <div className="overflow-x-auto">
                <table className="w-full text-left text-xs font-mono">
                  <thead>
                    <tr className="border-b border-slate-800 text-slate-500 text-[11px]">
                      <th className="py-2 px-3">Rank</th>
                      <th className="py-2 px-3">Frequency</th>
                      <th className="py-2 px-3">Musical Note</th>
                      <th className="py-2 px-3">Amplitude (dBFS)</th>
                      <th className="py-2 px-3">Harmonic Relation</th>
                      <th className="py-2 px-3 text-right">Action</th>
                    </tr>
                  </thead>
                  <tbody>
                    {topPeaks.map((peak, idx) => {
                      const fundamental = topPeaks[0].hz;
                      const ratio = peak.hz / fundamental;
                      let relation = 'Fundamental (F0)';
                      if (idx > 0) {
                        const harmonicOrder = Math.round(ratio);
                        if (Math.abs(ratio - harmonicOrder) < 0.08) {
                          relation = `${harmonicOrder}th Harmonic (${harmonicOrder}×F0)`;
                        } else {
                          relation = `Non-harmonic overtone (${ratio.toFixed(2)}×)`;
                        }
                      }

                      return (
                        <tr key={idx} className="border-b border-slate-800/50 hover:bg-slate-900/60">
                          <td className="py-2.5 px-3 font-bold text-slate-400">#{idx + 1}</td>
                          <td className="py-2.5 px-3 font-bold text-cyan-300">{formatFrequency(peak.hz)}</td>
                          <td className="py-2.5 px-3 text-amber-300">{peak.note}</td>
                          <td className="py-2.5 px-3 text-slate-200">{peak.db} dBFS</td>
                          <td className="py-2.5 px-3 text-slate-400">{relation}</td>
                          <td className="py-2.5 px-3 text-right">
                            <button
                              onClick={() => {
                                updateIsolator({ enabled: true, type: 'bandpass', frequency: peak.hz, q: 4.0 });
                                setActiveSubTab('isolator');
                              }}
                              id={`btn-isolate-peak-${idx}`}
                              className="px-2 py-0.5 rounded bg-cyan-950 hover:bg-cyan-900 text-cyan-300 text-[10px] border border-cyan-500/40 cursor-pointer"
                            >
                              Solo / Isolate
                            </button>
                          </td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>
            ) : (
              <div className="py-8 text-center text-slate-500 text-xs font-mono">
                No active prominent peaks detected above noise floor threshold. Start audio playback or speak into microphone.
              </div>
            )}
          </div>
        </div>
      )}
    </div>
  );
};
