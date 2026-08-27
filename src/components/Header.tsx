import React from 'react';
import { Activity, Radio, Sparkles, Mic, Music, FileText } from 'lucide-react';
import { AudioMetrics } from '../types';

interface HeaderProps {
  sourceType: string;
  metrics?: AudioMetrics;
  activeTab?: 'live' | 'media';
  onSelectTab?: (tab: 'live' | 'media') => void;
  onOpenGuide?: () => void;
  onOpenReport?: () => void;
}

export const Header: React.FC<HeaderProps> = ({
  sourceType,
  metrics,
  activeTab,
  onSelectTab,
  onOpenGuide,
  onOpenReport,
}) => {
  return (
    <header className="flex flex-col gap-4 pb-4 border-b border-cyan-500/20">
      <div className="flex flex-col xl:flex-row items-start xl:items-center justify-between gap-4">
        {/* Brand & Title */}
        <div className="flex items-center gap-3">
          <div className="p-2.5 bg-gradient-to-tr from-cyan-500 via-blue-600 to-fuchsia-600 rounded-2xl shadow-[0_0_20px_rgba(6,182,212,0.4)] text-white ring-1 ring-cyan-400/40">
            <Activity className="w-6 h-6 animate-pulse text-cyan-200" />
          </div>
          <div>
            <div className="flex items-center gap-2">
              <h1 className="text-xl sm:text-2xl font-black tracking-tight text-transparent bg-clip-text bg-gradient-to-r from-cyan-300 via-white to-fuchsia-300 font-display">
                SPECTRA LAB
              </h1>
              <span className="text-[10px] font-extrabold px-2 py-0.5 rounded-full bg-cyan-500/20 text-cyan-300 border border-cyan-400/40 shadow-[0_0_10px_rgba(6,182,212,0.3)]">
                PRO SPECTRUM & SCOPE
              </span>
            </div>
            <p className="text-xs text-slate-400">
              High-Precision Real-time Audio Spectrum, CRT Oscilloscope & Acoustic Diagnostics
            </p>
          </div>
        </div>

        {/* Top Header Metrics & Quick Actions */}
        <div className="flex items-center gap-2.5 flex-wrap self-stretch xl:self-auto justify-start xl:justify-end">
          {/* Live Prominent Frequency & Telemetry Badge at Top Header */}
          {metrics && (
            <div 
              id="header-live-prominent-frequency-badge"
              className="flex items-center gap-2 bg-slate-900/90 border border-cyan-500/30 px-3 py-1.5 rounded-xl text-xs text-slate-200 shadow-[0_0_15px_rgba(6,182,212,0.1)] backdrop-blur-md"
              title="Real-time Prominent Peak Frequency & Chromatic Pitch"
            >
              <div className="flex items-center gap-1.5">
                <span className={`w-2 h-2 rounded-full transition-all ${metrics.peakFrequencyHz > 16 ? 'bg-emerald-400 shadow-[0_0_10px_rgba(52,211,153,0.9)] animate-pulse' : 'bg-slate-600'}`} />
                <span className="text-[10px] sm:text-[11px] font-bold text-slate-400 uppercase tracking-wider">Peak:</span>
                <span className="font-mono font-extrabold text-cyan-300 text-xs sm:text-sm tracking-tight drop-shadow-[0_0_6px_rgba(6,182,212,0.6)]">
                  {metrics.peakFrequencyHz > 16 ? metrics.peakFrequencyFormatted : '0.0 Hz'}
                </span>
              </div>

              {metrics.peakFrequencyHz > 16 && (
                <>
                  <span className="text-slate-700">|</span>
                  <span className="font-mono text-[11px] font-bold text-amber-300 bg-amber-500/15 px-1.5 py-0.5 rounded border border-amber-500/30 shadow-[0_0_8px_rgba(245,158,11,0.2)]">
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

          {/* Source indicator */}
          <div className="flex items-center gap-2 px-3 py-1.5 rounded-xl bg-slate-900/90 border border-slate-800 text-xs text-slate-300">
            <Radio className="w-3.5 h-3.5 text-emerald-400 animate-pulse" />
            <span className="text-slate-400">Input:</span>
            <strong className="capitalize font-semibold text-emerald-300">{sourceType}</strong>
          </div>

          {onOpenGuide && (
            <button
              onClick={onOpenGuide}
              id="btn-header-open-guide"
              className="px-3 py-1.5 rounded-xl bg-slate-900/90 hover:bg-slate-800 border border-cyan-500/30 text-xs font-semibold text-cyan-300 flex items-center gap-1.5 cursor-pointer transition-all hover:shadow-[0_0_12px_rgba(6,182,212,0.3)]"
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
              className="px-3 py-1.5 rounded-xl bg-gradient-to-r from-cyan-500/20 to-blue-600/20 hover:from-cyan-500/30 hover:to-blue-600/30 border border-cyan-400/40 text-xs font-bold text-cyan-200 flex items-center gap-1.5 cursor-pointer transition-all hover:shadow-[0_0_15px_rgba(6,182,212,0.4)]"
              title="Export Acoustic Sound Audit Report"
            >
              <FileText className="w-3.5 h-3.5 text-cyan-300" />
              Export Report
            </button>
          )}
        </div>
      </div>

      {/* Page View Switcher Navigation Strip */}
      {activeTab && onSelectTab && (
        <div className="flex flex-col sm:flex-row items-center justify-between gap-3 bg-slate-950/80 p-1.5 rounded-2xl border border-cyan-500/20 shadow-inner">
          <div className="flex items-center gap-2 w-full sm:w-auto">
            <button
              onClick={() => onSelectTab('live')}
              id="header-tab-btn-live-space"
              className={`flex-1 sm:flex-initial py-2.5 px-5 rounded-xl font-bold text-xs sm:text-sm flex items-center justify-center gap-2 transition-all cursor-pointer ${
                activeTab === 'live'
                  ? 'bg-gradient-to-r from-rose-500/25 via-pink-500/20 to-fuchsia-500/25 border border-rose-500/60 text-rose-200 shadow-[0_0_20px_rgba(244,63,94,0.3)] ring-1 ring-rose-400/40'
                  : 'text-slate-400 hover:text-slate-200 border border-transparent hover:bg-slate-900'
              }`}
            >
              <Mic className={`w-4 h-4 ${activeTab === 'live' ? 'text-rose-400 animate-pulse' : 'text-slate-400'}`} />
              <span>PAGE 1: Live Feed & Acoustic Studio</span>
            </button>

            <button
              onClick={() => onSelectTab('media')}
              id="header-tab-btn-media-analyzer"
              className={`flex-1 sm:flex-initial py-2.5 px-5 rounded-xl font-bold text-xs sm:text-sm flex items-center justify-center gap-2 transition-all cursor-pointer ${
                activeTab === 'media'
                  ? 'bg-gradient-to-r from-cyan-500/25 via-blue-500/20 to-indigo-500/25 border border-cyan-400/60 text-cyan-200 shadow-[0_0_20px_rgba(6,182,212,0.3)] ring-1 ring-cyan-400/40'
                  : 'text-slate-400 hover:text-slate-200 border border-transparent hover:bg-slate-900'
              }`}
            >
              <Music className={`w-4 h-4 ${activeTab === 'media' ? 'text-cyan-400 animate-pulse' : 'text-slate-400'}`} />
              <span>PAGE 2: URL Stream & Uploaded File Studio</span>
            </button>
          </div>

          <div className="text-[11px] font-mono text-slate-400 flex items-center gap-2 px-3 py-1 bg-slate-900/60 rounded-lg border border-slate-800">
            <span className="w-1.5 h-1.5 rounded-full bg-cyan-400 animate-ping" />
            <span>Workspace: <strong className="text-white uppercase">{activeTab === 'live' ? 'Live Microphone Equipment' : 'Media Playback Equipment'}</strong></span>
          </div>
        </div>
      )}
    </header>
  );
};

