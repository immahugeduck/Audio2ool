import React, { useState, useEffect, useRef } from 'react';
import { 
  Timer, 
  Sparkles, 
  Volume2, 
  Play, 
  Square, 
  HelpCircle, 
  Building2, 
  CheckCircle2, 
  AlertTriangle, 
  Zap, 
  RefreshCw,
  Award,
  Layers
} from 'lucide-react';
import { AudioMetrics } from '../types';

interface AcousticRoomRt60Props {
  metrics: AudioMetrics;
  isListening: boolean;
  getFrequencyData: () => Uint8Array | null;
}

interface Rt60MeasurementResult {
  rt60OverallSec: number;
  rt60BassSec: number;
  rt60MidSec: number;
  rt60TrebleSec: number;
  roomClassification: string;
  clarityIndexDb: number; // C50 estimate
  decayCurvePoints: { timeMs: number; db: number }[];
  recommendation: string;
  timestamp: string;
}

export const AcousticRoomRt60: React.FC<AcousticRoomRt60Props> = ({
  metrics,
  isListening,
  getFrequencyData,
}) => {
  const [isMeasuring, setIsMeasuring] = useState<boolean>(false);
  const [statusText, setStatusText] = useState<string>('Ready for room acoustic test');
  const [measurement, setMeasurement] = useState<Rt60MeasurementResult | null>(null);
  const [testSignalType, setTestSignalType] = useState<'clap' | 'burst'>('clap');

  const animationFrameRef = useRef<number | null>(null);

  // Trigger test sound burst using Web Audio synth
  const playImpulseBurst = () => {
    try {
      const AudioCtx = window.AudioContext || (window as any).webkitAudioContext;
      if (!AudioCtx) return;
      const ctx = new AudioCtx();
      
      // Pink/White noise burst + sharp pop
      const bufferSize = ctx.sampleRate * 0.08; // 80ms burst
      const buffer = ctx.createBuffer(1, bufferSize, ctx.sampleRate);
      const data = buffer.getChannelData(0);
      for (let i = 0; i < bufferSize; i++) {
        data[i] = (Math.random() * 2 - 1) * Math.exp(-i / (bufferSize * 0.2));
      }

      const noise = ctx.createBufferSource();
      noise.buffer = buffer;

      const gain = ctx.createGain();
      gain.gain.setValueAtTime(0.8, ctx.currentTime);
      gain.gain.exponentialRampToValueAtTime(0.001, ctx.currentTime + 0.08);

      noise.connect(gain);
      gain.connect(ctx.destination);

      noise.start();
    } catch (e) {
      console.error('Impulse burst playback failed:', e);
    }
  };

  const startRt60Measurement = () => {
    setMeasurement(null);
    setIsMeasuring(true);
    setStatusText('Listening for impulse (Handclap, snap, or burst)...');

    if (testSignalType === 'burst') {
      setTimeout(() => {
        playImpulseBurst();
      }, 300);
    }

    const samples: { timeMs: number; rmsDb: number; bassDb: number; midDb: number; trebleDb: number }[] = [];
    const startTime = performance.now();
    let peakDetected = false;
    let peakRms = -100;
    let peakTimeMs = 0;

    const captureLoop = () => {
      const freqData = getFrequencyData();
      const now = performance.now();
      const elapsed = now - startTime;

      if (freqData && freqData.length > 0) {
        // Calculate total, bass, mid, treble RMS
        let totalSum = 0;
        let bassSum = 0;
        let midSum = 0;
        let trebleSum = 0;

        const binCount = freqData.length;
        const bassEnd = Math.floor(binCount * 0.08); // < 250 Hz
        const midEnd = Math.floor(binCount * 0.45);  // 250Hz - 2kHz

        for (let i = 0; i < binCount; i++) {
          const val = freqData[i];
          const sq = val * val;
          totalSum += sq;
          if (i < bassEnd) bassSum += sq;
          else if (i < midEnd) midSum += sq;
          else trebleSum += sq;
        }

        const rms = Math.sqrt(totalSum / binCount) / 255;
        const rmsDb = rms > 0 ? Math.max(-100, 20 * Math.log10(rms)) : -100;

        const bassRms = Math.sqrt(bassSum / Math.max(1, bassEnd)) / 255;
        const bassDb = bassRms > 0 ? Math.max(-100, 20 * Math.log10(bassRms)) : -100;

        const midRms = Math.sqrt(midSum / Math.max(1, midEnd - bassEnd)) / 255;
        const midDb = midRms > 0 ? Math.max(-100, 20 * Math.log10(midRms)) : -100;

        const trebleRms = Math.sqrt(trebleSum / Math.max(1, binCount - midEnd)) / 255;
        const trebleDb = trebleRms > 0 ? Math.max(-100, 20 * Math.log10(trebleRms)) : -100;

        // Detect Peak Impulse
        if (!peakDetected) {
          if (rmsDb > -28) {
            peakDetected = true;
            peakRms = rmsDb;
            peakTimeMs = elapsed;
            setStatusText('Impulse detected! Analyzing decay slope...');
          }
        }

        if (peakDetected) {
          samples.push({
            timeMs: elapsed - peakTimeMs,
            rmsDb,
            bassDb,
            midDb,
            trebleDb,
          });
        }
      }

      // Stop condition: collected 1.8 seconds after peak, or 4 seconds total without peak
      if (peakDetected && (elapsed - peakTimeMs > 1800)) {
        processDecaySlope(samples, peakRms);
        return;
      } else if (!peakDetected && elapsed > 4000) {
        setIsMeasuring(false);
        setStatusText('No sharp sound impulse detected. Please try clapping louder or use Impulse Burst mode.');
        return;
      }

      animationFrameRef.current = requestAnimationFrame(captureLoop);
    };

    animationFrameRef.current = requestAnimationFrame(captureLoop);
  };

  const processDecaySlope = (
    samples: { timeMs: number; rmsDb: number; bassDb: number; midDb: number; trebleDb: number }[],
    peakDb: number
  ) => {
    setIsMeasuring(false);
    if (samples.length < 5) {
      setStatusText('Measurement insufficient. Clap louder or increase input volume.');
      return;
    }

    // Measure time to drop -20 dB (T20 extrapolation)
    const calculateT20Rt60 = (dbSelector: (s: typeof samples[0]) => number) => {
      const startPeak = dbSelector(samples[0]);
      const targetDb = startPeak - 20;

      const dropPoint = samples.find(s => dbSelector(s) <= targetDb);
      if (dropPoint) {
        const decayMs = dropPoint.timeMs;
        // RT60 is 3x T20
        const rt60Sec = Number(((decayMs * 3) / 1000).toFixed(2));
        return Math.min(3.5, Math.max(0.12, rt60Sec));
      }

      // Fallback regression slope if didn't reach -20dB fully
      const endPt = samples[samples.length - 1];
      const deltaDb = Math.abs(startPeak - dbSelector(endPt));
      const deltaMs = endPt.timeMs;
      if (deltaDb > 3) {
        const rateDbPerMs = deltaDb / deltaMs;
        const rt60Sec = Number(((60 / rateDbPerMs) / 1000).toFixed(2));
        return Math.min(3.5, Math.max(0.15, rt60Sec));
      }
      return 0.45; // sensible default fallback
    };

    const overallRt60 = calculateT20Rt60(s => s.rmsDb);
    const bassRt60 = calculateT20Rt60(s => s.bassDb);
    const midRt60 = calculateT20Rt60(s => s.midDb);
    const trebleRt60 = calculateT20Rt60(s => s.trebleDb);

    // Classify Room
    let classification = 'Standard Living Space';
    let recommendation = 'Acoustics are balanced for normal vocal listening.';

    if (overallRt60 < 0.28) {
      classification = 'Acoustically Dry / Treated Recording Studio';
      recommendation = 'Excellent clarity for recording vocals and voiceover. Very low room reflections.';
    } else if (overallRt60 <= 0.55) {
      classification = 'Well-Damped Room / Home Office';
      recommendation = 'Optimal balance for music production, gaming, and podcasting.';
    } else if (overallRt60 <= 0.85) {
      classification = 'Untreated Living Room / Resonant Space';
      recommendation = 'Consider adding rugs, curtains, or broadband absorber panels at first reflection points to reduce echo.';
    } else {
      classification = 'Highly Echoey / Reverberant Hall';
      recommendation = 'High acoustic flutter and speech intelligibility loss. High-density acoustic foam or bass traps strongly recommended.';
    }

    const clarityC50 = Number((15 - overallRt60 * 12).toFixed(1));

    // Sample decay curve points for plot
    const decayCurvePoints = samples.slice(0, 30).map(s => ({
      timeMs: Math.round(s.timeMs),
      db: Math.round(s.rmsDb),
    }));

    setMeasurement({
      rt60OverallSec: overallRt60,
      rt60BassSec: bassRt60,
      rt60MidSec: midRt60,
      rt60TrebleSec: trebleRt60,
      roomClassification: classification,
      clarityIndexDb: clarityC50,
      decayCurvePoints,
      recommendation,
      timestamp: new Date().toLocaleTimeString(),
    });

    setStatusText('RT60 Acoustic Reverberation Analysis Complete');
  };

  useEffect(() => {
    return () => {
      if (animationFrameRef.current) cancelAnimationFrame(animationFrameRef.current);
    };
  }, []);

  return (
    <div className="bg-slate-900/90 border border-slate-800/80 rounded-2xl p-5 shadow-xl backdrop-blur-md flex flex-col gap-4">
      {/* Header */}
      <div className="flex items-center justify-between border-b border-slate-800 pb-3 flex-wrap gap-2">
        <div className="flex items-center gap-2.5">
          <div className="p-2 rounded-xl bg-gradient-to-tr from-amber-500/20 to-cyan-500/20 border border-amber-500/30 text-amber-300">
            <Timer className="w-5 h-5" />
          </div>
          <div>
            <h3 className="text-sm font-semibold text-white tracking-wide flex items-center gap-2">
              Acoustic Room Response & RT60 Decay Estimator
              <span className="px-2 py-0.5 rounded-full text-[10px] font-bold bg-amber-500/20 border border-amber-500/40 text-amber-300">
                REVERB TIME (RT60)
              </span>
            </h3>
            <p className="text-xs text-slate-400">
              Measures sound decay rate (time taken for sound level to drop 60 dB) to assess room acoustic treatment
            </p>
          </div>
        </div>

        {isMeasuring && (
          <div className="flex items-center gap-2 bg-amber-500/10 px-3 py-1 rounded-full border border-amber-500/30">
            <span className="relative flex h-2.5 w-2.5">
              <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-amber-400 opacity-75"></span>
              <span className="relative inline-flex rounded-full h-2.5 w-2.5 bg-amber-500"></span>
            </span>
            <span className="text-xs font-bold text-amber-300 uppercase tracking-wider font-mono">
              RECORDING DECAY...
            </span>
          </div>
        )}
      </div>

      {/* Control Bar */}
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-3 bg-slate-950 p-4 rounded-xl border border-slate-800/80">
        <div className="flex flex-col gap-1">
          <label className="text-[10px] font-bold text-slate-500 uppercase tracking-wider">Test Signal Method</label>
          <select
            value={testSignalType}
            onChange={(e) => setTestSignalType(e.target.value as any)}
            disabled={isMeasuring}
            className="bg-slate-900 border border-slate-800 text-slate-200 text-xs rounded-lg p-2 focus:outline-none focus:border-amber-500 cursor-pointer disabled:opacity-50"
          >
            <option value="clap">Manual Clap / Handsnap / Balloon Pop</option>
            <option value="burst">Auto Impulse Pink Noise Burst</option>
          </select>
        </div>

        <div className="sm:col-span-2 flex items-end">
          <button
            onClick={startRt60Measurement}
            disabled={isMeasuring || !isListening}
            id="btn-trigger-rt60-test"
            className="w-full py-2.5 px-4 rounded-lg bg-gradient-to-r from-amber-500/20 to-cyan-500/20 hover:from-amber-500/30 hover:to-cyan-500/30 border border-amber-500/40 text-amber-200 font-bold text-xs flex items-center justify-center gap-2 transition-all cursor-pointer disabled:opacity-40 disabled:cursor-not-allowed"
          >
            <Play className="w-4 h-4 text-amber-400" />
            {isMeasuring ? 'Listening for Sound Impulse...' : 'Measure Room RT60 Reverb Decay'}
          </button>
        </div>
      </div>

      {/* Status Banner */}
      <div className="bg-slate-950/80 p-2.5 rounded-lg border border-slate-800 text-xs text-slate-300 flex items-center gap-2">
        <Sparkles className="w-4 h-4 text-amber-400 shrink-0 animate-pulse" />
        <span className="font-medium">{statusText}</span>
      </div>

      {/* Results Display */}
      {measurement ? (
        <div className="flex flex-col gap-4">
          {/* Main Cards */}
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3">
            {/* Overall RT60 */}
            <div className="bg-slate-950 p-4 rounded-xl border border-amber-500/30 flex flex-col justify-between">
              <span className="text-[10px] font-bold text-amber-400 uppercase tracking-wider">Overall RT60 Reverb Time</span>
              <div className="text-2xl font-bold font-mono text-white mt-1">
                {measurement.rt60OverallSec} <span className="text-sm font-normal text-slate-400">sec</span>
              </div>
              <span className="text-[10px] text-slate-500 mt-2 border-t border-slate-900 pt-1">
                Target range: 0.30s - 0.60s
              </span>
            </div>

            {/* Bass RT60 */}
            <div className="bg-slate-950 p-4 rounded-xl border border-slate-800 flex flex-col justify-between">
              <span className="text-[10px] font-bold text-blue-400 uppercase tracking-wider">Bass Decay (&lt;250 Hz)</span>
              <div className="text-2xl font-bold font-mono text-white mt-1">
                {measurement.rt60BassSec} <span className="text-sm font-normal text-slate-400">sec</span>
              </div>
              <span className="text-[10px] text-slate-500 mt-2 border-t border-slate-900 pt-1">
                {measurement.rt60BassSec > 0.8 ? 'Needs Bass Traps' : 'Bass Damped'}
              </span>
            </div>

            {/* Mid RT60 */}
            <div className="bg-slate-950 p-4 rounded-xl border border-slate-800 flex flex-col justify-between">
              <span className="text-[10px] font-bold text-emerald-400 uppercase tracking-wider">Mid Decay (250Hz-2kHz)</span>
              <div className="text-2xl font-bold font-mono text-white mt-1">
                {measurement.rt60MidSec} <span className="text-sm font-normal text-slate-400">sec</span>
              </div>
              <span className="text-[10px] text-slate-500 mt-2 border-t border-slate-900 pt-1">
                Speech Intelligibility
              </span>
            </div>

            {/* Treble RT60 */}
            <div className="bg-slate-950 p-4 rounded-xl border border-slate-800 flex flex-col justify-between">
              <span className="text-[10px] font-bold text-rose-400 uppercase tracking-wider">Treble Decay (&gt;2 kHz)</span>
              <div className="text-2xl font-bold font-mono text-white mt-1">
                {measurement.rt60TrebleSec} <span className="text-sm font-normal text-slate-400">sec</span>
              </div>
              <span className="text-[10px] text-slate-500 mt-2 border-t border-slate-900 pt-1">
                High frequency air decay
              </span>
            </div>
          </div>

          {/* Room Verdict & Recommendations */}
          <div className="bg-slate-950 p-4 rounded-xl border border-slate-800 flex flex-col gap-2">
            <div className="flex items-center justify-between border-b border-slate-800 pb-2">
              <div className="flex items-center gap-2 text-xs font-bold text-amber-300">
                <Building2 className="w-4 h-4 text-amber-400" />
                Classification: {measurement.roomClassification}
              </div>
              <span className="text-[10px] font-mono text-slate-500">Tested at {measurement.timestamp}</span>
            </div>
            <p className="text-xs text-slate-300 leading-relaxed mt-1">
              <span className="font-semibold text-slate-200">Acoustic Treatment Suggestion:</span> {measurement.recommendation}
            </p>
          </div>
        </div>
      ) : (
        /* Empty State */
        <div className="bg-slate-950/60 rounded-xl border border-slate-850 p-6 text-center flex flex-col items-center justify-center gap-2">
          <Building2 className="w-8 h-8 text-slate-700 animate-pulse" />
          <h4 className="text-xs font-bold text-slate-300">Ready to Estimate Room Reverberation</h4>
          <p className="text-xs text-slate-400 max-w-sm leading-relaxed">
            Click the button above and make a sharp handclap or balloon pop in your room. The analyzer will calculate your room's RT60 reverb time and offer acoustic treatment tips.
          </p>
        </div>
      )}
    </div>
  );
};
