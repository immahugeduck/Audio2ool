import { SampleTrack } from '../types';

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
 * Calculates high-accuracy audio telemetry with quadratic/parabolic peak interpolation,
 * energy band integration, and spectral centroid.
 */
export function calculateAudioMetrics(
  frequencyData: Uint8Array,
  sampleRate: number = 44100,
  fftSize: number = 2048
): {
  peakFrequencyHz: number;
  peakFrequencyFormatted: string;
  peakNoteName: string;
  prominenceDb: number;
  spectralCentroidHz: number;
  rmsDb: number;
  peakDb: number;
  crestFactorDb: number;
  subBass: number;
  bass: number;
  mid: number;
  treble: number;
} {
  const binCount = frequencyData.length;
  const hzPerBin = (sampleRate / 2) / binCount;

  let maxVal = 0;
  let maxIndex = 0;
  let sumSq = 0;
  let weightedFreqSum = 0;
  let totalMagnitudeSum = 0;

  // Band index boundaries
  const subBassMaxBin = Math.min(binCount, Math.floor(60 / hzPerBin));
  const bassMaxBin = Math.min(binCount, Math.floor(250 / hzPerBin));
  const midMaxBin = Math.min(binCount, Math.floor(4000 / hzPerBin));

  let subBassSum = 0, subBassCount = 0;
  let bassSum = 0, bassCount = 0;
  let midSum = 0, midCount = 0;
  let trebleSum = 0, trebleCount = 0;

  for (let i = 0; i < binCount; i++) {
    const val = frequencyData[i];
    sumSq += val * val;
    const currentHz = i * hzPerBin;
    weightedFreqSum += currentHz * val;
    totalMagnitudeSum += val;

    if (val > maxVal) {
      maxVal = val;
      maxIndex = i;
    }

    if (i <= subBassMaxBin) {
      subBassSum += val;
      subBassCount++;
    } else if (i <= bassMaxBin) {
      bassSum += val;
      bassCount++;
    } else if (i <= midMaxBin) {
      midSum += val;
      midCount++;
    } else {
      trebleSum += val;
      trebleCount++;
    }
  }

  // Calculate RMS dBFS
  const rms = Math.sqrt(sumSq / (binCount || 1)) / 255;
  const rmsDb = rms > 0 ? 20 * Math.log10(rms) : -100;

  // Calculate Peak dBFS
  const peakNorm = maxVal / 255;
  const peakDb = peakNorm > 0 ? 20 * Math.log10(peakNorm) : -100;
  const crestFactorDb = Math.max(0, peakDb - rmsDb);

  // High Precision Parabolic (Quadratic) Peak Interpolation:
  // Evaluates continuous spectral peak between adjacent discrete FFT bins
  let refinedPeakHz = 0;
  if (maxVal > 10 && maxIndex > 0 && maxIndex < binCount - 1) {
    const alpha = Math.max(1e-4, frequencyData[maxIndex - 1] / 255);
    const beta = Math.max(1e-4, frequencyData[maxIndex] / 255);
    const gamma = Math.max(1e-4, frequencyData[maxIndex + 1] / 255);

    // Convert to log / dB domain for optimal parabolic interpolation
    const logA = 20 * Math.log10(alpha);
    const logB = 20 * Math.log10(beta);
    const logG = 20 * Math.log10(gamma);

    const denom = logA - 2 * logB + logG;
    let delta = 0;
    if (Math.abs(denom) > 1e-6) {
      delta = 0.5 * ((logA - logG) / denom);
      // Clamp fractional bin offset to [-0.5, 0.5]
      delta = Math.max(-0.5, Math.min(0.5, delta));
    }

    refinedPeakHz = Math.max(0, (maxIndex + delta) * hzPerBin);
  } else if (maxVal > 10) {
    refinedPeakHz = maxIndex * hzPerBin;
  }

  // Spectral Centroid (Center of gravity of spectrum in Hz)
  const spectralCentroidHz = totalMagnitudeSum > 0 ? weightedFreqSum / totalMagnitudeSum : 0;

  const noteInfo = frequencyToNote(refinedPeakHz);

  return {
    peakFrequencyHz: refinedPeakHz,
    peakFrequencyFormatted: formatFrequency(refinedPeakHz),
    peakNoteName: noteInfo.formatted,
    prominenceDb: Math.round(peakDb),
    spectralCentroidHz: Math.round(spectralCentroidHz),
    rmsDb: Math.max(-100, Math.min(0, Math.round(rmsDb))),
    peakDb: Math.max(-100, Math.min(0, Math.round(peakDb))),
    crestFactorDb: Math.round(crestFactorDb),
    subBass: subBassCount ? Math.min(100, Math.round((subBassSum / subBassCount) / 2.55)) : 0,
    bass: bassCount ? Math.min(100, Math.round((bassSum / bassCount) / 2.55)) : 0,
    mid: midCount ? Math.min(100, Math.round((midSum / midCount) / 2.55)) : 0,
    treble: trebleCount ? Math.min(100, Math.round((trebleSum / trebleCount) / 2.55)) : 0,
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
