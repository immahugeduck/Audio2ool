import React from 'react';
import { AudioMetrics, FrequencyWeighting } from '../types';
import { Activity, Gauge, Zap, Radio, CheckCircle2 } from 'lucide-react';

interface AudioMetersProps {
  metrics: AudioMetrics;
  weighting?: FrequencyWeighting;
  setWeighting?: (w: FrequencyWeighting) => void;
}

export const AudioMeters: React.FC<AudioMetersProps> = ({ 
  metrics, 
  weighting = 'Z', 
  setWeighting 
}) => {
  const bands = [
    { label: 'Sub-Bass (20-60Hz)', value: metrics.subBass, color: 'from-fuchsia-500 via-purple-500 to-indigo-500', glow: 'rgba(217,70,239,0.3)' },
    { label: 'Bass (60-250Hz)', value: metrics.bass, color: 'from-cyan-400 via-blue-500 to-indigo-600', glow: 'rgba(6,182,212,0.3)' },
    { label: 'Midrange (250-4kHz)', value: metrics.mid, color: 'from-emerald-400 via-teal-500 to-cyan-500', glow: 'rgba(52,211,153,0.3)' },
    { label: 'Treble (4k-20kHz)', value: metrics.treble, color: 'from-amber-400 via-orange-500 to-rose-500', glow: 'rgba(251,191,36,0.3)' },
  ];

  const currentWeighting = metrics.weighting || weighting;
  const weightingUnit = currentWeighting === 'A' ? 'dBA' : currentWeighting === 'C' ? 'dBC' : 'dBFS';

  return (
    <div className="bg-slate-900/95 rounded-2xl border border-cyan-500/20 p-4 sm:p-5 shadow-2xl backdrop-blur-md flex flex-col gap-4">
      <div className="flex items-center justify-between pb-3 border-b border-slate-800 flex-wrap gap-2">
        <div className="flex items-center gap-2">
          <div className="p-1.5 rounded-lg bg-cyan-500/10 border border-cyan-500/30 text-cyan-400">
            <Gauge className="w-4 h-4" />
          </div>
          <div>
            <h2 className="text-sm font-bold text-white tracking-wide">Multi-Band Energy & Precision VU Telemetry</h2>
            <p className="text-[11px] text-slate-400">32-bit float spectral integration & acoustic weighting standard</p>
          </div>
        </div>

        <div className="flex items-center gap-2 flex-wrap">
          {/* Weighting Selector (Z-Flat / A-Weighted / C-Weighted) */}
          {setWeighting && (
            <div className="flex items-center gap-1 bg-slate-950/90 p-1 rounded-xl border border-slate-800">
              <span className="text-[10px] font-mono text-slate-400 px-1.5 font-semibold">Weighting:</span>
              {(['Z', 'A', 'C'] as FrequencyWeighting[]).map((w) => (
                <button
                  key={w}
                  onClick={() => setWeighting(w)}
                  id={`btn-weighting-${w.toLowerCase()}`}
                  className={`px-2 py-0.5 rounded-lg text-[10px] font-mono font-bold transition-all cursor-pointer ${
                    currentWeighting === w
                      ? 'bg-cyan-500 text-slate-950 shadow-sm'
                      : 'text-slate-400 hover:text-white hover:bg-slate-850'
                  }`}
                  title={
                    w === 'Z'
                      ? 'Z-Weighting (Flat / Linear unweighted 20Hz-20kHz)'
                      : w === 'A'
                      ? 'A-Weighting (dBA - Human ear Fletcher-Munson equal-loudness sensitivity)'
                      : 'C-Weighting (dBC - Standard for high-SPL bass & mechanical acoustic noise)'
                  }
                >
                  {w === 'Z' ? 'Z (Flat)' : w === 'A' ? 'A (dBA)' : 'C (dBC)'}
                </button>
              ))}
            </div>
          )}

          {/* Peak Frequency Note Badge (Fixed-width tabular layout) */}
          <div className="flex items-center gap-2 bg-slate-950/90 px-3 py-1.5 rounded-xl border border-cyan-500/30 shadow-[0_0_10px_rgba(6,182,212,0.1)] whitespace-nowrap shrink-0">
            <Zap className="w-3.5 h-3.5 text-amber-400 animate-pulse shrink-0" />
            <span className="text-xs text-slate-400 font-medium">Prominent:</span>
            <span className="text-xs font-mono tabular-nums font-black text-cyan-300 drop-shadow-[0_0_6px_rgba(6,182,212,0.5)] w-[142px] text-right">
              {metrics.peakFrequencyHz > 16 ? `${metrics.peakFrequencyFormatted} (${metrics.peakNoteName})` : '0.0 Hz (---)'}
            </span>
          </div>
        </div>
      </div>

      {/* 4-Band VU Energy Meters */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3">
        {bands.map((band) => (
          <div key={band.label} className="flex flex-col gap-1.5 bg-slate-950/90 p-3 rounded-xl border border-slate-800/90 shadow-inner">
            <div className="flex justify-between items-center text-xs">
              <span className="text-slate-300 font-semibold truncate text-[11px]">{band.label}</span>
              <span className="font-mono text-cyan-300 font-bold text-xs">{band.value}%</span>
            </div>

            {/* VU Meter Bar */}
            <div className="w-full h-3 bg-slate-900 rounded-md overflow-hidden p-0.5 border border-slate-800">
              <div
                className={`h-full rounded-sm bg-gradient-to-r ${band.color} transition-all duration-75 shadow-sm`}
                style={{ width: `${Math.min(100, Math.max(0, band.value))}%` }}
              />
            </div>
          </div>
        ))}
      </div>

      {/* Master RMS, Transient Peak & Distortion Meters */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
        {/* Master RMS dB */}
        <div className="flex flex-col gap-1.5 bg-slate-950/90 p-3 rounded-xl border border-slate-800/90 shadow-inner">
          <div className="flex justify-between items-center text-xs">
            <div className="flex items-center gap-1.5 text-slate-300 font-semibold">
              <Activity className="w-3.5 h-3.5 text-emerald-400" />
              Master RMS ({weightingUnit})
            </div>
            <span className="font-mono font-bold text-emerald-400">
              {metrics.rmsDb} {weightingUnit}
            </span>
          </div>

          <div className="w-full h-3 bg-slate-900 rounded-md overflow-hidden p-0.5 border border-slate-800 flex items-center">
            <div
              className={`h-full rounded-sm transition-all duration-75 ${
                metrics.rmsDb > -6
                  ? 'bg-rose-500 shadow-[0_0_8px_rgba(244,63,94,0.6)]'
                  : metrics.rmsDb > -18
                  ? 'bg-amber-400 shadow-[0_0_8px_rgba(251,191,36,0.6)]'
                  : 'bg-emerald-400 shadow-[0_0_8px_rgba(52,211,153,0.6)]'
              }`}
              style={{ width: `${Math.min(100, Math.max(0, (metrics.rmsDb + 100)))}%` }}
            />
          </div>

          <div className="flex items-center justify-between text-[10px] font-mono text-slate-500 pt-0.5">
            <span>A: {metrics.rmsDba} dBA</span>
            <span>C: {metrics.rmsDbc} dBC</span>
          </div>
        </div>

        {/* Peak dB */}
        <div className="flex flex-col gap-1.5 bg-slate-950/90 p-3 rounded-xl border border-slate-800/90 shadow-inner">
          <div className="flex justify-between items-center text-xs">
            <div className="flex items-center gap-1.5 text-slate-300 font-semibold">
              <Zap className="w-3.5 h-3.5 text-amber-400" />
              Instantaneous Peak dB
            </div>
            <span className="font-mono font-bold text-amber-300">{metrics.peakDb} dBFS</span>
          </div>

          <div className="w-full h-3 bg-slate-900 rounded-md overflow-hidden p-0.5 border border-slate-800 flex items-center">
            <div
              className={`h-full rounded-sm transition-all duration-75 ${
                metrics.peakDb > -3
                  ? 'bg-rose-500 shadow-[0_0_8px_rgba(244,63,94,0.6)]'
                  : metrics.peakDb > -12
                  ? 'bg-amber-400 shadow-[0_0_8px_rgba(251,191,36,0.6)]'
                  : 'bg-cyan-400 shadow-[0_0_8px_rgba(6,182,212,0.6)]'
              }`}
              style={{ width: `${Math.min(100, Math.max(0, (metrics.peakDb + 100)))}%` }}
            />
          </div>
        </div>

        {/* Crest Factor (Transient Punch) */}
        <div className="flex flex-col gap-1.5 bg-slate-950/90 p-3 rounded-xl border border-slate-800/90 shadow-inner">
          <div className="flex justify-between items-center text-xs">
            <div className="flex items-center gap-1.5 text-slate-300 font-semibold">
              <Gauge className="w-3.5 h-3.5 text-cyan-400" />
              Crest Factor (Punch)
            </div>
            <span className="font-mono font-bold text-cyan-300">+{metrics.crestFactorDb} dB</span>
          </div>

          <div className="w-full h-3 bg-slate-900 rounded-md overflow-hidden p-0.5 border border-slate-800 flex items-center">
            <div
              className={`h-full rounded-sm bg-gradient-to-r from-cyan-400 via-blue-500 to-indigo-500 transition-all duration-75 shadow-[0_0_8px_rgba(6,182,212,0.4)]`}
              style={{ width: `${Math.min(100, (metrics.crestFactorDb / 30) * 100)}%` }}
            />
          </div>
        </div>
      </div>

      {/* Live THD & Distortion Telemetry Banner (Always rendered at fixed height to prevent layout shifts) */}
      <div className="bg-slate-950/90 border border-amber-500/25 rounded-xl px-3 py-2.5 flex flex-wrap items-center justify-between gap-2 text-xs min-h-[42px]">
        <div className="flex items-center gap-2 whitespace-nowrap">
          <span className="px-1.5 py-0.5 rounded bg-amber-500/20 text-amber-300 font-bold text-[10px] border border-amber-500/30 shrink-0">
            THD ANALYZER
          </span>
          {metrics.distortion && metrics.distortion.isToneDetected ? (
            <span className="text-slate-300 font-mono tabular-nums">
              Carrier: <strong className="text-cyan-300">{metrics.distortion.fundamentalFormatted}</strong> ({metrics.distortion.fundamentalNote}) @ {metrics.distortion.fundamentalDb} dBFS
            </span>
          ) : (
            <span className="text-slate-500 font-mono text-[11px]">
              Standby — Waiting for sustained fundamental carrier tone (&gt; -65 dBFS)...
            </span>
          )}
        </div>
        <div className="flex items-center gap-3 font-mono tabular-nums text-xs flex-wrap">
          <span className="text-slate-400">
            THD:{' '}
            <strong
              className={
                metrics.distortion && metrics.distortion.isToneDetected
                  ? metrics.distortion.thdPercent < 0.1
                    ? 'text-emerald-400'
                    : metrics.distortion.thdPercent < 1.0
                    ? 'text-amber-400'
                    : 'text-rose-400'
                  : 'text-slate-500'
              }
            >
              {metrics.distortion && metrics.distortion.isToneDetected
                ? `${metrics.distortion.thdPercent}% (${metrics.distortion.thdDb} dB)`
                : '0.000% (-100 dB)'}
            </strong>
          </span>
          <span className="text-slate-700">|</span>
          <span className="text-slate-400">
            THD+N:{' '}
            <strong className="text-slate-200">
              {metrics.distortion && metrics.distortion.isToneDetected ? `${metrics.distortion.thdPlusNDb} dB` : '-100 dB'}
            </strong>
          </span>
          <span className="text-slate-700">|</span>
          <span className="text-slate-400">
            SNR:{' '}
            <strong className="text-cyan-300">
              {metrics.distortion && metrics.distortion.isToneDetected ? `+${metrics.distortion.snrDb} dB` : '0.0 dB'}
            </strong>
          </span>
        </div>
      </div>
    </div>
  );
};
