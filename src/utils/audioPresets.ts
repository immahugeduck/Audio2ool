import { SampleTrack, AudioMetrics, FrequencyWeighting, DistortionAnalysis } from '../types';
import { analyzeTotalHarmonicDistortion } from './frequencyTools';

export const SAMPLE_TRACKS: SampleTrack[] = [
  {
    id: 'synthwave',
    title: 'Neon Horizon',
    artist: 'Procedural Audio Engine',
    genre: 'Synthwave / Retrowave',
    bpm: 120,
    generatorType: 'synthwave',
  },
  {
    id: 'ambient',
    title: 'Cosmic Nebula',
    artist: 'Procedural Audio Engine',
    genre: 'Ambient Space',
    bpm: 75,
    generatorType: 'ambient',
  },
  {
    id: 'techno',
    title: 'Pulse Driver 128',
    artist: 'Procedural Audio Engine',
    genre: 'Melodic Techno',
    bpm: 128,
    generatorType: 'techno',
  },
  {
    id: 'lofi',
    title: 'Sunset Chill Hop',
    artist: 'Procedural Audio Engine',
    genre: 'Lo-Fi Beats',
    bpm: 85,
    generatorType: 'lofi',
  },
  {
    id: 'sweep',
    title: 'Logarithmic Sine Sweep (20Hz - 20kHz)',
    artist: 'Audio Calibration',
    genre: 'Acoustic Calibration',
    bpm: 0,
    generatorType: 'chords',
  },
];

export interface EqPreset {
  id: string;
  name: string;
  bass: number;
  mid: number;
  treble: number;
}

export const EQ_PRESETS: EqPreset[] = [
  { id: 'flat', name: 'Flat / Neutral', bass: 0, mid: 0, treble: 0 },
  { id: 'bass-boost', name: 'Bass Boost', bass: 8, mid: 1, treble: -2 },
  { id: 'vocal', name: 'Vocal Clarity', bass: -2, mid: 6, treble: 3 },
  { id: 'club', name: 'Club / EDM', bass: 6, mid: -1, treble: 5 },
  { id: 'acoustic', name: 'Acoustic Warmth', bass: 2, mid: 4, treble: 2 },
  { id: 'treble', name: 'Treble Sparkle', bass: -3, mid: 2, treble: 7 },
];

// Note names for pitch identification
const NOTE_NAMES = ['C', 'C#', 'D', 'D#', 'E', 'F', 'F#', 'G', 'G#', 'A', 'A#', 'B'];

export function formatFrequency(freqHz: number): string {
  if (!freqHz || freqHz <= 0 || !isFinite(freqHz)) return '0.0 Hz';
  if (freqHz < 1000) {
    return `${freqHz.toFixed(1)} Hz`;
  }
  if (freqHz < 10000) {
    return `${(freqHz / 1000).toFixed(2)} kHz`;
  }
  return `${(freqHz / 1000).toFixed(1)} kHz`;
}

export function frequencyToNote(freqHz: number): { note: string; octave: number; cents: number; formatted: string } {
  if (freqHz < 16 || !isFinite(freqHz)) {
    return { note: '-', octave: 0, cents: 0, formatted: '---' };
  }
  // Standard 12-TET tuning with A4 = 440 Hz
  const noteNum = 12 * (Math.log2(freqHz / 440)) + 69;
  const rounded = Math.round(noteNum);
  const noteIndex = ((rounded % 12) + 12) % 12;
  const octave = Math.floor(rounded / 12) - 1;
  const cents = Math.round((noteNum - rounded) * 100);
  const centsStr = cents === 0 ? '±0¢' : cents > 0 ? `+${cents}¢` : `${cents}¢`;

  return {
    note: NOTE_NAMES[noteIndex],
    octave,
    cents,
    formatted: `${NOTE_NAMES[noteIndex]}${octave} (${centsStr})`,
  };
}

export function noteToString(freqHz: number): string {
  const { formatted } = frequencyToNote(freqHz);
  if (formatted === '---') return '---';
  return `${formatted} • ${formatFrequency(freqHz)}`;
}

/**
 * IEC 61672-1 Standard A-Weighting Filter Offset (dB).
 */
