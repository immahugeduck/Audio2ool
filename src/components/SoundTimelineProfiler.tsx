import React, { useState, useEffect, useRef } from 'react';
import { 
  History, 
  Play, 
  Square, 
  Volume2, 
  Clock, 
  TrendingUp, 
  Info, 
  Compass, 
  HelpCircle, 
  Trash2, 
  CheckCircle2, 
  Radio, 
  Zap,
  ChevronRight,
  Sparkles
} from 'lucide-react';
import { AudioMetrics } from '../types';
import { noteToString } from '../utils/audioPresets';

interface SoundTimelineProfilerProps {
  metrics: AudioMetrics;
  isListening: boolean;
  getFrequencyData: () => Uint8Array | null;
}

interface SampledPoint {
  elapsedTimeSec: number;
  rmsDb: number;
  peakFrequencyHz: number;
  peakNoteName: string;
  subBass: number;
  bass: number;
  mid: number;
  treble: number;
  timestamp: string;
}

export const SoundTimelineProfiler: React.FC<SoundTimelineProfilerProps> = ({
  metrics,
  isListening,
  getFrequencyData,
}) => {
  // Session Configuration State
  const [targetDuration, setTargetDuration] = useState<number>(0); // 0 means manual stop
  const [sampleInterval, setSampleInterval] = useState<number>(500); // ms
  const [isProfiling, setIsProfiling] = useState<boolean>(false);
  const [profileHistory, setProfileHistory] = useState<SampledPoint[]>([]);
  const [activeTab, setActiveTab] = useState<'timeline' | 'waterfall' | 'comparison'>('timeline');

  // Real-time tracking refs & states
  const [elapsedTime, setElapsedTime] = useState<number>(0);
  const startTimeRef = useRef<number>(0);
  const intervalIdRef = useRef<any>(null);
  const timerIdRef = useRef<any>(null);

  // Hover/inspect state on the interactive SVG timeline
  const [hoveredPoint, setHoveredPoint] = useState<SampledPoint | null>(null);
  const [hoveredIndex, setHoveredIndex] = useState<number | null>(null);

  // Start / Stop profiling handlers
  const startProfiling = () => {
    setProfileHistory([]);
    setElapsedTime(0);
    setHoveredPoint(null);
    setHoveredIndex(null);
    setIsProfiling(true);
    startTimeRef.current = performance.now();

    // Setup periodic sampling interval
    const intervalId = setInterval(() => {
      const elapsed = (performance.now() - startTimeRef.current) / 1000;
      setElapsedTime(elapsed);

      // Create a sampled data point
      const now = new Date();
      const timestampStr = now.toLocaleTimeString([], { hour12: false, hour: '2-digit', minute: '2-digit', second: '2-digit' }) + '.' + String(now.getMilliseconds()).padStart(3, '0');

      const point: SampledPoint = {
        elapsedTimeSec: Number(elapsed.toFixed(2)),
        rmsDb: metrics.rmsDb,
        peakFrequencyHz: metrics.peakFrequencyHz,
        peakNoteName: metrics.peakNoteName,
        subBass: metrics.subBass,
        bass: metrics.bass,
        mid: metrics.mid,
        treble: metrics.treble,
        timestamp: timestampStr,
      };

      setProfileHistory((prev) => [...prev, point]);

      // If a target duration is set and reached, stop profiling
      if (targetDuration > 0 && elapsed >= targetDuration) {
        stopProfiling();
      }
    }, sampleInterval);

    intervalIdRef.current = intervalId;
  };

  const stopProfiling = () => {
    setIsProfiling(false);
    if (intervalIdRef.current) {
      clearInterval(intervalIdRef.current);
      intervalIdRef.current = null;
    }
  };

  // Clean up on unmount
  useEffect(() => {
    return () => {
      if (intervalIdRef.current) clearInterval(intervalIdRef.current);
    };
  }, []);

  // Compute summary stats
  const getProfileSummary = () => {
    if (profileHistory.length === 0) return null;

    const startPoint = profileHistory[0];
    const endPoint = profileHistory[profileHistory.length - 1];
    const midPointIndex = Math.floor(profileHistory.length / 2);
    const midPoint = profileHistory[midPointIndex];

    const allRms = profileHistory.map(p => p.rmsDb);
    const minRms = Math.min(...allRms);
    const maxRms = Math.max(...allRms);
    const avgRms = Number((allRms.reduce((a, b) => a + b, 0) / allRms.length).toFixed(1));

    // Loudest moment index and point
    const loudestIndex = allRms.indexOf(maxRms);
    const loudestPoint = profileHistory[loudestIndex];

    // Peak frequency shift
    const freqShiftHz = endPoint.peakFrequencyHz - startPoint.peakFrequencyHz;
    const dbShift = Number((endPoint.rmsDb - startPoint.rmsDb).toFixed(1));

    // Calculate dominant band at start vs end
    const getDominantBandName = (pt: SampledPoint) => {
      const bands = [
        { name: 'Sub-Bass', val: pt.subBass },
        { name: 'Bass', val: pt.bass },
        { name: 'Midrange', val: pt.mid },
        { name: 'Treble', val: pt.treble },
      ];
      bands.sort((a, b) => b.val - a.val);
      return bands[0].name;
    };

    const startDominantBand = getDominantBandName(startPoint);
    const endDominantBand = getDominantBandName(endPoint);

    // Dynamic description of the sound profile's evolution
    let soundBehavior = 'Constant / Balanced';
    const rmsVariance = maxRms - minRms;
    const absFreqShift = Math.abs(freqShiftHz);

    if (rmsVariance > 12) {
      if (endPoint.rmsDb < startPoint.rmsDb - 10) {
        soundBehavior = 'Gradually Decaying Envelope';
      } else if (endPoint.rmsDb > startPoint.rmsDb + 10) {
        soundBehavior = 'Rising / Crescendo Envelope';
      } else {
        soundBehavior = 'Highly Volatile / Pulsing';
      }
    } else if (absFreqShift > 150) {
      if (freqShiftHz > 0) {
        soundBehavior = 'Pitch Sweeping Upward';
      } else {
        soundBehavior = 'Pitch Sweeping Downward';
      }
    } else if (rmsVariance < 4 && absFreqShift < 20) {
      soundBehavior = 'Highly Stable Steady-State';
    }

    return {
      startPoint,
      midPoint,
      endPoint,
      minRms,
      maxRms,
      avgRms,
      loudestPoint,
      freqShiftHz,
      dbShift,
      startDominantBand,
      endDominantBand,
      soundBehavior,
    };
  };

  const summary = getProfileSummary();

  // Helper to draw custom responsive SVG charts
  const renderLineChart = () => {
    if (profileHistory.length < 2) {
      return (
        <div className="flex flex-col items-center justify-center h-56 text-slate-500 text-xs text-center">
          <History className="w-8 h-8 text-slate-600 mb-2 animate-pulse" />
          <span>Need at least 2 sampled points to render timeline.</span>
          <span className="text-[10px] text-slate-600 mt-1">Start recording and wait a moment...</span>
        </div>
      );
    }

    const paddingX = 40;
    const paddingY = 25;
    const chartWidth = 600;
    const chartHeight = 220;

    // RMS range in dB (-100 to 0)
    const minDb = -90;
    const maxDb = 0;
    const dbRange = maxDb - minDb;

    // Freq range: map logarithmic or linear (use linear 0 - 5000Hz for clear visualization of peak)
    const maxFreqPlot = Math.max(1000, ...profileHistory.map(p => p.peakFrequencyHz)) * 1.1;

    // Generate path coordinate strings
    const rmsPoints: { x: number; y: number; pt: SampledPoint; idx: number }[] = [];
    const freqPoints: { x: number; y: number; pt: SampledPoint; idx: number }[] = [];

    profileHistory.forEach((pt, idx) => {
      const x = paddingX + (idx / (profileHistory.length - 1)) * (chartWidth - paddingX * 2);
      
      // Map dB to Y coordinate
      const rmsClamped = Math.max(minDb, Math.min(maxDb, pt.rmsDb));
      const rmsY = chartHeight - paddingY - ((rmsClamped - minDb) / dbRange) * (chartHeight - paddingY * 2);
      rmsPoints.push({ x, y: rmsY, pt, idx });

      // Map Freq to Y coordinate
      const freqY = chartHeight - paddingY - (pt.peakFrequencyHz / maxFreqPlot) * (chartHeight - paddingY * 2);
      freqPoints.push({ x, y: freqY, pt, idx });
    });

    const createPath = (pts: { x: number; y: number }[]) => {
      if (pts.length === 0) return '';
      let d = `M ${pts[0].x} ${pts[0].y}`;
      for (let i = 0; i < pts.length - 1; i++) {
        const xc = (pts[i].x + pts[i + 1].x) / 2;
        const yc = (pts[i].y + pts[i + 1].y) / 2;
        d += ` Q ${pts[i].x} ${pts[i].y}, ${xc} ${yc}`;
      }
      d += ` L ${pts[pts.length - 1].x} ${pts[pts.length - 1].y}`;
      return d;
    };

    const rmsPath = createPath(rmsPoints);
    const freqPath = createPath(freqPoints);

    // Create shading below the RMS volume line
    const fillPath = profileHistory.length > 0 
      ? `${rmsPath} L ${rmsPoints[rmsPoints.length - 1].x} ${chartHeight - paddingY} L ${rmsPoints[0].x} ${chartHeight - paddingY} Z`
      : '';

    // Handle mouse move to capture hover position
    const handleMouseMove = (e: React.MouseEvent<SVGSVGElement, MouseEvent>) => {
      const rect = e.currentTarget.getBoundingClientRect();
      const mouseX = ((e.clientX - rect.left) / rect.width) * chartWidth;
      
      // Find closest index
      let closestIdx = 0;
      let minDistance = Infinity;

      rmsPoints.forEach((p, idx) => {
        const dist = Math.abs(p.x - mouseX);
        if (dist < minDistance) {
          minDistance = dist;
          closestIdx = idx;
        }
      });

      if (closestIdx >= 0 && closestIdx < profileHistory.length) {
        setHoveredPoint(profileHistory[closestIdx]);
        setHoveredIndex(closestIdx);
      }
    };

    const handleMouseLeave = () => {
      setHoveredPoint(null);
      setHoveredIndex(null);
    };

    return (
      <div className="relative">
        {/* Legends */}
        <div className="flex items-center justify-between text-[11px] font-semibold text-slate-400 mb-2 px-1">
          <div className="flex items-center gap-4">
            <span className="flex items-center gap-1.5">
              <span className="w-3 h-0.5 bg-emerald-400 inline-block" />
              Volume (RMS dB)
            </span>
            <span className="flex items-center gap-1.5">
              <span className="w-3 h-0.5 bg-cyan-400 border-dashed border-cyan-400 inline-block" style={{ borderStyle: 'dashed' }} />
              Dominant Pitch (Hz)
            </span>
          </div>
          <span className="text-[10px] text-slate-500">Hover graph to inspect values</span>
        </div>

        {/* Dynamic Hover Tooltip inside SVG parent to remain robust */}
        <div className="overflow-x-auto overflow-y-hidden bg-slate-950/60 rounded-xl border border-slate-800/40 p-1">
          <svg 
            viewBox={`0 0 ${chartWidth} ${chartHeight}`} 
            className="w-full h-auto min-w-[550px]"
            onMouseMove={handleMouseMove}
            onMouseLeave={handleMouseLeave}
          >
            {/* Grid Lines */}
            <line x1={paddingX} y1={paddingY} x2={chartWidth - paddingX} y2={paddingY} stroke="#1e293b" strokeWidth={1} strokeDasharray="3 3" />
            <line x1={paddingX} y1={chartHeight / 2} x2={chartWidth - paddingX} y2={chartHeight / 2} stroke="#1e293b" strokeWidth={1} strokeDasharray="3 3" />
            <line x1={paddingX} y1={chartHeight - paddingY} x2={chartWidth - paddingX} y2={chartHeight - paddingY} stroke="#334155" strokeWidth={1} />

            {/* Vertical Time markers */}
            <line x1={paddingX} y1={paddingY} x2={paddingX} y2={chartHeight - paddingY} stroke="#1e293b" />
            <line x1={chartWidth - paddingX} y1={paddingY} x2={chartWidth - paddingX} y2={chartHeight - paddingY} stroke="#1e293b" />

            {/* Y Axis Labels (Left: dB) */}
            <text x={paddingX - 8} y={paddingY + 4} fill="#64748b" fontSize={9} textAnchor="end">0 dB</text>
            <text x={paddingX - 8} y={chartHeight / 2 + 3} fill="#64748b" fontSize={9} textAnchor="end">-45 dB</text>
            <text x={paddingX - 8} y={chartHeight - paddingY + 3} fill="#64748b" fontSize={9} textAnchor="end">-90 dB</text>

            {/* Y Axis Labels (Right: Hz) */}
            <text x={chartWidth - paddingX + 8} y={paddingY + 4} fill="#0ea5e9" fontSize={9} textAnchor="start">{Math.round(maxFreqPlot)}Hz</text>
            <text x={chartWidth - paddingX + 8} y={chartHeight / 2 + 3} fill="#0ea5e9" fontSize={9} textAnchor="start">{Math.round(maxFreqPlot / 2)}Hz</text>
            <text x={chartWidth - paddingX + 8} y={chartHeight - paddingY + 3} fill="#0ea5e9" fontSize={9} textAnchor="start">0Hz</text>

            {/* Volume Shading */}
            <path d={fillPath} fill="url(#volumeGrad)" opacity={0.15} />

            {/* Volume Line */}
            <path d={rmsPath} fill="none" stroke="#10b981" strokeWidth={2} />

            {/* Frequency Line */}
            <path d={freqPath} fill="none" stroke="#06b6d4" strokeWidth={1.5} strokeDasharray="3 3" />

            {/* Highlighted hover line */}
            {hoveredIndex !== null && rmsPoints[hoveredIndex] && (
              <g>
                <line 
                  x1={rmsPoints[hoveredIndex].x} 
                  y1={paddingY} 
                  x2={rmsPoints[hoveredIndex].x} 
                  y2={chartHeight - paddingY} 
                  stroke="#38bdf8" 
                  strokeWidth={1} 
                  opacity={0.6}
                />
                <circle cx={rmsPoints[hoveredIndex].x} cy={rmsPoints[hoveredIndex].y} r={4.5} fill="#10b981" stroke="#ffffff" strokeWidth={1.5} />
                <circle cx={freqPoints[hoveredIndex].x} cy={freqPoints[hoveredIndex].y} r={4.5} fill="#06b6d4" stroke="#ffffff" strokeWidth={1.5} />
              </g>
            )}

            {/* Time labels on X Axis */}
            <text x={paddingX} y={chartHeight - 8} fill="#475569" fontSize={8} textAnchor="middle">0.0s (Start)</text>
            <text x={chartWidth / 2} y={chartHeight - 8} fill="#475569" fontSize={8} textAnchor="middle">
              {((profileHistory[profileHistory.length - 1].elapsedTimeSec) / 2).toFixed(1)}s
            </text>
            <text x={chartWidth - paddingX} y={chartHeight - 8} fill="#475569" fontSize={8} textAnchor="middle">
              {profileHistory[profileHistory.length - 1].elapsedTimeSec.toFixed(1)}s (End)
            </text>

            <defs>
              <linearGradient id="volumeGrad" x1="0" y1="0" x2="0" y2="1">
                <stop offset="0%" stopColor="#10b981" />
                <stop offset="100%" stopColor="#10b981" stopOpacity="0" />
              </linearGradient>
            </defs>
          </svg>
        </div>

        {/* Hover inspector values block */}
        <div className="mt-3 bg-slate-950 p-3 rounded-xl border border-slate-800/80 flex flex-wrap items-center justify-between gap-3 text-xs">
          {hoveredPoint ? (
            <>
              <div className="flex items-center gap-1 text-slate-400">
                <Clock className="w-3.5 h-3.5 text-cyan-400 shrink-0" />
                Time: <span className="font-mono text-white font-bold">{hoveredPoint.elapsedTimeSec}s</span>
              </div>
              <div className="flex items-center gap-1 text-slate-400">
                <Volume2 className="w-3.5 h-3.5 text-emerald-400 shrink-0" />
                Volume: <span className="font-mono text-emerald-300 font-bold">{hoveredPoint.rmsDb} dB</span>
              </div>
              <div className="flex items-center gap-1 text-slate-400">
                <Zap className="w-3.5 h-3.5 text-amber-400 shrink-0" />
                Peak Pitch: <span className="font-mono text-amber-300 font-bold">{Math.round(hoveredPoint.peakFrequencyHz)} Hz ({hoveredPoint.peakNoteName})</span>
              </div>
              <div className="flex items-center gap-2 bg-slate-900 px-2 py-0.5 rounded text-[10px] text-slate-400">
                <span>Bands: B:{hoveredPoint.bass}% | M:{hoveredPoint.mid}% | T:{hoveredPoint.treble}%</span>
              </div>
            </>
          ) : (
            <div className="text-slate-500 italic mx-auto text-[11px] flex items-center gap-1.5 py-0.5">
              <Info className="w-3.5 h-3.5 text-slate-600" />
              Hover your cursor over the chart points above to inspect discrete real-time sound values.
            </div>
          )}
        </div>
      </div>
    );
  };

  // Waterfall/Rolling Heatmap view of bands
  const renderWaterfallChart = () => {
    if (profileHistory.length < 2) {
      return (
        <div className="flex flex-col items-center justify-center h-56 text-slate-500 text-xs text-center">
          <History className="w-8 h-8 text-slate-600 mb-2 animate-pulse" />
          <span>Waterfall heatmap requires active session points.</span>
        </div>
      );
    }

    // Capture standard slice of history for drawing
    const list = [...profileHistory].reverse().slice(0, 24); // Show last 24 records

    return (
      <div className="flex flex-col gap-3">
        <div className="flex justify-between items-center text-[10px] text-slate-400 font-semibold px-1">
          <span>MOST RECENT ➔</span>
          <span>OLDER SAMPLES ➔</span>
        </div>

        <div className="bg-slate-950 p-3.5 rounded-xl border border-slate-800/80 flex flex-col gap-2 overflow-x-auto">
          {['subBass', 'bass', 'mid', 'treble'].map((bandName) => {
            const label = bandName === 'subBass' ? 'Sub-Bass' : bandName === 'bass' ? 'Bass' : bandName === 'mid' ? 'Midrange' : 'Treble';
            const colorClass = bandName === 'subBass' ? 'bg-fuchsia-500' : bandName === 'bass' ? 'bg-blue-500' : bandName === 'mid' ? 'bg-emerald-500' : 'bg-amber-500';

            return (
              <div key={bandName} className="flex items-center gap-3">
                <span className="text-[11px] font-bold text-slate-400 w-16 shrink-0">{label}</span>
                <div className="flex-1 flex gap-1 min-h-[22px]">
                  {list.map((pt, i) => {
                    const val = pt[bandName as 'subBass' | 'bass' | 'mid' | 'treble'] || 0;
                    // Compute opacity directly based on energy value
                    const opacity = Math.max(0.08, val / 100);
                    return (
                      <div 
                        key={i} 
                        className={`flex-1 rounded-sm relative group min-w-[12px] h-[22px] transition-all hover:scale-y-110 cursor-help ${colorClass}`}
                        style={{ opacity }}
                        title={`${pt.elapsedTimeSec}s: ${val}%`}
                      >
                        {/* Tiny hover tip */}
                        <span className="hidden group-hover:block absolute bottom-full left-1/2 -translate-x-1/2 bg-slate-900 border border-slate-700 text-[9px] px-1 py-0.5 rounded text-white z-10 whitespace-nowrap mb-1 font-mono">
                          {val}%
                        </span>
                      </div>
                    );
                  })}
                </div>
              </div>
            );
          })}
        </div>
        <div className="text-[10px] text-slate-500 text-center italic flex items-center justify-center gap-1">
          <Sparkles className="w-3 h-3 text-cyan-500" />
          Brighter colored blocks represent higher frequency band energy percentages.
        </div>
      </div>
    );
  };

  // Compare Start vs Mid vs End spectrum envelopes
  const renderComparisonChart = () => {
    if (!summary) {
      return (
        <div className="flex flex-col items-center justify-center h-56 text-slate-500 text-xs text-center">
          <History className="w-8 h-8 text-slate-600 mb-2 animate-pulse" />
          <span>Acoustic signatures comparison becomes available once profile session starts.</span>
        </div>
      );
    }

    const startPt = summary.startPoint;
    const midPt = summary.midPoint || startPt;
    const endPt = summary.endPoint;

    const stages = [
      { label: 'Start State (0.0s)', point: startPt, color: 'text-cyan-400', border: 'border-cyan-500/30', bg: 'bg-cyan-500/5' },
      { label: `Mid-Session (${midPt.elapsedTimeSec.toFixed(1)}s)`, point: midPt, color: 'text-amber-400', border: 'border-amber-500/30', bg: 'bg-amber-500/5' },
      { label: `Ending State (${endPt.elapsedTimeSec.toFixed(1)}s)`, point: endPt, color: 'text-emerald-400', border: 'border-emerald-500/30', bg: 'bg-emerald-500/5' },
    ];

    return (
      <div className="flex flex-col gap-4">
        <h4 className="text-xs font-bold text-slate-200">
          Spectral Envelope Contrast: Start vs. Mid vs. End
        </h4>

        {/* 3 stages cards */}
        <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
          {stages.map((stage, sIdx) => {
            const pt = stage.point;
            return (
              <div key={sIdx} className={`border ${stage.border} ${stage.bg} p-3.5 rounded-xl flex flex-col justify-between gap-3`}>
                <div className="flex items-center justify-between border-b border-slate-800 pb-2">
                  <span className={`text-[11px] font-bold ${stage.color} uppercase tracking-wider`}>{stage.label}</span>
                  <span className="text-[10px] font-mono text-slate-400">{pt.timestamp}</span>
                </div>

                <div className="flex flex-col gap-1 text-xs">
                  <div className="flex justify-between">
                    <span className="text-slate-400">Intensity (RMS dB):</span>
                    <span className="font-mono text-white font-bold">{pt.rmsDb} dB</span>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-slate-400">Dominant Pitch:</span>
                    <span className="font-mono text-white font-bold">{Math.round(pt.peakFrequencyHz)} Hz</span>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-slate-400">Equivalent Note:</span>
                    <span className="font-mono font-bold text-amber-300">{pt.peakNoteName}</span>
                  </div>
                </div>

                {/* Energy bars */}
                <div className="flex flex-col gap-1.5 border-t border-slate-800/50 pt-2 text-[10px]">
                  <div className="flex justify-between items-center">
                    <span className="text-slate-400">Bass Energy</span>
                    <span className="font-mono font-semibold text-slate-300">{pt.bass}%</span>
                  </div>
                  <div className="w-full h-1 bg-slate-950 rounded overflow-hidden">
                    <div className="h-full bg-blue-500 rounded" style={{ width: `${pt.bass}%` }} />
                  </div>

                  <div className="flex justify-between items-center mt-1">
                    <span className="text-slate-400">Midrange Energy</span>
                    <span className="font-mono font-semibold text-slate-300">{pt.mid}%</span>
                  </div>
                  <div className="w-full h-1 bg-slate-950 rounded overflow-hidden">
                    <div className="h-full bg-emerald-500 rounded" style={{ width: `${pt.mid}%` }} />
                  </div>

                  <div className="flex justify-between items-center mt-1">
                    <span className="text-slate-400">Treble Energy</span>
                    <span className="font-mono font-semibold text-slate-300">{pt.treble}%</span>
                  </div>
                  <div className="w-full h-1 bg-slate-950 rounded overflow-hidden">
                    <div className="h-full bg-rose-500 rounded" style={{ width: `${pt.treble}%` }} />
                  </div>
                </div>
              </div>
            );
          })}
        </div>

        {/* Drift calculations block */}
        <div className="bg-slate-950 border border-slate-800/80 p-3 rounded-xl flex items-center justify-between text-xs flex-wrap gap-3">
          <div className="flex items-center gap-2">
            <TrendingUp className="w-4 h-4 text-cyan-400 shrink-0" />
            <span className="text-slate-300">
              Drift Delta (Start ➔ End): 
              <span className={`ml-2 font-bold font-mono ${summary.dbShift >= 0 ? 'text-emerald-400' : 'text-rose-400'}`}>
                {summary.dbShift >= 0 ? `+${summary.dbShift}` : summary.dbShift} dB
              </span>
              <span className="text-slate-500 mx-1">|</span>
              <span className={`font-bold font-mono ${summary.freqShiftHz >= 0 ? 'text-cyan-400' : 'text-indigo-400'}`}>
                {summary.freqShiftHz >= 0 ? `+${Math.round(summary.freqShiftHz)}` : Math.round(summary.freqShiftHz)} Hz shift
              </span>
            </span>
          </div>

          <div className="px-2.5 py-1 rounded bg-slate-900 border border-slate-800/50 text-[10px] text-slate-400 flex items-center gap-1">
            <span>Overall Behavior:</span>
            <span className="text-amber-300 font-bold">{summary.soundBehavior}</span>
          </div>
        </div>
      </div>
    );
  };

  return (
    <div className="bg-slate-900/90 border border-slate-800/80 rounded-2xl p-5 shadow-xl backdrop-blur-md flex flex-col gap-4">
      {/* Header */}
      <div className="flex items-center justify-between border-b border-slate-800 pb-3 flex-wrap gap-2">
        <div className="flex items-center gap-2.5">
          <div className="p-2 rounded-xl bg-gradient-to-tr from-cyan-500/20 to-indigo-500/20 border border-cyan-500/30 text-cyan-300">
            <History className="w-5 h-5" />
          </div>
          <div>
            <h3 className="text-sm font-semibold text-white tracking-wide flex items-center gap-2">
              Continuous Sound Timeline Profiler
              <span className="px-2 py-0.5 rounded-full text-[10px] font-bold bg-cyan-500/20 border border-cyan-500/40 text-cyan-300">
                TIME ANALYZER
              </span>
            </h3>
            <p className="text-xs text-slate-400">
              Record over a period of time to track frequency, pitch drift, and amplitude evolution
            </p>
          </div>
        </div>

        {isProfiling && (
          <div className="flex items-center gap-2 bg-rose-500/10 px-3 py-1 rounded-full border border-rose-500/20">
            <span className="relative flex h-2.5 w-2.5">
              <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-rose-400 opacity-75"></span>
              <span className="relative inline-flex rounded-full h-2.5 w-2.5 bg-rose-500"></span>
            </span>
            <span className="text-xs font-bold text-rose-400 uppercase tracking-wider font-mono">
              PROFILING: {elapsedTime.toFixed(1)}s
            </span>
          </div>
        )}
      </div>

      {/* Profiler Controls Grid */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-3 bg-slate-950 p-4 rounded-xl border border-slate-800/80">
        {/* Dropdown 1: Target Duration */}
        <div className="flex flex-col gap-1.5">
          <label className="text-[10px] font-bold text-slate-500 uppercase tracking-wider flex items-center gap-1">
            <Clock className="w-3 h-3 text-slate-400" /> Profiling Duration
          </label>
          <select
            value={targetDuration}
            onChange={(e) => setTargetDuration(Number(e.target.value))}
            disabled={isProfiling}
            className="bg-slate-900 border border-slate-800 text-slate-200 text-xs rounded-lg p-2 focus:outline-none focus:border-cyan-500 transition-all cursor-pointer disabled:opacity-50"
          >
            <option value={0}>Free Run (Manual Stop)</option>
            <option value={10}>10 Seconds Capture</option>
            <option value={20}>20 Seconds Capture</option>
            <option value={30}>30 Seconds Capture</option>
            <option value={60}>60 Seconds Capture</option>
          </select>
        </div>

        {/* Dropdown 2: Sampling Frequency */}
        <div className="flex flex-col gap-1.5">
          <label className="text-[10px] font-bold text-slate-500 uppercase tracking-wider flex items-center gap-1">
            <Radio className="w-3 h-3 text-slate-400" /> Measurement Sample Rate
          </label>
          <select
            value={sampleInterval}
            onChange={(e) => setSampleInterval(Number(e.target.value))}
            disabled={isProfiling}
            className="bg-slate-900 border border-slate-800 text-slate-200 text-xs rounded-lg p-2 focus:outline-none focus:border-cyan-500 transition-all cursor-pointer disabled:opacity-50"
          >
            <option value={250}>Fast (4 Samples/sec)</option>
            <option value={500}>Balanced (2 Samples/sec)</option>
            <option value={1000}>Detailed (1 Sample/sec)</option>
            <option value={2000}>Eco (1 Sample / 2s)</option>
          </select>
        </div>

        {/* Action Button */}
        <div className="flex flex-col justify-end">
          {!isProfiling ? (
            <button
              onClick={startProfiling}
              disabled={!isListening}
              id="btn-start-timeline-profiler"
              className="w-full py-2 px-3 rounded-lg bg-cyan-500/10 hover:bg-cyan-500/25 border border-cyan-500/30 text-cyan-300 font-bold text-xs flex items-center justify-center gap-2 transition-all disabled:opacity-40 disabled:cursor-not-allowed cursor-pointer"
              title={isListening ? 'Start logging audio timeline' : 'Please play/synthesize audio or enable microphone first'}
            >
              <Play className="w-3.5 h-3.5" />
              Start Logging Timeline
            </button>
          ) : (
            <button
              onClick={stopProfiling}
              id="btn-stop-timeline-profiler"
              className="w-full py-2 px-3 rounded-lg bg-rose-500/20 hover:bg-rose-500/30 border border-rose-500/50 text-rose-300 font-bold text-xs flex items-center justify-center gap-2 transition-all cursor-pointer"
            >
              <Square className="w-3.5 h-3.5" />
              Stop & Finalize Analysis
            </button>
          )}
        </div>
      </div>

      {/* Profiler Display & Interactive Panel */}
      {profileHistory.length > 0 ? (
        <div className="flex flex-col gap-4">
          {/* Section Selector Tabs */}
          <div className="flex border-b border-slate-800 gap-1 pb-px overflow-x-auto">
            <button
              onClick={() => setActiveTab('timeline')}
              className={`pb-2 px-3 text-xs font-semibold border-b-2 transition-all shrink-0 cursor-pointer ${
                activeTab === 'timeline'
                  ? 'border-cyan-500 text-cyan-400'
                  : 'border-transparent text-slate-400 hover:text-slate-200'
              }`}
            >
              Volume & Pitch Timeline
            </button>
            <button
              onClick={() => setActiveTab('waterfall')}
              className={`pb-2 px-3 text-xs font-semibold border-b-2 transition-all shrink-0 cursor-pointer ${
                activeTab === 'waterfall'
                  ? 'border-cyan-500 text-cyan-400'
                  : 'border-transparent text-slate-400 hover:text-slate-200'
              }`}
            >
              Band Energy Heatmap
            </button>
            <button
              onClick={() => setActiveTab('comparison')}
              className={`pb-2 px-3 text-xs font-semibold border-b-2 transition-all shrink-0 cursor-pointer ${
                activeTab === 'comparison'
                  ? 'border-cyan-500 text-cyan-400'
                  : 'border-transparent text-slate-400 hover:text-slate-200'
              }`}
            >
              Start ➔ Mid ➔ End Signatures
            </button>
          </div>

          {/* Render Tab Contents */}
          <div className="pt-2">
            {activeTab === 'timeline' && renderLineChart()}
            {activeTab === 'waterfall' && renderWaterfallChart()}
            {activeTab === 'comparison' && renderComparisonChart()}
          </div>

          {/* Dynamic Descriptive Summary Cards */}
          {summary && (
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3 border-t border-slate-800/60 pt-4">
              {/* Start State */}
              <div className="bg-slate-950 p-3 rounded-xl border border-slate-800/50 flex flex-col justify-between">
                <div>
                  <span className="text-[10px] font-bold text-slate-500 uppercase tracking-wider block mb-1">
                    Starting Profile
                  </span>
                  <div className="text-sm font-semibold text-white flex items-center gap-1">
                    <Volume2 className="w-3.5 h-3.5 text-cyan-400" />
                    {summary.startPoint.rmsDb} dB
                  </div>
                  <div className="text-xs text-slate-400 mt-1">
                    Dominant: {summary.startPoint.peakNoteName} ({Math.round(summary.startPoint.peakFrequencyHz)} Hz)
                  </div>
                </div>
                <div className="text-[10px] text-slate-500 mt-2 pt-1 border-t border-slate-900">
                  Dominant Band: <span className="text-cyan-300 font-semibold">{summary.startDominantBand}</span>
                </div>
              </div>

              {/* End State */}
              <div className="bg-slate-950 p-3 rounded-xl border border-slate-800/50 flex flex-col justify-between">
                <div>
                  <span className="text-[10px] font-bold text-slate-500 uppercase tracking-wider block mb-1">
                    Ending Profile
                  </span>
                  <div className="text-sm font-semibold text-white flex items-center gap-1">
                    <Volume2 className="w-3.5 h-3.5 text-emerald-400" />
                    {summary.endPoint.rmsDb} dB
                  </div>
                  <div className="text-xs text-slate-400 mt-1">
                    Dominant: {summary.endPoint.peakNoteName} ({Math.round(summary.endPoint.peakFrequencyHz)} Hz)
                  </div>
                </div>
                <div className="text-[10px] text-slate-500 mt-2 pt-1 border-t border-slate-900">
                  Dominant Band: <span className="text-emerald-300 font-semibold">{summary.endDominantBand}</span>
                </div>
              </div>

              {/* Peak Spike Moment */}
              <div className="bg-slate-950 p-3 rounded-xl border border-slate-800/50 flex flex-col justify-between">
                <div>
                  <span className="text-[10px] font-bold text-slate-500 uppercase tracking-wider block mb-1">
                    Peak Signal Spike
                  </span>
                  <div className="text-sm font-semibold text-amber-400 flex items-center gap-1">
                    <Zap className="w-3.5 h-3.5 text-amber-400" />
                    {summary.maxRms} dB
                  </div>
                  <div className="text-xs text-slate-400 mt-1">
                    Occurred at <span className="font-mono text-white">{summary.loudestPoint.elapsedTimeSec}s</span>
                  </div>
                </div>
                <div className="text-[10px] text-slate-500 mt-2 pt-1 border-t border-slate-900">
                  Hz at Spike: <span className="text-amber-300 font-semibold">{Math.round(summary.loudestPoint.peakFrequencyHz)} Hz</span>
                </div>
              </div>

              {/* Overall Evolution Verdict */}
              <div className="bg-slate-950 p-3 rounded-xl border border-slate-800/50 flex flex-col justify-between">
                <div>
                  <span className="text-[10px] font-bold text-slate-500 uppercase tracking-wider block mb-1">
                    Evolution Verdict
                  </span>
                  <div className="text-sm font-bold text-indigo-300 flex items-center gap-1">
                    <Compass className="w-3.5 h-3.5 text-indigo-400" />
                    {summary.soundBehavior}
                  </div>
                  <div className="text-xs text-slate-400 mt-1">
                    Total recorded duration: <span className="font-mono text-white">{elapsedTime.toFixed(1)}s</span>
                  </div>
                </div>
                <div className="text-[10px] text-slate-500 mt-2 pt-1 border-t border-slate-900">
                  Drift Rate: <span className="text-indigo-300 font-semibold">{(summary.freqShiftHz / (elapsedTime || 1)).toFixed(1)} Hz/s</span>
                </div>
              </div>
            </div>
          )}

          {/* Reset profile state */}
          <div className="flex justify-end pt-1">
            <button
              onClick={() => setProfileHistory([])}
              id="btn-clear-timeline-profiler"
              className="px-3 py-1.5 rounded-lg bg-slate-950 border border-slate-800 hover:bg-slate-850 hover:border-slate-700 text-slate-400 hover:text-slate-200 text-xs font-semibold flex items-center gap-1.5 transition-all cursor-pointer"
            >
              <Trash2 className="w-3.5 h-3.5 text-slate-500" />
              Clear Profile History
            </button>
          </div>
        </div>
      ) : (
        /* Empty State */
        <div className="bg-slate-950/60 rounded-xl border border-slate-850 p-8 text-center flex flex-col items-center justify-center gap-2">
          <History className="w-8 h-8 text-slate-700 animate-pulse" />
          <h4 className="text-xs font-bold text-slate-300">Continuous Profiling Ready</h4>
          <p className="text-xs text-slate-400 max-w-sm leading-relaxed">
            Configure your profiling duration, then click "Start Logging Timeline" while audio is active to see a real-time, interactive stream of how the sound's volume and pitch change from start to finish.
          </p>
        </div>
      )}
    </div>
  );
};
