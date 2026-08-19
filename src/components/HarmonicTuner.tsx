import React, { useState } from 'react';
import { 
  Sliders, 
  Activity, 
  Music, 
  Zap, 
  Sparkles, 
  Layers, 
  Info,
  Radio,
  Power
} from 'lucide-react';
import { AudioMetrics } from '../types';

interface HarmonicTunerProps {
  metrics: AudioMetrics;
  getFrequencyData: () => Uint8Array | null;
}

export const HarmonicTuner: React.FC<HarmonicTunerProps> = ({
  metrics,
  getFrequencyData,
}) => {
  const [isActive, setIsActive] = useState<boolean>(true);

  const peakHz = metrics.peakFrequencyHz;
  const noteName = metrics.peakNoteName;

  // Calculate tuning target and cents offset
  const getTuningInfo = () => {
    if (!isActive || peakHz < 20) {
      return { targetNote: '---', targetHz: 0, centsOffset: 0, isTuned: false };
    }

    // A4 = 440 Hz
    const midiNum = Math.round(69 + 12 * Math.log2(peakHz / 440));
    const targetHz = 440 * Math.pow(2, (midiNum - 69) / 12);
    
    // Cents offset = 1200 * log2(peakHz / targetHz)
    const centsOffset = Math.round(1200 * Math.log2(peakHz / targetHz));
    const isTuned = Math.abs(centsOffset) <= 3;

    return { targetNote: noteName, targetHz, centsOffset, isTuned };
  };

  const tuning = getTuningInfo();

  // Detect Harmonics in FFT data
  const getHarmonicsData = () => {
    if (!isActive) return [];
    const freqData = getFrequencyData();
    if (!freqData || peakHz < 30) return [];

    const harmonicsList: { order: number; expectedHz: number; actualHz: number; amplitude: number; isOdd: boolean }[] = [];
    const binCount = freqData.length;
    const nyquist = 22050; // standard 44.1kHz sample rate half
    const hzPerBin = nyquist / binCount;

    for (let order = 1; order <= 8; order++) {
      const expectedHz = peakHz * order;
      if (expectedHz > nyquist) break;

      const expectedBin = Math.round(expectedHz / hzPerBin);
      // Search narrow window around expected bin
      let maxVal = 0;
      let actualBin = expectedBin;

      for (let offset = -3; offset <= 3; offset++) {
        const b = expectedBin + offset;
        if (b >= 0 && b < binCount) {
          if (freqData[b] > maxVal) {
            maxVal = freqData[b];
            actualBin = b;
          }
        }
      }

      const amplitude = Math.round((maxVal / 255) * 100);
      const actualHz = actualBin * hzPerBin;

      harmonicsList.push({
        order,
        expectedHz: Math.round(expectedHz),
        actualHz: Math.round(actualHz),
        amplitude,
        isOdd: order % 2 !== 0,
      });
    }

    return harmonicsList;
  };

  const harmonics = getHarmonicsData();

  // Compute even vs odd harmonic energy balance
  const evenEnergy = harmonics.filter(h => !h.isOdd && h.order > 1).reduce((acc, h) => acc + h.amplitude, 0);
  const oddEnergy = harmonics.filter(h => h.isOdd && h.order > 1).reduce((acc, h) => acc + h.amplitude, 0);
  const totalHarmonicEnergy = evenEnergy + oddEnergy;

  const evenPct = totalHarmonicEnergy > 0 ? Math.round((evenEnergy / totalHarmonicEnergy) * 100) : 50;
  const oddPct = totalHarmonicEnergy > 0 ? Math.round((oddEnergy / totalHarmonicEnergy) * 100) : 50;

  return (
    <div className="bg-slate-900/90 border border-slate-800/80 rounded-2xl p-5 shadow-xl backdrop-blur-md flex flex-col gap-4">
      {/* Header */}
      <div className="flex items-center justify-between border-b border-slate-800 pb-3 flex-wrap gap-2">
        <div className="flex items-center gap-2.5">
          <div className="p-2 rounded-xl bg-gradient-to-tr from-cyan-500/20 to-emerald-500/20 border border-cyan-500/30 text-cyan-300">
            <Music className="w-5 h-5" />
          </div>
          <div>
            <h3 className="text-sm font-semibold text-white tracking-wide flex items-center gap-2">
              Harmonic Overtones Analyzer & Precision Pitch Tuner
              <span className="px-2 py-0.5 rounded-full text-[10px] font-bold bg-cyan-500/20 border border-cyan-500/40 text-cyan-300">
                A440 TUNER & OVERTONES
              </span>
            </h3>
            <p className="text-xs text-slate-400">
              Live chromatic pitch meter with cents calibration and fundamental harmonic overtone series mapping
            </p>
          </div>
        </div>

        <button
          onClick={() => setIsActive(prev => !prev)}
          id="btn-toggle-harmonizer"
          className={`px-3 py-1.5 rounded-lg border text-xs font-bold flex items-center gap-1.5 transition-all cursor-pointer ${
            isActive
              ? 'bg-emerald-500/20 text-emerald-300 border-emerald-500/40 hover:bg-emerald-500/30'
              : 'bg-slate-800 text-slate-400 border-slate-700 hover:bg-slate-700'
          }`}
        >
          <Power className={`w-3.5 h-3.5 ${isActive ? 'text-emerald-400' : 'text-slate-500'}`} />
          {isActive ? 'Engine Active' : 'Engine Paused (Save CPU)'}
        </button>
      </div>

      {!isActive ? (
        <div className="bg-slate-950/80 rounded-xl border border-slate-800 p-6 text-center flex flex-col items-center justify-center gap-2">
          <Power className="w-8 h-8 text-slate-600" />
          <h4 className="text-xs font-bold text-slate-400">Harmonizer Analysis Engine Paused</h4>
          <p className="text-xs text-slate-500 max-w-sm leading-relaxed">
            Harmonic overtone detection and pitch calculation are paused to conserve compute power. Click 'Engine Paused' above to reactivate.
          </p>
        </div>
      ) : (
        <>
          {/* Main Pitch Tuner Display */}
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            {/* Left: Pitch Target Card */}
            <div className="bg-slate-950 p-4 rounded-xl border border-slate-800 flex flex-col items-center justify-center text-center">
              <span className="text-[10px] font-bold text-slate-500 uppercase tracking-wider mb-1">Detected Note Pitch</span>
              <div className={`text-4xl font-extrabold font-mono transition-all ${tuning.isTuned ? 'text-emerald-400 scale-105' : 'text-white'}`}>
                {tuning.targetNote}
              </div>
              <div className="text-xs text-slate-400 font-mono mt-1">
                {peakHz > 0 ? `${Math.round(peakHz)} Hz` : '---'}
              </div>
              {tuning.isTuned && (
                <span className="mt-2 px-2.5 py-0.5 rounded-full text-[10px] font-bold bg-emerald-500/20 border border-emerald-500/40 text-emerald-300">
                  PERFECT PITCH IN TUNE
                </span>
              )}
            </div>

            {/* Center: Cents Gauge Needle Meter */}
            <div className="md:col-span-2 bg-slate-950 p-4 rounded-xl border border-slate-800 flex flex-col justify-between gap-3">
              <div className="flex justify-between items-center text-xs">
                <span className="font-bold text-slate-400 uppercase text-[10px] tracking-wider">Chromatic Calibration (Cents Offset)</span>
                <span className={`font-mono font-bold ${tuning.centsOffset === 0 ? 'text-emerald-400' : tuning.centsOffset > 0 ? 'text-amber-400' : 'text-cyan-400'}`}>
                  {tuning.centsOffset > 0 ? `+${tuning.centsOffset}` : tuning.centsOffset} cents
                </span>
              </div>

              {/* Needle Graphic */}
              <div className="relative w-full h-10 bg-slate-900 rounded-xl border border-slate-800 flex items-center px-4 overflow-hidden">
                {/* Center Zero Line */}
                <div className="absolute left-1/2 top-0 bottom-0 w-0.5 bg-emerald-500 z-10" />

                {/* Flat (-50) to Sharp (+50) markers */}
                <div className="w-full flex justify-between text-[9px] font-mono text-slate-600 z-0">
                  <span>-50 Flat</span>
                  <span>-25</span>
                  <span className="text-emerald-400 font-bold">0</span>
                  <span>+25</span>
                  <span>+50 Sharp</span>
                </div>

                {/* Dynamic Needle */}
                <div 
                  className="absolute top-1 bottom-1 w-2 rounded-full bg-gradient-to-b from-cyan-400 to-emerald-400 shadow-lg shadow-cyan-500/50 transition-all duration-150 z-20"
                  style={{
                    left: `calc(${Math.min(95, Math.max(5, 50 + tuning.centsOffset))}% - 4px)`
                  }}
                />
              </div>

              <div className="flex justify-between text-[10px] text-slate-500">
                <span>Tuning Standard: <strong className="text-slate-300">A4 = 440 Hz</strong></span>
                <span>Target: <strong className="text-slate-300">{Math.round(tuning.targetHz)} Hz</strong></span>
              </div>
            </div>
          </div>

          {/* Harmonic Overtones Series Grid */}
          {harmonics.length > 0 ? (
            <div className="flex flex-col gap-3">
              <div className="flex justify-between items-center text-xs border-b border-slate-800 pb-2">
                <h4 className="font-bold text-slate-200 flex items-center gap-2">
                  <Layers className="w-4 h-4 text-cyan-400" />
                  Fundamental & Overtone Harmonic Series (1x to 8x)
                </h4>
                <div className="flex gap-3 text-[10px] font-semibold">
                  <span className="text-emerald-400">Even Harmonics: {evenPct}% (Warmth)</span>
                  <span className="text-amber-400">Odd Harmonics: {oddPct}% (Bite/Edge)</span>
                </div>
              </div>

              <div className="grid grid-cols-2 sm:grid-cols-4 lg:grid-cols-8 gap-2">
                {harmonics.map((h) => (
                  <div 
                    key={h.order} 
                    className={`bg-slate-950 p-2.5 rounded-xl border flex flex-col justify-between gap-2 transition-all ${
                      h.order === 1 
                        ? 'border-cyan-500/50 bg-cyan-500/5' 
                        : h.isOdd 
                        ? 'border-amber-500/30' 
                        : 'border-emerald-500/30'
                    }`}
                  >
                    <div className="flex justify-between items-center">
                      <span className={`text-[10px] font-bold ${h.order === 1 ? 'text-cyan-300' : h.isOdd ? 'text-amber-300' : 'text-emerald-300'}`}>
                        {h.order === 1 ? '1x Fund.' : `${h.order}x Harmonic`}
                      </span>
                    </div>

                    <div className="text-xs font-mono font-bold text-white">
                      {h.expectedHz} <span className="text-[9px] font-normal text-slate-500">Hz</span>
                    </div>

                    {/* Energy Bar */}
                    <div className="w-full h-1.5 bg-slate-900 rounded-full overflow-hidden">
                      <div 
                        className={`h-full rounded-full transition-all ${
                          h.order === 1 ? 'bg-cyan-400' : h.isOdd ? 'bg-amber-400' : 'bg-emerald-400'
                        }`}
                        style={{ width: `${h.amplitude}%` }}
                      />
                    </div>

                    <span className="text-[9px] font-mono text-slate-500 text-right">{h.amplitude}% energy</span>
                  </div>
                ))}
              </div>
            </div>
          ) : (
            <div className="bg-slate-950/60 rounded-xl border border-slate-850 p-4 text-center text-xs text-slate-500">
              Play a sustained audio note or synth tone to analyze its harmonic overtones.
            </div>
          )}
        </>
      )}
    </div>
  );
};