export function getAWeightingDb(freqHz: number): number {
  if (freqHz <= 0 || !isFinite(freqHz)) return -100;
  const f2 = freqHz * freqHz;
  const c1 = 12194.217 * 12194.217;
  const c2 = 20.598997 * 20.598997;
  const c3 = 107.65265 * 107.65265;
  const c4 = 737.86223 * 737.86223;
  const num = c1 * f2 * f2;
  const den = (f2 + c2) * Math.sqrt((f2 + c3) * (f2 + c4)) * (f2 + c1);
  if (den <= 0) return -100;
  return 20 * Math.log10(num / den) + 2.0;
}

/**
 * IEC 61672-1 Standard C-Weighting Filter Offset (dB).
 */
export function getCWeightingDb(freqHz: number): number {
  if (freqHz <= 0 || !isFinite(freqHz)) return -100;
  const f2 = freqHz * freqHz;
  const c1 = 12194.217 * 12194.217;
  const c2 = 20.598997 * 20.598997;
  const num = c1 * f2;
  const den = (f2 + c2) * (f2 + c1);
  if (den <= 0) return -100;
  return 20 * Math.log10(num / den) + 0.06;
}

/**
 * Calculates high-accuracy audio telemetry with quadratic/parabolic peak interpolation,
 * 32-bit float spectral resolution, acoustic weighting (dBA/dBC/Z), and THD distortion analysis.
 */
