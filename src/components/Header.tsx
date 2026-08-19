import React from 'react';
import { Activity, Radio, Sparkles, Mic, LayoutGrid, Check } from 'lucide-react';
import { AudioMetrics } from '../types';

interface HeaderProps {
  sourceType: string;
  metrics?: AudioMetrics;
  onOpenGuide?: () => void;
  onOpenReport?: () => void;
}

export const Header: React.FC<HeaderProps> = ({
  sourceType,
  metrics,
  onOpenGuide,
  onOpenReport,
}) => {
  const isMicActive = sourceType === 'mic';

  return (
    <header className="flex flex-col xl:flex-row items-start xl:items-center justify-between gap-4 pb-4 border-b border-slate-800/80">
      <div className="flex items-center gap-3">
        <div className="p-2.5 bg-gradient-to-tr from-cyan-500 via-indigo-500 to-fuchsia-500 rounded-2xl shadow-lg shadow-cyan-500/20 text-white">
          <Activity className="w-6 h-6 animate-pulse" />
        </div>
        <div>
          <div className="flex items-center gap-2">
            <h1 className="text-xl sm:text-2xl font-bold tracking-tight text-white font-display">
              Audio Spectrum
            </h1>
            <span className="text-xs font-semibold px-2 py-0.5 rounded-full bg-cyan-500/10 text-cyan-400 border border-cyan-500/20">
              PRO ANALYZER
            </span>
          </div>
          <p className="text-xs sm:text-sm text-slate-400">
            Real-time Web Audio API spectrum, sound description & baseline analyzer
          </p>
        </div>
      </div>

      <div className="flex items-center gap-2.5 flex-wrap self-stretch xl:self-auto justify-start xl:justify-end">
        {/* Live Prominent Frequency & Telemetry Badge at Top Header */}
        {metrics && (
          <div 
            id="header-live-prominent-frequency-badge"
            className="flex items-center gap-2 bg-slate-900 border border-slate-800/90 px-3 py-1.5 rounded-xl text-xs text-slate-200 shadow-sm"
            title="Real-time Prominent Peak Frequency & Chromatic Pitch"
          >
            <div className="flex items-center gap-1.5">
              <span className={`w-2 h-2 rounded-full transition-all ${metrics.peakFrequencyHz > 16 ? 'bg-emerald-400 shadow-[0_0_8px_rgba(52,211,153,0.8)] animate-pulse' : 'bg-slate-600'}`} />
              <span className="text-[10px] sm:text-[11px] font-bold text-slate-400 uppercase tracking-wider">Prominent:</span>
              <span className="font-mono font-extrabold text-cyan-300 text-xs sm:text-sm tracking-tight">
                {metrics.peakFrequencyHz > 16 ? metrics.peakFrequencyFormatted : '0.0 Hz'}
              </span>
            </div>

            {metrics.peakFrequencyHz > 16 && (
              <>
                <span className="text-slate-700">|</span>
                <span className="font-mono text-[11px] font-bold text-amber-300 bg-amber-500/10 px-1.5 py-0.5 rounded border border-amber-500/20">
                  {metrics.peakNoteName}
                </span>
                {metrics.prominenceDb > -95 && (
                  <span className="text-[10px] font-mono text-slate-400 hidden sm:inline">
                    {metrics.prominenceDb} dBFS
                  </span>
                )}
              </>
            )}

            <span className="text-slate-700">|</span>
            <span className="font-mono text-[11px] font-medium text-slate-400 flex items-center gap-1">
              <Activity className="w-3 h-3 text-cyan-400" />
              {metrics.fps} FPS
            </span>
          </div>
        )}

        {/* Convenient Top Microphone Enabler Button */}
        <div className="flex items-center gap-2 px-3 py-1.5 rounded-xl bg-slate-900 border border-slate-800 text-xs text-slate-300">
          <Radio className="w-3.5 h-3.5 text-emerald-400 animate-pulse" />
          <span className="text-slate-400">Source:</span>
          <strong className="capitalize font-semibold text-emerald-300">{sourceType}</strong>
        </div>

        {onOpenGuide && (
          <button
            onClick={onOpenGuide}
            id="btn-header-open-guide"
            className="px-3 py-1.5 rounded-xl bg-slate-900 hover:bg-slate-800 border border-slate-800 text-xs font-semibold text-cyan-300 flex items-center gap-1.5 cursor-pointer transition-all animate-shimmer"
            title="Open Acoustic Diagnostic Guide"
          >
            <Sparkles className="w-3.5 h-3.5 text-cyan-400" />
            Diagnostic Guide
          </button>
        )}

        {onOpenReport && (
          <button
            onClick={onOpenReport}
            id="btn-header-open-report"
            className="px-3 py-1.5 rounded-xl bg-cyan-500/10 hover:bg-cyan-500/20 border border-cyan-500/30 text-xs font-semibold text-cyan-300 flex items-center gap-1.5 cursor-pointer transition-all"
            title="Export Acoustic Sound Audit Report"
          >
            Export Report
          </button>
        )}
      </div>
    </header>
  );
};

