import React, { useState, useEffect } from 'react';
import { 
  Bookmark, 
  AlertOctagon, 
  PlusCircle, 
  Trash2, 
  Download, 
  Tag, 
  Clock, 
  Zap, 
  Filter, 
  Check, 
  Copy,
  Info
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

  // Auto-detect acoustic anomalies (e.g., transient spike or peak above thresholds)
  useEffect(() => {
    if (!isPlaying) return;

    // Trigger high transient crest factor anomaly
    if (metrics.crestFactorDb > 18 && metrics.peakDb > -12) {
      const formattedTime = formatTimestamp(currentTime);
      const newEvent: AudioLogEvent = {
        id: `anomaly-${Date.now()}`,
        timestampSec: currentTime,
        formattedTime,
        type: 'anomaly',
        severity: metrics.peakDb > -3 ? 'high' : 'medium',
        title: `Transient Spike (+${metrics.crestFactorDb} dB Crest)`,
        details: `Peak level reached ${metrics.peakDb} dBFS at ${metrics.peakFrequencyHz} Hz (${metrics.peakNoteName})`,
        rmsDb: metrics.rmsDb,
        peakHz: metrics.peakFrequencyHz,
      };

      setTimeout(() => {
        setEvents(prev => {
          // Prevent duplicate spam within 1.5 seconds of last event
          const last = prev[0];
          if (last && Math.abs(last.timestampSec - currentTime) < 1.5) {
            return prev;
          }
          return [newEvent, ...prev].slice(0, 50); // Keep last 50
        });
      }, 0);
    }

    // Trigger clipping warning
    if (metrics.peakDb > -1) {
      const formattedTime = formatTimestamp(currentTime);
      const newEvent: AudioLogEvent = {
        id: `clip-${Date.now()}`,
        timestampSec: currentTime,
        formattedTime,
        type: 'clipping',
        severity: 'high',
        title: 'Digital Signal Clipping Detected',
        details: `Signal hit ${metrics.peakDb} dBFS limit. Reduce input gain to avoid distortion.`,
        rmsDb: metrics.rmsDb,
        peakHz: metrics.peakFrequencyHz,
      };

      setTimeout(() => {
        setEvents(prev => {
          const last = prev[0];
          if (last && Math.abs(last.timestampSec - currentTime) < 1.0) {
            return prev;
          }
          return [newEvent, ...prev].slice(0, 50);
        });
      }, 0);
    }
  }, [metrics.peakDb, metrics.crestFactorDb, isPlaying, currentTime]);

  const formatTimestamp = (totalSec: number): string => {
    const mins = Math.floor(totalSec / 60);
    const secs = Math.floor(totalSec % 60);
    const ms = Math.floor((totalSec % 1) * 10);
    return `${mins.toString().padStart(2, '0')}:${secs.toString().padStart(2, '0')}.${ms}`;
  };

  const addManualBookmark = () => {
    const text = manualNoteText.trim() || 'Manual Audio Bookmark';
    const newEvent: AudioLogEvent = {
      id: `manual-${Date.now()}`,
      timestampSec: currentTime,
      formattedTime: formatTimestamp(currentTime),
      type: 'manual',
      severity: 'low',
      title: text,
      details: `Tagged at ${metrics.peakFrequencyHz} Hz, RMS ${metrics.rmsDb} dBFS`,
      rmsDb: metrics.rmsDb,
      peakHz: metrics.peakFrequencyHz,
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

        <div className="flex items-center gap-2">
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