export function calculateAudioMetrics(
  frequencyData: Uint8Array,
  sampleRate: number = 44100,
  fftSize: number = 2048,
  floatTimeData?: Float32Array | null,
  minDecibels: number = -90,
  maxDecibels: number = -10,
  floatFreqData?: Float32Array | null,
  weighting: FrequencyWeighting = 'Z',
  targetToneHz?: number
): AudioMetrics {
  const binCount = frequencyData.length;
  const hzPerBin = (sampleRate / 2) / (binCount || 1);
  const dbSpan = Math.max(10, maxDecibels - minDecibels);

  // Ignore DC bin (0 Hz) and sub-20Hz infrasonic offset when locating audible dominant pitch
  const minAudibleBin = Math.max(1, Math.ceil(20 / hzPerBin));
  const maxAudibleBin = Math.min(binCount - 1, Math.floor(20000 / hzPerBin));

  let maxVal = 0;
  let maxIndex = 0;
  let weightedFreqSum = 0;
  let totalMagnitudeSum = 0;
  let spectralLinearPowerSum = 0;
  let spectralAPowerSum = 0;
  let spectralCPowerSum = 0;
  let audibleBinCount = 0;

  // Band index boundaries
  const subBassMaxBin = Math.min(binCount - 1, Math.max(1, Math.floor(60 / hzPerBin)));
  const bassMaxBin = Math.min(binCount - 1, Math.max(subBassMaxBin + 1, Math.floor(250 / hzPerBin)));
  const midMaxBin = Math.min(binCount - 1, Math.max(bassMaxBin + 1, Math.floor(4000 / hzPerBin)));

  let subBassSum = 0, subBassCount = 0;
  let bassSum = 0, bassCount = 0;
  let midSum = 0, midCount = 0;
  let trebleSum = 0, trebleCount = 0;

  for (let i = 0; i < binCount; i++) {
    const val = frequencyData[i];
    const currentHz = i * hzPerBin;

    if (i >= minAudibleBin && i <= maxAudibleBin) {
      weightedFreqSum += currentHz * val;
      totalMagnitudeSum += val;
      audibleBinCount++;

      if (val > maxVal) {
        maxVal = val;
        maxIndex = i;
      }

      // Exact dB value using 32-bit float array if available, or calibrated byte fallback
      const binDb = floatFreqData && floatFreqData.length > i
        ? floatFreqData[i]
        : (val > 0 ? minDecibels + (val / 255) * dbSpan : -100);

      if (binDb > -100) {
        const rawPower = Math.pow(10, binDb / 10);
        spectralLinearPowerSum += rawPower;

        const aWeight = getAWeightingDb(currentHz);
        spectralAPowerSum += Math.pow(10, (binDb + aWeight) / 10);

        const cWeight = getCWeightingDb(currentHz);
        spectralCPowerSum += Math.pow(10, (binDb + cWeight) / 10);
      }
    }

    if (i >= 1 && i <= subBassMaxBin) {
      subBassSum += val;
      subBassCount++;
    } else if (i > subBassMaxBin && i <= bassMaxBin) {
      bassSum += val;
      bassCount++;
    } else if (i > bassMaxBin && i <= midMaxBin) {
      midSum += val;
      midCount++;
    } else if (i > midMaxBin) {
      trebleSum += val;
      trebleCount++;
    }
  }

  // Calibrated spectral peak prominence in dBFS
  let spectralProminenceDb = -100;
  if (floatFreqData && floatFreqData.length > maxIndex && maxIndex >= minAudibleBin) {
    spectralProminenceDb = floatFreqData[maxIndex];
  } else if (maxVal > 0) {
    spectralProminenceDb = minDecibels + (maxVal / 255) * dbSpan;
  }

  // Compute True Time-Domain RMS, Instantaneous Peak, and Crest Factor (with DC-offset removal)
  let rmsDb = -100;
  let peakDb = -100;
  let crestFactorDb = 0;

  if (floatTimeData && floatTimeData.length > 0) {
    const n = floatTimeData.length;
    let mean = 0;
    for (let i = 0; i < n; i++) {
      mean += floatTimeData[i];
    }
    mean /= n;

    let sumSqTime = 0;
    let maxAbsSample = 0;
    for (let i = 0; i < n; i++) {
      const sample = floatTimeData[i] - mean;
      const abs = Math.abs(sample);
      sumSqTime += sample * sample;
      if (abs > maxAbsSample) {
        maxAbsSample = abs;
      }
    }

    const rmsAmp = Math.sqrt(sumSqTime / n);
    rmsDb = rmsAmp > 1e-5 ? 20 * Math.log10(rmsAmp) : -100;
    peakDb = maxAbsSample > 1e-5 ? 20 * Math.log10(maxAbsSample) : -100;

    if (rmsDb > -72 && peakDb > -65) {
      const rawCrest = Math.max(0, peakDb - rmsDb);
      const gateWeight = Math.min(1, Math.max(0, (rmsDb - (-72)) / 16));
      crestFactorDb = rawCrest * gateWeight;
    } else {
      crestFactorDb = 0;
    }
  } else {
    const avgPower = spectralLinearPowerSum / Math.max(1, audibleBinCount);
    rmsDb = avgPower > 1e-10 ? 10 * Math.log10(avgPower) : -100;
    peakDb = spectralProminenceDb;
    if (rmsDb > -72 && peakDb > -65) {
      crestFactorDb = Math.max(0, Math.min(20, (peakDb - rmsDb) * 0.5));
    }
  }

  // Compute A-weighted and C-weighted RMS levels from integrated spectral power
  const divCount = Math.max(1, audibleBinCount);
  const avgAPower = spectralAPowerSum / divCount;
  const avgCPower = spectralCPowerSum / divCount;
  const avgZPower = spectralLinearPowerSum / divCount;

  // Compute dB offset between weighted spectral integration and unweighted spectral integration
  const deltaA = avgZPower > 1e-10 && avgAPower > 1e-10 ? 10 * Math.log10(avgAPower / avgZPower) : 0;
  const deltaC = avgZPower > 1e-10 && avgCPower > 1e-10 ? 10 * Math.log10(avgCPower / avgZPower) : 0;

  // Apply weighting offset to master time-domain RMS for real-time acoustic meter display
  const rmsDba = Math.max(-100, Math.min(0, Math.round(rmsDb + deltaA)));
  const rmsDbc = Math.max(-100, Math.min(0, Math.round(rmsDb + deltaC)));

  // Master reported RMS level based on selected weighting standard
  let activeRmsDb = Math.round(rmsDb);
  if (weighting === 'A') {
    activeRmsDb = rmsDba;
  } else if (weighting === 'C') {
    activeRmsDb = rmsDbc;
  }

  // High Precision Parabolic (Quadratic) Peak Interpolation:
  let refinedPeakHz = 0;
  if (maxVal > 18 && maxIndex > minAudibleBin && maxIndex < binCount - 1) {
    let alpha: number, beta: number, gamma: number;
    if (floatFreqData && floatFreqData.length > maxIndex) {
      alpha = floatFreqData[maxIndex - 1];
      beta = floatFreqData[maxIndex];
      gamma = floatFreqData[maxIndex + 1];
    } else {
      alpha = 20 * Math.log10(Math.max(1e-4, frequencyData[maxIndex - 1] / 255));
      beta = 20 * Math.log10(Math.max(1e-4, frequencyData[maxIndex] / 255));
      gamma = 20 * Math.log10(Math.max(1e-4, frequencyData[maxIndex + 1] / 255));
    }

    const denom = alpha - 2 * beta + gamma;
    let delta = 0;
    if (denom < -1e-4) {
      delta = 0.5 * ((alpha - gamma) / denom);
      delta = Math.max(-0.5, Math.min(0.5, delta));
    }
    refinedPeakHz = Math.max(0, (maxIndex + delta) * hzPerBin);
  } else if (maxVal > 18) {
    refinedPeakHz = maxIndex * hzPerBin;
  }

  // Spectral Centroid
  const spectralCentroidHz = totalMagnitudeSum > 0 ? weightedFreqSum / totalMagnitudeSum : 0;
  const noteInfo = frequencyToNote(refinedPeakHz);

  // Analyze Total Harmonic Distortion (THD% & THD+N) if float frequency data is available
  let distortion: DistortionAnalysis | undefined;
  if (floatFreqData && floatFreqData.length > 0) {
    distortion = analyzeTotalHarmonicDistortion(floatFreqData, sampleRate, targetToneHz);
  }

  return {
    peakFrequencyHz: refinedPeakHz,
    peakFrequencyFormatted: formatFrequency(refinedPeakHz),
    peakNoteName: noteInfo.formatted,
    prominenceDb: Math.max(-100, Math.min(0, Math.round(spectralProminenceDb))),
    spectralCentroidHz: Math.round(spectralCentroidHz),
    rmsDb: activeRmsDb,
    rmsDba,
    rmsDbc,
    weighting,
    peakDb: Math.max(-100, Math.min(0, Math.round(peakDb))),
    crestFactorDb: Math.round(crestFactorDb),
    subBass: subBassCount ? Math.min(100, Math.round((subBassSum / subBassCount) / 2.55)) : 0,
    bass: bassCount ? Math.min(100, Math.round((bassSum / bassCount) / 2.55)) : 0,
    mid: midCount ? Math.min(100, Math.round((midSum / midCount) / 2.55)) : 0,
    treble: trebleCount ? Math.min(100, Math.round((trebleSum / trebleCount) / 2.55)) : 0,
    fps: 60,
    distortion,
  };
}

