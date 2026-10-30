import React, { useState, useEffect, useRef } from 'react';
import { 
  Bookmark, 
  AlertOctagon, 
  PlusCircle, 
  Trash2, 
  Download, 
  Tag, 
  Clock, 
  Check, 
  Copy,
  Radio
} from 'lucide-react';
import { AudioMetrics } from '../types';

interface EventAnomalyLogProps {
  metrics: AudioMetrics;
  currentTime: number;
  isPlaying: boolean;
}

export interface AudioLogEvent {
  id: string;
  timestampSec: number;
  formattedTime: string;
  type: 'anomaly' | 'manual' | 'peak' | 'clipping';
  severity: 'low' | 'medium' | 'high';
  title: string;
  details: string;
  rmsDb: number;
  peakHz: number;
}

export const EventAnomalyLog: React.FC<EventAnomalyLogProps> = ({
  metrics,
  currentTime,
  isPlaying,
}) => {
  const [events, setEvents] = useState<AudioLogEvent[]>([]);
  const [filterType, setFilterType] = useState<'all' | 'anomaly' | 'manual'>('all');
  const [manualNoteText, setManualNoteText] = useState<string>('');
  const [copiedId, setCopiedId] = useState<string | null>(null);
  const [autoDetect, setAutoDetect] = useState<boolean>(true);

  // Rolling baseline & Schmitt-trigger hysteresis refs to prevent false-positive transient spam
  const smoothedRmsRef = useRef<number>(-70);
  const smoothedPeakRef = useRef<number>(-65);
  const isArmedRef = useRef<boolean>(true);
  const lastAnomalyWallTimeRef = useRef<number>(0);
  const lastClipWallTimeRef = useRef<number>(0);
  const warmupUntilRef = useRef<number>(performance.now() + 1500);

  const formatTimestamp = (totalSec: number): string => {
    if (totalSec <= 0.01) {
      return new Date().toLocaleTimeString([], { hour12: false, hour: '2-digit', minute: '2-digit', second: '2-digit' });
    }
    const mins = Math.floor(totalSec / 60);
    const secs = Math.floor(totalSec % 60);
    const ms = Math.floor((totalSec % 1) * 10);
    return `${mins.toString().padStart(2, '0')}:${secs.toString().padStart(2, '0')}.${ms}`;
  };

  // Auto-detect acoustic anomalies using true onset rate-of-rise + Schmitt-trigger hysteresis
  useEffect(() => {
    if (!isPlaying || !autoDetect) return;

    const now = performance.now();
    const curRms = metrics.rmsDb > -99 ? metrics.rmsDb : -80;
    const curPeak = metrics.peakDb > -99 ? metrics.peakDb : -80;
    const prevRms = smoothedRmsRef.current;
    const prevPeak = smoothedPeakRef.current;

    const deltaRms = curRms - prevRms;
    const deltaPeak = curPeak - prevPeak;

    // Re-arm Schmitt trigger once signal drops back within 4 dB of rolling baseline
    if (!isArmedRef.current && curRms <= prevRms + 4) {
      isArmedRef.current = true;
    }

    // Trigger high transient spike anomaly ONLY on a sudden sharp onset well above baseline
    const isGenuineTransientSpike =
      now > warmupUntilRef.current &&
      isArmedRef.current &&
      now - lastAnomalyWallTimeRef.current >= 2500 &&
      deltaPeak >= 12 &&
      deltaRms >= 9 &&
      metrics.crestFactorDb >= 13 &&
      curPeak > -22;

    if (isGenuineTransientSpike) {
      lastAnomalyWallTimeRef.current = now;
      isArmedRef.current = false;

      const formattedTime = formatTimestamp(currentTime);
      const newEvent: AudioLogEvent = {
        id: `anomaly-${Date.now()}`,
        timestampSec: currentTime,
        formattedTime,
        type: 'anomaly',
        severity: curPeak > -6 ? 'high' : 'medium',
        title: `Transient Spike (+${Math.round(deltaPeak)} dB Onset / ${metrics.crestFactorDb} dB Crest)`,
        details: `Peak jumped to ${curPeak} dBFS at ${Math.round(metrics.peakFrequencyHz)} Hz (${metrics.peakNoteName})`,
        rmsDb: curRms,
        peakHz: Math.round(metrics.peakFrequencyHz),
      };

      setTimeout(() => {
        setEvents((prev) => [newEvent, ...prev].slice(0, 50));
      }, 0);
    } else {
      // Update rolling baseline on non-spike frames
      smoothedRmsRef.current = prevRms + 0.2 * (curRms - prevRms);
      smoothedPeakRef.current = prevPeak + 0.2 * (curPeak - prevPeak);
    }

    // Trigger digital clipping warning (with 2-second wall-clock debounce)
    if (now > warmupUntilRef.current && curPeak >= -0.8 && now - lastClipWallTimeRef.current >= 2000) {
      lastClipWallTimeRef.current = now;
      const formattedTime = formatTimestamp(currentTime);
      const newEvent: AudioLogEvent = {
        id: `clip-${Date.now()}`,
        timestampSec: currentTime,
        formattedTime,
        type: 'clipping',
        severity: 'high',
        title: 'Digital Signal Clipping Detected',
        details: `Signal hit ${curPeak} dBFS ceiling. Reduce input gain to avoid distortion.`,
        rmsDb: curRms,
        peakHz: Math.round(metrics.peakFrequencyHz),
      };

      setTimeout(() => {
        setEvents((prev) => [newEvent, ...prev].slice(0, 50));
      }, 0);
    }
  }, [metrics.peakDb, metrics.rmsDb, metrics.crestFactorDb, metrics.peakFrequencyHz, metrics.peakNoteName, isPlaying, currentTime, autoDetect]);

  const addManualBookmark = () => {
    const text = manualNoteText.trim() || 'Manual Audio Bookmark';
    const newEvent: AudioLogEvent = {
      id: `manual-${Date.now()}`,
      timestampSec: currentTime,
      formattedTime: formatTimestamp(currentTime),
      type: 'manual',
      severity: 'low',
      title: text,
      details: `Tagged at ${Math.round(metrics.peakFrequencyHz)} Hz, RMS ${metrics.rmsDb} dBFS`,
      rmsDb: metrics.rmsDb,
      peakHz: Math.round(metrics.peakFrequencyHz),
    };

    setEvents(prev => [newEvent, ...prev]);
    setManualNoteText('');
  };

  const deleteEvent = (id: string) => {
    setEvents(prev => prev.filter(e => e.id !== id));
  };

  const clearAllEvents = () => {
    setEvents([]);
  };

  const copyEventToClipboard = (event: AudioLogEvent) => {
    const str = `[${event.formattedTime}] ${event.title} - ${event.details}`;
    navigator.clipboard.writeText(str);
    setCopiedId(event.id);
    setTimeout(() => setCopiedId(null), 1500);
  };

  const exportCsv = () => {
    if (events.length === 0) return;
    const header = 'Timestamp,Type,Severity,Title,Details,RMS_dB,Peak_Hz\n';
    const rows = events.map(e => 
      `"${e.formattedTime}","${e.type}","${e.severity}","${e.title.replace(/"/g, '""')}","${e.details.replace(/"/g, '""')}",${e.rmsDb},${e.peakHz}`
    ).join('\n');

    const blob = new Blob([header + rows], { type: 'text/csv' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `audio_anomaly_log_${Date.now()}.csv`;
    a.click();
    URL.revokeObjectURL(url);
  };

  const filteredEvents = events.filter(e => {
    if (filterType === 'anomaly') return e.type === 'anomaly' || e.type === 'clipping';
    if (filterType === 'manual') return e.type === 'manual';
    return true;
  });

  return (
    <div className="bg-slate-900/90 border border-slate-800/80 rounded-2xl p-5 shadow-xl backdrop-blur-md flex flex-col gap-4">
      {/* Header */}
      <div className="flex items-center justify-between border-b border-slate-800 pb-3 flex-wrap gap-2">
        <div className="flex items-center gap-2.5">
          <div className="p-2 rounded-xl bg-gradient-to-tr from-purple-500/20 to-pink-500/20 border border-purple-500/30 text-purple-300">
            <Bookmark className="w-5 h-5" />
          </div>
          <div>
            <h3 className="text-sm font-semibold text-white tracking-wide flex items-center gap-2">
              Audio Bookmark & Event Anomaly Log
              <span className="px-2 py-0.5 rounded-full text-[10px] font-bold bg-purple-500/20 border border-purple-500/40 text-purple-300">
                {events.length} LOGGED EVENTS
              </span>
            </h3>
            <p className="text-xs text-slate-400">
              Auto-flags transient spikes and clipping anomalies while letting you tag custom timestamped bookmarks
            </p>
          </div>
        </div>

        <div className="flex items-center gap-2 flex-wrap">
          <button
            onClick={() => setAutoDetect(!autoDetect)}
            className={`px-3 py-1.5 rounded-lg border text-xs font-semibold flex items-center gap-1.5 transition-all cursor-pointer ${
              autoDetect
                ? 'bg-amber-500/15 border-amber-500/40 text-amber-300'
                : 'bg-slate-900 border-slate-800 text-slate-400 hover:text-slate-200'
            }`}
            title="Toggle automatic transient spike & clipping anomaly detection"
          >
            <Radio className={`w-3.5 h-3.5 ${autoDetect ? 'text-amber-400 animate-pulse' : 'text-slate-500'}`} />
            {autoDetect ? 'Auto-Detect: ON' : 'Auto-Detect: OFF'}
          </button>
          <button
            onClick={exportCsv}
            disabled={events.length === 0}
            className="px-3 py-1.5 rounded-lg bg-slate-800 hover:bg-slate-700 border border-slate-700 text-slate-200 text-xs font-semibold flex items-center gap-1.5 transition-all disabled:opacity-40 cursor-pointer"
          >
            <Download className="w-3.5 h-3.5" />
            Export CSV
          </button>
          <button
            onClick={clearAllEvents}
            disabled={events.length === 0}
            className="px-3 py-1.5 rounded-lg bg-rose-500/10 hover:bg-rose-500/20 border border-rose-500/30 text-rose-300 text-xs font-semibold flex items-center gap-1.5 transition-all disabled:opacity-40 cursor-pointer"
          >
            <Trash2 className="w-3.5 h-3.5" />
            Clear
          </button>
        </div>
      </div>

      {/* Manual Tag Input Bar */}
      <div className="flex items-center gap-2 bg-slate-950 p-2.5 rounded-xl border border-slate-800">
        <div className="flex items-center gap-1.5 px-2 text-slate-400 text-xs font-mono shrink-0">
          <Clock className="w-3.5 h-3.5 text-purple-400" />
          {formatTimestamp(currentTime)}
        </div>
        <input
          type="text"
          value={manualNoteText}
          onChange={(e) => setManualNoteText(e.target.value)}
          placeholder="Type custom note (e.g. 'Door slam', 'Guitar solo', 'Breath pop')..."
          onKeyDown={(e) => e.key === 'Enter' && addManualBookmark()}
          className="w-full bg-slate-900 border border-slate-800 text-slate-200 text-xs rounded-lg px-3 py-1.5 focus:outline-none focus:border-purple-500"
        />
        <button
          onClick={addManualBookmark}
          id="btn-add-audio-bookmark"
          className="px-4 py-1.5 rounded-lg bg-purple-600 hover:bg-purple-500 text-white font-bold text-xs shrink-0 flex items-center gap-1.5 transition-all cursor-pointer"
        >
          <PlusCircle className="w-3.5 h-3.5" />
          Add Bookmark
        </button>
      </div>

      {/* Filter Tabs */}
      <div className="flex items-center justify-between text-xs border-b border-slate-800 pb-2">
        <div className="flex gap-2">
          <button
            onClick={() => setFilterType('all')}
            className={`px-3 py-1 rounded-lg font-medium transition-all cursor-pointer ${
              filterType === 'all' ? 'bg-purple-500/20 text-purple-300 border border-purple-500/40' : 'text-slate-400 hover:text-slate-200'
            }`}
          >
            All Events ({events.length})
          </button>
          <button
            onClick={() => setFilterType('anomaly')}
            className={`px-3 py-1 rounded-lg font-medium transition-all cursor-pointer ${
              filterType === 'anomaly' ? 'bg-amber-500/20 text-amber-300 border border-amber-500/40' : 'text-slate-400 hover:text-slate-200'
            }`}
          >
            Anomalies ({events.filter(e => e.type !== 'manual').length})
          </button>
          <button
            onClick={() => setFilterType('manual')}
            className={`px-3 py-1 rounded-lg font-medium transition-all cursor-pointer ${
              filterType === 'manual' ? 'bg-cyan-500/20 text-cyan-300 border border-cyan-500/40' : 'text-slate-400 hover:text-slate-200'
            }`}
          >
            Bookmarks ({events.filter(e => e.type === 'manual').length})
          </button>
        </div>
      </div>

      {/* Event List */}
      {filteredEvents.length > 0 ? (
        <div className="flex flex-col gap-2 max-h-64 overflow-y-auto pr-1">
          {filteredEvents.map((ev) => (
            <div
              key={ev.id}
              className={`p-3 rounded-xl border flex items-center justify-between gap-3 transition-all ${
                ev.type === 'clipping'
                  ? 'bg-rose-950/30 border-rose-500/40'
                  : ev.type === 'anomaly'
                  ? 'bg-amber-950/20 border-amber-500/30'
                  : 'bg-slate-950 border-slate-800'
              }`}
            >
              <div className="flex items-start gap-3">
                <div className={`p-2 rounded-lg shrink-0 ${
                  ev.type === 'clipping'
                    ? 'bg-rose-500/20 text-rose-400'
                    : ev.type === 'anomaly'
                    ? 'bg-amber-500/20 text-amber-400'
                    : 'bg-purple-500/20 text-purple-400'
                }`}>
                  {ev.type === 'manual' ? <Tag className="w-4 h-4" /> : <AlertOctagon className="w-4 h-4" />}
                </div>

                <div>
                  <div className="flex items-center gap-2">
                    <span className="font-mono text-xs font-bold text-white bg-slate-900 px-2 py-0.5 rounded border border-slate-800">
                      {ev.formattedTime}
                    </span>
                    <h4 className="text-xs font-bold text-slate-200">{ev.title}</h4>
                  </div>
                  <p className="text-[11px] text-slate-400 mt-1">{ev.details}</p>
                </div>
              </div>

              <div className="flex items-center gap-2 shrink-0">
                <button
                  onClick={() => copyEventToClipboard(ev)}
                  title="Copy Event Info"
                  className="p-1.5 rounded-lg bg-slate-800 hover:bg-slate-700 text-slate-300 transition-all cursor-pointer"
                >
                  {copiedId === ev.id ? <Check className="w-3.5 h-3.5 text-emerald-400" /> : <Copy className="w-3.5 h-3.5" />}
                </button>
                <button
                  onClick={() => deleteEvent(ev.id)}
                  title="Delete Event"
                  className="p-1.5 rounded-lg bg-slate-800 hover:bg-rose-500/20 text-slate-400 hover:text-rose-300 transition-all cursor-pointer"
                >
                  <Trash2 className="w-3.5 h-3.5" />
                </button>
              </div>
            </div>
          ))}
        </div>
      ) : (
        <div className="bg-slate-950/60 rounded-xl border border-slate-850 p-6 text-center text-xs text-slate-500">
          No events logged yet. Play audio to automatically detect transient spikes, or click 'Add Bookmark' above.
        </div>
      )}
    </div>
  );
};
