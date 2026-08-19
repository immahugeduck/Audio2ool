import React from 'react';
import { AudioMetrics } from '../types';
import { Activity, Gauge, Zap } from 'lucide-react';
import { noteToString } from '../utils/audioPresets';

interface AudioMetersProps {
  metrics: AudioMetrics;
}

export const AudioMeters: React.FC<AudioMetersProps> = ({ metrics }) => {
  const bands = [
    { label: 'Sub-Bass (20-60Hz)', value: metrics.subBass, color: 'from-fuchsia-500 to-indigo-500' },
    { label: 'Bass (60-250Hz)', value: metrics.bass, color: 'from-cyan-500 to-blue-500' },
    { label: 'Midrange (250-4kHz)', value: metrics.mid, color: 'from-emerald-500 to-teal-500' },
    { label: 'Treble (4k-20kHz)', value: metrics.treble, color: 'from-amber-500 to-rose-500' },
  ];

  return (
    <div className="bg-slate-900/90 rounded-2xl border border-slate-800 p-4 sm:p-5 shadow-xl flex flex-col gap-4">
      <div className="flex items-center justify-between pb-3 border-b border-slate-800">
        <div className="flex items-center gap-2">
          <Gauge className="w-4 h-4 text-cyan-400" />
          <h2 className="text-sm font-semibold text-white">Frequency Band Energy & VU Metering</h2>
        </div>

        {/* Peak Frequency Note Badge */}
        <div className="flex items-center gap-2 bg-slate-950 px-3 py-1 rounded-xl border border-slate-800">
          <Zap className="w-3.5 h-3.5 text-amber-400" />
          <span className="text-xs text-slate-400">Prominent Peak:</span>
          <span className="text-xs font-mono font-bold text-amber-300">
            {metrics.peakFrequencyHz > 16 ? `${metrics.peakFrequencyFormatted} (${metrics.peakNoteName})` : '---'}
          </span>
        </div>
      </div>

      {/* 4-Band VU Energy Meters */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3">
        {bands.map((band) => (
          <div key={band.label} className="flex flex-col gap-1.5 bg-slate-950 p-3 rounded-xl border border-slate-800">
            <div className="flex justify-between items-center text-xs">
              <span className="text-slate-400 font-medium truncate">{band.label}</span>
              <span className="font-mono text-cyan-400 font-semibold">{band.value}%</span>
            </div>

            {/* VU Meter Bar */}
            <div className="w-full h-2.5 bg-slate-900 rounded-md overflow-hidden p-0.5 border border-slate-800">
              <div
                className={`h-full rounded-sm bg-gradient-to-r ${band.color} transition-all duration-75`}
                style={{ width: `${Math.min(100, Math.max(0, band.value))}%` }}
              />
            </div>
          </div>
        ))}
      </div>

      {/* Master RMS & Transient Peak Meters */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
        {/* Master RMS dB */}
        <div className="flex flex-col gap-1.5 bg-slate-950 p-3 rounded-xl border border-slate-800">
          <div className="flex justify-between items-center text-xs">
            <div className="flex items-center gap-1.5 text-slate-400 font-medium">
              <Activity className="w-3.5 h-3.5 text-emerald-400" />
              Master RMS Level
            </div>
            <span className="font-mono font-bold text-emerald-400">{metrics.rmsDb} dB</span>
          </div>

          <div className="w-full h-2.5 bg-slate-900 rounded-md overflow-hidden p-0.5 border border-slate-800 flex items-center">
            <div
              className={`h-full rounded-sm transition-all duration-75 ${
                metrics.rmsDb > -6
                  ? 'bg-rose-500'
                  : metrics.rmsDb > -18
                  ? 'bg-amber-400'
                  : 'bg-emerald-400'
              }`}
              style={{ width: `${Math.min(100, Math.max(0, (metrics.rmsDb + 100)))}%` }}
            />
          </div>
        </div>

        {/* Peak dB */}
        <div className="flex flex-col gap-1.5 bg-slate-950 p-3 rounded-xl border border-slate-800">
          <div className="flex justify-between items-center text-xs">
            <div className="flex items-center gap-1.5 text-slate-400 font-medium">
              <Zap className="w-3.5 h-3.5 text-amber-400" />
              Instantaneous Peak dB
            </div>
            <span className="font-mono font-bold text-amber-300">{metrics.peakDb} dB</span>
          </div>

          <div className="w-full h-2.5 bg-slate-900 rounded-md overflow-hidden p-0.5 border border-slate-800 flex items-center">
            <div
              className={`h-full rounded-sm transition-all duration-75 ${
                metrics.peakDb > -3
                  ? 'bg-rose-500'
                  : metrics.peakDb > -12
                  ? 'bg-amber-400'
                  : 'bg-cyan-400'
              }`}
              style={{ width: `${Math.min(100, Math.max(0, (metrics.peakDb + 100)))}%` }}
            />
          </div>
        </div>

        {/* Crest Factor (Transient Punch) */}
        <div className="flex flex-col gap-1.5 bg-slate-950 p-3 rounded-xl border border-slate-800">
          <div className="flex justify-between items-center text-xs">
            <div className="flex items-center gap-1.5 text-slate-400 font-medium">
              <Gauge className="w-3.5 h-3.5 text-cyan-400" />
              Crest Factor (Transients)
            </div>
            <span className="font-mono font-bold text-cyan-300">+{metrics.crestFactorDb} dB</span>
          </div>

          <div className="w-full h-2.5 bg-slate-900 rounded-md overflow-hidden p-0.5 border border-slate-800 flex items-center">
            <div
              className={`h-full rounded-sm bg-gradient-to-r from-cyan-500 to-indigo-500 transition-all duration-75`}
              style={{ width: `${Math.min(100, (metrics.crestFactorDb / 30) * 100)}%` }}
            />
          </div>
        </div>
      </div>
    </div>
  );
};
