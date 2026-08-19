import React from 'react';
import { VolumeX, ShieldAlert, Sliders, RefreshCw, Activity, CheckCircle2, Zap, BarChart2 } from 'lucide-react';
import { NoiseBaselineProfile, AudioMetrics } from '../types';

interface NoiseBaselineMonitorProps {
  profile: NoiseBaselineProfile;
  metrics: AudioMetrics;
  isCalibrating: boolean;
  startCalibration: () => void;
  resetTransients?: () => void;
  isListening: boolean;
}

export const NoiseBaselineMonitor: React.FC<NoiseBaselineMonitorProps> = ({
  profile,
  metrics,
  isCalibrating,
  startCalibration,
  resetTransients,
  isListening,
}) => {
  // SNR quality status
  const getSnrBadge = (snr: number) => {
    if (snr >= 25) return { label: 'Pristine Signal', color: 'text-emerald-400 bg-emerald-500/10 border-emerald-500/30' };
    if (snr >= 15) return { label: 'Good Headroom', color: 'text-cyan-400 bg-cyan-500/10 border-cyan-500/30' };
    if (snr >= 8) return { label: 'Moderate Noise', color: 'text-amber-400 bg-amber-500/10 border-amber-500/30' };
    return { label: 'High Background Noise', color: 'text-rose-400 bg-rose-500/10 border-rose-500/30' };
  };

  const snrBadge = getSnrBadge(profile.snrDb);

  return (
    <div className="bg-slate-900/90 border border-slate-800/80 rounded-2xl p-5 shadow-xl backdrop-blur-md flex flex-col gap-4">
      {/* Header */}
      <div className="flex items-center justify-between border-b border-slate-800 pb-3">
        <div className="flex items-center gap-2.5">
          <div className="p-2 rounded-xl bg-slate-950 border border-slate-800 text-cyan-400">
            <VolumeX className="w-5 h-5" />
          </div>
          <div>
            <h3 className="text-sm font-semibold text-white tracking-wide flex items-center gap-2">
              Background Noise Baseline & Profile
              {profile.isCalibrated && (
                <span className="px-2 py-0.5 rounded-full text-[10px] font-bold bg-emerald-500/20 border border-emerald-500/40 text-emerald-300 flex items-center gap-1">
                  <CheckCircle2 className="w-3 h-3" />
                  Calibrated {profile.lastCalibratedTime && `(${profile.lastCalibratedTime})`}
                </span>
              )}
            </h3>
            <p className="text-xs text-slate-400">
              Long-term noise floor profiling, room acoustics NC rating & SNR tracking
            </p>
          </div>
        </div>

        {/* Recalibrate Silence / Ambient Floor Button */}
        <button
          onClick={startCalibration}
          disabled={isCalibrating || !isListening}
          id="btn-calibrate-noise-baseline"
          className={`px-3 py-1.5 rounded-xl text-xs font-semibold border flex items-center gap-1.5 transition-all cursor-pointer ${
            isCalibrating
              ? 'bg-amber-500/20 border-amber-500 text-amber-300'
              : 'bg-slate-950 border-slate-800 text-slate-300 hover:text-white hover:border-slate-700'
          } ${!isListening ? 'opacity-50 cursor-not-allowed' : ''}`}
          title="Sample room ambient silence for 3 seconds to establish baseline floor"
        >
          <RefreshCw className={`w-3.5 h-3.5 ${isCalibrating ? 'animate-spin text-amber-400' : ''}`} />
          {isCalibrating ? `Calibrating (${profile.calibrationProgress}%)` : 'Calibrate Room Floor'}
        </button>
      </div>

      {/* Calibration Progress Bar */}
      {isCalibrating && (
        <div className="w-full bg-slate-950 rounded-full h-1.5 border border-slate-800 overflow-hidden">
          <div
            className="bg-amber-500 h-full transition-all duration-100"
            style={{ width: `${profile.calibrationProgress}%` }}
          />
        </div>
      )}

      {/* Primary Baseline Metric Grid */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
        {/* Noise Floor dB */}
        <div className="bg-slate-950/80 border border-slate-800/80 rounded-xl p-3 flex flex-col justify-between">
          <div className="text-[11px] font-medium text-slate-400 flex items-center justify-between">
            <span>Noise Floor</span>
            <Activity className="w-3.5 h-3.5 text-cyan-400" />
          </div>
          <div className="mt-2">
            <span className="text-xl font-bold font-mono text-cyan-300">
              {profile.noiseFloorDb} <span className="text-xs text-slate-400">dB</span>
            </span>
            <p className="text-[10px] text-slate-500 mt-0.5">Ambient quiet level</p>
          </div>
        </div>

        {/* Signal-to-Noise Ratio (SNR) */}
        <div className="bg-slate-950/80 border border-slate-800/80 rounded-xl p-3 flex flex-col justify-between">
          <div className="text-[11px] font-medium text-slate-400 flex items-center justify-between">
            <span>Signal / Noise Ratio</span>
            <BarChart2 className="w-3.5 h-3.5 text-emerald-400" />
          </div>
          <div className="mt-2">
            <div className="flex items-baseline gap-1">
              <span className="text-xl font-bold font-mono text-emerald-300">
                +{profile.snrDb}
              </span>
              <span className="text-xs text-slate-400">dB SNR</span>
            </div>
            <span className={`inline-block mt-1 px-1.5 py-0.5 rounded text-[9px] font-semibold border ${snrBadge.color}`}>
              {snrBadge.label}
            </span>
          </div>
        </div>

        {/* Room Noise Rating (NC) */}
        <div className="bg-slate-950/80 border border-slate-800/80 rounded-xl p-3 flex flex-col justify-between">
          <div className="text-[11px] font-medium text-slate-400 flex items-center justify-between">
            <span>Room Acoustic Rating</span>
            <Sliders className="w-3.5 h-3.5 text-purple-400" />
          </div>
          <div className="mt-2">
            <span className="text-xs font-bold text-slate-200 block truncate">
              {profile.noiseCriteriaRating}
            </span>
            <p className="text-[10px] text-slate-500 mt-0.5">Noise Criteria Standard</p>
          </div>
        </div>

        {/* Transient Spike Counter */}
        <div className="bg-slate-950/80 border border-slate-800/80 rounded-xl p-3 flex flex-col justify-between relative group">
          <div className="text-[11px] font-medium text-slate-400 flex items-center justify-between">
            <span title="Counts sudden sharp impulsive onsets (>12dB rise or >16dB crest factor)">Impulsive Transients</span>
            <div className="flex items-center gap-1">
              {resetTransients && profile.transientCount > 0 && (
                <button
                  onClick={resetTransients}
                  className="text-[10px] text-slate-500 hover:text-amber-300 transition-all cursor-pointer px-1 py-0.5 rounded bg-slate-900 border border-slate-800"
                  title="Reset transient counter"
                >
                  Reset
                </button>
              )}
              <Zap className="w-3.5 h-3.5 text-amber-400" />
            </div>
          </div>
          <div className="mt-2">
            <div className="flex items-baseline gap-1.5">
              <span className="text-xl font-bold font-mono text-amber-300">
                {profile.transientCount}
              </span>
              {profile.transientsPerMin !== undefined && profile.transientsPerMin > 0 && (
                <span className="text-[10px] font-mono text-slate-500">
                  ({profile.transientsPerMin}/min)
                </span>
              )}
            </div>
            <p className="text-[10px] text-slate-500 mt-0.5">Sudden acoustic bursts / claps</p>
          </div>
        </div>
      </div>

      {/* Dominant Noise Classification Banner */}
      <div className="bg-slate-950/60 border border-slate-800/80 rounded-xl p-3 flex items-center justify-between gap-3 text-xs">
        <div className="flex items-center gap-2">
          <span className="font-semibold text-slate-400">Dominant Noise Source:</span>
          <span className="font-bold text-cyan-300 bg-cyan-500/10 border border-cyan-500/20 px-2 py-0.5 rounded-md">
            {profile.dominantNoiseBand}
          </span>
        </div>
        <div className="text-[11px] text-slate-500 hidden sm:block">
          RMS Level: <strong className="text-slate-300">{profile.averageRmsDb} dB</strong>
        </div>
      </div>

      {/* Multi-Band Noise Floor Spectrum Curve */}
      <div className="bg-slate-950 border border-slate-800/80 rounded-xl p-3 flex flex-col gap-2">
        <div className="flex items-center justify-between text-[11px] text-slate-400">
          <span className="font-medium flex items-center gap-1.5">
            <Activity className="w-3 h-3 text-cyan-400" />
            32-Band Environmental Noise Floor Profile
          </span>
          <span className="text-[10px] text-slate-500">Low (20Hz) → High (20kHz)</span>
        </div>

        {/* Band Bars */}
        <div className="h-14 flex items-end gap-1 pt-2">
          {profile.bandFloors.map((floorVal, idx) => {
            const heightPct = Math.max(8, floorVal);
            return (
              <div
                key={idx}
                className="flex-1 bg-slate-900 rounded-t-sm hover:bg-slate-800 relative group transition-all"
                style={{ height: '100%' }}
              >
                <div
                  className="bg-gradient-to-t from-cyan-600/80 to-cyan-400 rounded-t-sm w-full absolute bottom-0 transition-all duration-300"
                  style={{ height: `${heightPct}%` }}
                />
              </div>
            );
          })}
        </div>
        <div className="flex justify-between text-[9px] text-slate-600 font-mono px-0.5">
          <span>20 Hz</span>
          <span>250 Hz</span>
          <span>2 kHz</span>
          <span>20 kHz</span>
        </div>
      </div>
    </div>
  );
};