/**
 * Generates rich high-quality audio buffer procedurally using Web Audio API
 */
export async function generateSampleAudioBuffer(
  audioCtx: AudioContext,
  type: 'synthwave' | 'ambient' | 'techno' | 'lofi' | 'chords',
  durationSec: number = 30
): Promise<AudioBuffer> {
  const sampleRate = audioCtx.sampleRate;
  const offlineCtx = new OfflineAudioContext(2, sampleRate * durationSec, sampleRate);

  if (type === 'lofi') {
    // Lo-Fi Chill Hop Generator
    const tempo = 85;
    const secondsPerBeat = 60 / tempo;

    // Warm Rhodes Piano Chords (Cmaj7 -> Am7 -> Fmaj7 -> G7)
    const chords = [
      [261.63, 329.63, 392.00, 493.88], // Cmaj7
      [220.00, 261.63, 329.63, 392.00], // Am7
      [174.61, 220.00, 261.63, 329.63], // Fmaj7
      [196.00, 246.94, 293.66, 349.23], // G7
    ];

    chords.forEach((chord, idx) => {
      const startTime = idx * secondsPerBeat * 4;
      if (startTime >= durationSec) return;

      chord.forEach((freq) => {
        const osc = offlineCtx.createOscillator();
        const filter = offlineCtx.createBiquadFilter();
        const gain = offlineCtx.createGain();

        osc.type = 'sine';
        osc.frequency.value = freq;

        filter.type = 'lowpass';
        filter.frequency.value = 1200;

        gain.gain.setValueAtTime(0.12, startTime);
        gain.gain.exponentialRampToValueAtTime(0.001, startTime + secondsPerBeat * 3.8);

        osc.connect(filter);
        filter.connect(gain);
        gain.connect(offlineCtx.destination);

        osc.start(startTime);
        osc.stop(startTime + secondsPerBeat * 4);
      });
    });

    // Relaxed Lo-Fi Kick & Snare Drums
    for (let b = 0; b < durationSec / secondsPerBeat; b++) {
      const time = b * secondsPerBeat;
      if (b % 4 === 0 || b % 4 === 2.5) {
        // Soft Sub Kick
        const kickOsc = offlineCtx.createOscillator();
        const kickGain = offlineCtx.createGain();
        kickOsc.frequency.setValueAtTime(110, time);
        kickOsc.frequency.exponentialRampToValueAtTime(38, time + 0.15);
        kickGain.gain.setValueAtTime(0.7, time);
        kickGain.gain.exponentialRampToValueAtTime(0.001, time + 0.22);
        kickOsc.connect(kickGain);
        kickGain.connect(offlineCtx.destination);
        kickOsc.start(time);
        kickOsc.stop(time + 0.22);
      } else if (b % 4 === 2) {
        // Rimshot / Soft Snare
        const snareOsc = offlineCtx.createOscillator();
        const snareGain = offlineCtx.createGain();
        snareOsc.type = 'triangle';
        snareOsc.frequency.setValueAtTime(220, time);
        snareGain.gain.setValueAtTime(0.3, time);
        snareGain.gain.exponentialRampToValueAtTime(0.001, time + 0.1);
        snareOsc.connect(snareGain);
        snareGain.connect(offlineCtx.destination);
        snareOsc.start(time);
        snareOsc.stop(time + 0.1);
      }
    }

  } else if (type === 'synthwave') {
    // Synthwave Track Generator
    const tempo = 120;
    const secondsPerBeat = 60 / tempo;

    // Bassline (sawtooth filtered)
    const bassOsc = offlineCtx.createOscillator();
    const bassFilter = offlineCtx.createBiquadFilter();
    const bassGain = offlineCtx.createGain();

    bassOsc.type = 'sawtooth';
    bassFilter.type = 'lowpass';
    bassFilter.frequency.value = 400;

    // Bass pattern notes: A1, A1, C2, G1
    const bassNotes = [55, 55, 65.41, 49];
    for (let i = 0; i < durationSec / (secondsPerBeat * 2); i++) {
      const startTime = i * secondsPerBeat * 2;
      const noteFreq = bassNotes[i % bassNotes.length];
      bassOsc.frequency.setValueAtTime(noteFreq, startTime);
      bassFilter.frequency.setValueAtTime(800, startTime);
      bassFilter.frequency.exponentialRampToValueAtTime(150, startTime + 0.3);
    }

    bassGain.gain.value = 0.35;
    bassOsc.connect(bassFilter);
    bassFilter.connect(bassGain);
    bassGain.connect(offlineCtx.destination);
    bassOsc.start(0);

    // Arpeggio Lead synth
    const arpOsc = offlineCtx.createOscillator();
    const arpGain = offlineCtx.createGain();
    arpOsc.type = 'triangle';
    arpGain.gain.value = 0.2;

    const scale = [220, 261.63, 329.63, 392.00, 440, 523.25]; // Am chord scale
    const stepTime = secondsPerBeat / 4;
    for (let t = 0; t < durationSec; t += stepTime) {
      const step = Math.floor(t / stepTime);
      const note = scale[step % scale.length];
      arpOsc.frequency.setValueAtTime(note, t);
    }
    arpOsc.connect(arpGain);
    arpGain.connect(offlineCtx.destination);
    arpOsc.start(0);

    // Kick Drum & Snare noise
    for (let b = 0; b < durationSec / secondsPerBeat; b++) {
      const time = b * secondsPerBeat;
      
      // Kick on 1 and 3
      if (b % 2 === 0) {
        const kickOsc = offlineCtx.createOscillator();
        const kickGain = offlineCtx.createGain();
        kickOsc.frequency.setValueAtTime(150, time);
        kickOsc.frequency.exponentialRampToValueAtTime(35, time + 0.12);
        kickGain.gain.setValueAtTime(0.8, time);
        kickGain.gain.exponentialRampToValueAtTime(0.001, time + 0.25);
        kickOsc.connect(kickGain);
        kickGain.connect(offlineCtx.destination);
        kickOsc.start(time);
        kickOsc.stop(time + 0.25);
      } else {
        // Snare noise
        const bufferSize = sampleRate * 0.15;
        const noiseBuffer = offlineCtx.createBuffer(1, bufferSize, sampleRate);
        const output = noiseBuffer.getChannelData(0);
        for (let i = 0; i < bufferSize; i++) {
          output[i] = Math.random() * 2 - 1;
        }
        const whiteNoise = offlineCtx.createBufferSource();
        whiteNoise.buffer = noiseBuffer;
        const noiseFilter = offlineCtx.createBiquadFilter();
        noiseFilter.type = 'highpass';
        noiseFilter.frequency.value = 1000;
        const noiseGain = offlineCtx.createGain();
        noiseGain.gain.setValueAtTime(0.3, time);
        noiseGain.gain.exponentialRampToValueAtTime(0.001, time + 0.15);

        whiteNoise.connect(noiseFilter);
        noiseFilter.connect(noiseGain);
        noiseGain.connect(offlineCtx.destination);
        whiteNoise.start(time);
      }
    }

  } else if (type === 'ambient') {
    // Ethereal Ambient Pad
    const frequencies = [110, 164.81, 220, 277.18, 329.63, 440];
    frequencies.forEach((freq, idx) => {
      const osc = offlineCtx.createOscillator();
      const gain = offlineCtx.createGain();
      osc.type = idx % 2 === 0 ? 'sine' : 'triangle';
      osc.frequency.value = freq;

      // LFO modulation for slow breathing amplitude
      const lfo = offlineCtx.createOscillator();
      const lfoGain = offlineCtx.createGain();
      lfo.frequency.value = 0.1 + idx * 0.05;
      lfoGain.gain.value = 0.08;

      lfo.connect(lfoGain);
      lfoGain.connect(gain.gain);
      gain.gain.setValueAtTime(0.12, 0);

      osc.connect(gain);
      gain.connect(offlineCtx.destination);

      osc.start(0);
      lfo.start(0);
    });

  } else if (type === 'techno') {
    // Melodic Techno Driver
    const tempo = 128;
    const secondsPerBeat = 60 / tempo;

    // 4-on-the-floor Kick
    for (let b = 0; b < durationSec / secondsPerBeat; b++) {
      const time = b * secondsPerBeat;
      const kickOsc = offlineCtx.createOscillator();
      const kickGain = offlineCtx.createGain();

      kickOsc.frequency.setValueAtTime(160, time);
      kickOsc.frequency.exponentialRampToValueAtTime(40, time + 0.1);

      kickGain.gain.setValueAtTime(0.9, time);
      kickGain.gain.exponentialRampToValueAtTime(0.001, time + 0.2);

      kickOsc.connect(kickGain);
      kickGain.connect(offlineCtx.destination);

      kickOsc.start(time);
      kickOsc.stop(time + 0.2);
    }

    // Saw Bass line
    const sawOsc = offlineCtx.createOscillator();
    const sawFilter = offlineCtx.createBiquadFilter();
    const sawGain = offlineCtx.createGain();

    sawOsc.type = 'sawtooth';
    sawOsc.frequency.value = 65.41; // C2
    sawFilter.type = 'lowpass';
    sawFilter.frequency.value = 350;
    sawGain.gain.value = 0.3;

    sawOsc.connect(sawFilter);
    sawFilter.connect(sawGain);
    sawGain.connect(offlineCtx.destination);
    sawOsc.start(0);

  } else {
    // Logarithmic Sine Sweep 20Hz -> 20,000Hz over durationSec
    const sweepOsc = offlineCtx.createOscillator();
    const sweepGain = offlineCtx.createGain();
    sweepOsc.type = 'sine';

    sweepOsc.frequency.setValueAtTime(20, 0);
    sweepOsc.frequency.exponentialRampToValueAtTime(20000, durationSec);

    sweepGain.gain.value = 0.3;
    sweepOsc.connect(sweepGain);
    sweepGain.connect(offlineCtx.destination);

    sweepOsc.start(0);
  }

  return await offlineCtx.startRendering();
}
