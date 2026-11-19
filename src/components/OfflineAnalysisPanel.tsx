import React, { useEffect, useRef, useState } from 'react';
import { FileSearch, Loader2, AlertCircle } from 'lucide-react';
import { AudioEngineState } from '../types';
import type { OfflineAnalysisResult } from '../dsp/offline';
import { frequencyToNote } from '../utils/audioPresets';

interface Props {
  engineState: AudioEngineState;
  getAudioBuffer: () => AudioBuffer | null;
  minFreqHz: number;
  maxFreqHz: number;
}

const fmt = (v: number | null | undefined, d = 1, unit = '') =>
  v === null || v === undefined || !isFinite(v) ? '---' : `${v.toFixed(d)}${unit}`;
const fmtTime = (sec: number) => {
  const m = Math.floor(sec / 60);
  const s = sec - m * 60;
  return `${String(m).padStart(2, '0')}:${s.toFixed(1).padStart(4, '0')}`;
};

/** Whole-file analysis in a Web Worker: high-resolution peaks, binaural carrier, BS.1770 loudness, true peak, tempo, key. */
export const OfflineAnalysisPanel: React.FC<Props> = ({ engineState, getAudioBuffer, minFreqHz, maxFreqHz }) => {
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [result, setResult] = useState<OfflineAnalysisResult | null>(null);
  const [analyzedName, setAnalyzedName] = useState<string | null>(null);
  const workerRef = useRef<Worker | null>(null);
  const reqRef = useRef(0);

  const canAnalyze = engineState.sourceType === 'file' || engineState.sourceType === 'url' || engineState.sourceType === 'sample';
  const sourceName = engineState.sourceType === 'sample' ? `Built-in sample (${engineState.activeSampleId})` : engineState.fileName || 'Audio';

  // Results belong to one source; clear them when the source changes.
  useEffect(() => {
    setResult(null);
    setError(null);
  }, [engineState.fileName, engineState.sourceType, engineState.activeSampleId]);

  useEffect(() => () => workerRef.current?.terminate(), []);

  const run = () => {
    const buffer = getAudioBuffer();
    if (!buffer) {
      setError('No decoded audio is loaded. Load a file first.');
      return;
    }
    setBusy(true);
    setError(null);
    if (!workerRef.current) {
      workerRef.current = new Worker(new URL('../dsp/offline.worker.ts', import.meta.url), { type: 'module' });
    }
    const id = ++reqRef.current;
    const channels: Float32Array[] = [];
    for (let c = 0; c < Math.min(2, buffer.numberOfChannels); c++) channels.push(buffer.getChannelData(c).slice());
    const name = sourceName;
    workerRef.current.onmessage = (e: MessageEvent<{ id: number; ok: boolean; result?: OfflineAnalysisResult; error?: string }>) => {
      if (e.data.id !== reqRef.current) return;
      setBusy(false);
      if (e.data.ok && e.data.result) {
        setResult(e.data.result);
        setAnalyzedName(name);
      } else {
        setError(e.data.error || 'Analysis failed');
      }
    };
    workerRef.current.onerror = (ev) => {
      setBusy(false);
      setError(ev.message || 'Analysis worker failed');
    };
    workerRef.current.postMessage(
      { id, channels, sampleRate: buffer.sampleRate, minHz: minFreqHz, maxHz: maxFreqHz },
      channels.map((c) => c.buffer)
    );
  };

  const peakRow = (label: string, peaks: OfflineAnalysisResult['peaksL']) => (
    <div className="flex flex-col gap-1">
      <span className="text-[10px] font-bold text-slate-400 uppercase tracking-wider">{label}</span>
      {peaks.length === 0 ? (
        <span className="text-[11px] text-slate-500">No peak in span</span>
      ) : (
        <div className="flex flex-wrap gap-1">
          {peaks.slice(0, 8).map((p) => (
            <span key={`${label}-${p.bin}`} className="px-1.5 py-0.5 rounded bg-slate-900 border border-slate-800 text-[10px] font-mono tabular-nums text-slate-200">
              {p.hz >= 1000 ? `${(p.hz / 1000).toFixed(4)} kHz` : `${p.hz.toFixed(3)} Hz`}
              <span className="text-slate-500"> {p.db.toFixed(1)} dB · {frequencyToNote(p.hz).note}{frequencyToNote(p.hz).octave}</span>
            </span>
          ))}
        </div>
      )}
    </div>
  );

  const r = result;
  return (
    <div id="offline-analysis-panel" className="bg-slate-900/90 rounded-2xl border border-slate-800 p-4 sm:p-5 shadow-xl flex flex-col gap-3">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <div className="flex items-center gap-2">
          <FileSearch className="w-4 h-4 text-violet-300" />
          <div>
            <h3 className="text-sm font-extrabold text-white">Offline file analysis</h3>
            <p className="text-[11px] text-slate-400">Whole file, high resolution. Loudness per ITU-R BS.1770-4 / EBU R128.</p>
          </div>
        </div>
        <button
          id="btn-offline-analyze"
          onClick={run}
          disabled={!canAnalyze || busy}
          className="px-3 py-1.5 rounded-lg bg-violet-500/20 hover:bg-violet-500/30 disabled:opacity-40 disabled:cursor-not-allowed border border-violet-500/40 text-violet-200 text-xs font-bold flex items-center gap-1.5 cursor-pointer"
        >
          {busy ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <FileSearch className="w-3.5 h-3.5" />}
          {busy ? 'Analyzing…' : 'Analyze whole file'}
        </button>
      </div>

      {!canAnalyze && (
        <p className="text-[11px] text-slate-500">Available for files, direct audio URLs and the built-in samples. Live mic and tab capture have no file to analyze.</p>
      )}
      {error && (
        <div className="p-2 rounded-lg bg-rose-500/10 border border-rose-500/30 text-rose-300 text-[11px] flex items-center gap-1.5">
          <AlertCircle className="w-3.5 h-3.5" /> {error}
        </div>
      )}

      {r && (
        <div id="offline-results" className="flex flex-col gap-3">
          <div className="text-[10px] font-mono text-violet-300">
            OFFLINE · WHOLE FILE · {analyzedName} · {r.sampleRate} Hz · {r.channelCount} ch · peaks from a {r.segment.lengthSec.toFixed(1)} s segment at {r.segment.resolutionHz.toFixed(3)} Hz/bin · {(r.elapsedMs / 1000).toFixed(1)} s
          </div>
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-1.5 text-center">
            {[
              ['Duration', fmtTime(r.durationSec), 'offline-duration'],
              ['Integrated', fmt(r.loudness.integratedLufs, 1, ' LUFS'), 'offline-lufs'],
              ['Loudness range', fmt(r.loudness.lraLu, 1, ' LU'), 'offline-lra'],
              ['Max short-term', fmt(r.loudness.maxShortTermLufs, 1, ' LUFS'), 'offline-st'],
              ['Sample peak', fmt(r.samplePeakDb, 2, ' dBFS'), 'offline-sample-peak'],
              ['True peak', fmt(r.truePeakDb, 2, ' dBTP'), 'offline-true-peak'],
              ['RMS', fmt(r.rmsDb, 2, ' dBFS'), 'offline-rms'],
              [
                'Tempo',
                r.tempo && r.tempo.hasClearBeat ? `${r.tempo.bpm.toFixed(1)} BPM` : 'No clear beat',
                'offline-tempo',
              ],
            ].map(([label, value, id]) => (
              <div key={id} className="bg-slate-950 rounded-lg p-1.5 border border-slate-800">
                <div className="text-[10px] text-slate-400">{label}</div>
                <div id={id} className="text-xs font-mono tabular-nums font-bold text-slate-100 mt-0.5">{value}</div>
              </div>
            ))}
          </div>
          <div className="flex flex-wrap gap-x-4 gap-y-1 text-[11px] text-slate-300">
            <span>
              Key: <strong id="offline-key" className="text-amber-300">{r.key ? r.key.key : '---'}</strong>
              {r.key && r.key.confidence < 0.05 && <span className="text-slate-500"> (low confidence; runner-up {r.key.runnerUp})</span>}
            </span>
            {r.tempo?.hasClearBeat && r.tempo.foldedFromBpm && (
              <span id="offline-tempo-note" className="text-slate-400">
                Half-time reading; strongest pulse at {r.tempo.foldedFromBpm.toFixed(1)} BPM (double-time)
              </span>
            )}
          </div>
          {r.stereo && (
            <div id="offline-stereo" className="text-[11px] text-slate-300 font-mono tabular-nums">
              {r.stereo.mode === 'binaural-pair' ? 'Binaural carrier' : 'Dominant tones'}: L {fmt(r.stereo.leftHz, 3, ' Hz')} · R {fmt(r.stereo.rightHz, 3, ' Hz')} ·{' '}
              {r.stereo.mode === 'binaural-pair' ? 'beat' : 'L−R'} {fmt(r.stereo.differenceHz, 3, ' Hz')} · correlation {fmt(r.stereo.correlation, 2)}
            </div>
          )}
          {peakRow(`Peaks left (${Math.round(minFreqHz)}–${Math.round(maxFreqHz)} Hz)`, r.peaksL)}
          {r.channelCount > 1 && peakRow('Peaks right', r.peaksR)}
        </div>
      )}
    </div>
  );
};
