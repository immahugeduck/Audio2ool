/**
 * Precision Frequency Analysis, ISO 1/3-Octave RTA, and Signal Synthesis Utilities
 */
import { OctaveBandData, DistortionAnalysis, HarmonicOvertone, FrequencyWeighting } from '../types';
import { formatFrequency, frequencyToNote } from './audioPresets';

// ISO 266 standard 31 1/3-octave center frequencies (Hz) from 20 Hz to 20 kHz
export const ISO_1_3_OCTAVE_FREQUENCIES: number[] = [
  20, 25, 31.5, 40, 50, 63, 80, 100, 125, 160, 200, 250, 315, 400, 500, 630, 800,
  1000, 1250, 1600, 2000, 2500, 3150, 4000, 5000, 6300, 8000, 10000, 12500, 16000, 20000,
];

export function formatOctaveFreqLabel(freqHz: number): string {
  if (freqHz < 1000) {
    return freqHz % 1 === 0 ? `${freqHz}` : `${freqHz.toFixed(1)}`;
  }
  const k = freqHz / 1000;
  return k % 1 === 0 ? `${k}k` : `${k.toFixed(1)}k`;
}

export interface CalibrationPreset {
  id: string;
  name: string;
  freqHz: number;
  waveform: 'sine' | 'triangle' | 'square' | 'pink' | 'white';
  category: 'Hum & Grounds' | 'Acoustics' | 'Musical' | 'Hearing & Highs';
  description: string;
}

export const CALIBRATION_PRESETS: CalibrationPreset[] = [
  {
    id: 'sub-20',
    name: '20 Hz Sub Infrasound',
    freqHz: 20,
    waveform: 'sine',
    category: 'Hum & Grounds',
    description: 'Bottom limit of human hearing, tests subwoofer low-end roll-off',
  },
  {
    id: 'mains-50',
    name: '50 Hz UK/EU Mains Hum',
    freqHz: 50,
    waveform: 'sine',
    category: 'Hum & Grounds',
    description: 'European/Asian AC mains electrical ground interference frequency',
  },
  {
    id: 'mains-60',
    name: '60 Hz US Mains Ground Hum',
    freqHz: 60,
    waveform: 'sine',
    category: 'Hum & Grounds',
    description: 'North American AC 60Hz ground loop reference hum',
  },
  {
    id: 'mains-120',
    name: '120 Hz Full-Wave Hum',
    freqHz: 120,
    waveform: 'sine',
    category: 'Hum & Grounds',
    description: '2nd harmonic rectified power supply ripple frequency',
  },
  {
    id: 'kick-80',
    name: '80 Hz Punch & Bass Cut',
    freqHz: 80,
    waveform: 'sine',
    category: 'Acoustics',
    description: 'Standard high-pass filter cutoff and kick drum punch point',
  },
  {
    id: 'concert-a-440',
    name: '440 Hz Concert Pitch (A4)',
    freqHz: 440,
    waveform: 'sine',
    category: 'Musical',
    description: 'International standard tuning reference (ISO 16)',
  },
  {
    id: 'solfeggio-528',
    name: '528 Hz Solfeggio / Clarity',
    freqHz: 528,
    waveform: 'sine',
    category: 'Musical',
    description: 'Ancient solfeggio frequency for resonance testing',
  },
  {
    id: 'alignment-1k',
    name: '1,000 Hz Standard 0VU Reference',
    freqHz: 1000,
    waveform: 'sine',
    category: 'Acoustics',
    description: 'Broadcasting & studio calibration alignment test tone (1 kHz)',
  },
  {
    id: 'fletcher-3150',
    name: '3,150 Hz Ear Sensitivity Notch',
    freqHz: 3150,
    waveform: 'sine',
    category: 'Hearing & Highs',
    description: 'Peak ear canal resonance & maximum auditory sensitivity zone',
  },
  {
    id: 'air-10k',
    name: '10,000 Hz Studio Air & Sheen',
    freqHz: 10000,
    waveform: 'sine',
    category: 'Hearing & Highs',
    description: 'High-frequency brilliance, cymbals and air band',
  },
  {
    id: 'pink-noise',
    name: 'Pink Noise (Equal / Octave)',
    freqHz: 1000,
    waveform: 'pink',
    category: 'Acoustics',
    description: 'Equal energy per octave (1/f), gold standard for room EQ & RT60',
  },
  {
    id: 'white-noise',
    name: 'White Noise (Equal / Hz)',
    freqHz: 1000,
    waveform: 'white',
    category: 'Acoustics',
    description: 'Equal energy per Hz, constant power spectral density',
  },
];

/**
 * Computes 1/3-octave band energies from FFT byte frequency data.
 */
export function computeOctaveBands(
  frequencyData: Uint8Array,
  sampleRate: number = 44100,
  minDecibels: number = -90,
  maxDecibels: number = -10
): OctaveBandData[] {
  const binCount = frequencyData.length;
  if (binCount === 0) return [];

  const hzPerBin = (sampleRate / 2) / binCount;
  const dbRange = maxDecibels - minDecibels;

  let maxRmsDb = -120;
  let dominantIdx = 0;

  const results: OctaveBandData[] = ISO_1_3_OCTAVE_FREQUENCIES.map((centerHz, index) => {
    // 1/3-octave band edges: f_lower = f_center * 2^(-1/6), f_upper = f_center * 2^(1/6)
    const factor = Math.pow(2, 1 / 6);
    const lowerHz = centerHz / factor;
    const upperHz = centerHz * factor;

    const lowerBin = Math.max(0, Math.floor(lowerHz / hzPerBin));
    const upperBin = Math.min(binCount - 1, Math.ceil(upperHz / hzPerBin));

    let sumSquares = 0;
    let peakVal = 0;
    let count = 0;

    for (let b = lowerBin; b <= upperBin; b++) {
      const val = frequencyData[b]; // 0 - 255
      sumSquares += val * val;
      if (val > peakVal) peakVal = val;
      count++;
    }

    const rmsVal = count > 0 ? Math.sqrt(sumSquares / count) : 0;
    
    // Map 0 - 255 to dBFS
    const rmsDb = minDecibels + (rmsVal / 255) * dbRange;
    const peakDb = minDecibels + (peakVal / 255) * dbRange;

    if (rmsDb > maxRmsDb) {
      maxRmsDb = rmsDb;
      dominantIdx = index;
    }

    // Energy percentage relative to 255 max
    const energyPercent = Math.min(100, Math.round((rmsVal / 255) * 100));

    return {
      centerHz,
      label: formatOctaveFreqLabel(centerHz),
      rmsDb: Math.round(rmsDb * 10) / 10,
      peakDb: Math.round(peakDb * 10) / 10,
      energyPercent,
      isDominant: false,
    };
  });

  if (results[dominantIdx]) {
    results[dominantIdx].isDominant = true;
  }

  return results;
}

/**
 * Synthesizes a Pink Noise AudioBuffer using Paul Kellet's filtered white noise algorithm.
 * Pink noise drops at 3dB/octave, providing equal energy across all musical octaves.
 */
export function generatePinkNoiseBuffer(ctx: AudioContext, durationSeconds: number = 5): AudioBuffer {
  const sampleRate = ctx.sampleRate;
  const bufferSize = sampleRate * durationSeconds;
  const buffer = ctx.createBuffer(1, bufferSize, sampleRate);
  const data = buffer.getChannelData(0);

  let b0 = 0, b1 = 0, b2 = 0, b3 = 0, b4 = 0, b5 = 0, b6 = 0;

  for (let i = 0; i < bufferSize; i++) {
    const white = Math.random() * 2 - 1;
    b0 = 0.99886 * b0 + white * 0.0555179;
    b1 = 0.99332 * b1 + white * 0.0750759;
    b2 = 0.96900 * b2 + white * 0.1538520;
    b3 = 0.86650 * b3 + white * 0.3104856;
    b4 = 0.55000 * b4 + white * 0.5329522;
    b5 = -0.7616 * b5 - white * 0.0168980;
    data[i] = (b0 + b1 + b2 + b3 + b4 + b5 + b6 + white * 0.5362) * 0.11;
    b6 = white * 0.115926;
  }

  return buffer;
}

/**
 * Synthesizes a White Noise AudioBuffer (flat power spectral density).
 */
export function generateWhiteNoiseBuffer(ctx: AudioContext, durationSeconds: number = 5): AudioBuffer {
  const sampleRate = ctx.sampleRate;
  const bufferSize = sampleRate * durationSeconds;
  const buffer = ctx.createBuffer(1, bufferSize, sampleRate);
  const data = buffer.getChannelData(0);

  for (let i = 0; i < bufferSize; i++) {
    data[i] = (Math.random() * 2 - 1) * 0.25;
  }

  return buffer;
}

/**
 * Converts a frequency in Hz to normalized [0, 1] screen X ratio.
 */
export function frequencyToRatio(
  freqHz: number,
  isLog: boolean,
  minHz: number = 20,
  maxHz: number = 20000
): number {
  const f = Math.max(minHz, Math.min(maxHz, freqHz));
  if (isLog) {
    return Math.max(0, Math.min(1, Math.log10(f / minHz) / Math.log10(maxHz / minHz)));
  }
  return Math.max(0, Math.min(1, (f - minHz) / (maxHz - minHz)));
}

/**
 * Converts normalized [0, 1] screen X ratio to frequency in Hz.
 */
export function ratioToFrequency(
  ratio: number,
  isLog: boolean,
  minHz: number = 20,
  maxHz: number = 20000
): number {
  const r = Math.max(0, Math.min(1, ratio));
  if (isLog) {
    return minHz * Math.pow(maxHz / minHz, r);
  }
  return minHz + r * (maxHz - minHz);
}

/**
 * Converts a frequency in Hz to discrete FFT bin index.
 */
export function frequencyToBin(
  freqHz: number,
  sampleRate: number,
  binCount: number
): number {
  const hzPerBin = (sampleRate / 2) / binCount;
  return Math.max(0, Math.min(binCount - 1, Math.round(freqHz / hzPerBin)));
}

/**
 * Converts discrete FFT bin index to frequency in Hz.
 */
export function binToFrequency(
  binIndex: number,
  sampleRate: number,
  binCount: number
): number {
  const hzPerBin = (sampleRate / 2) / binCount;
  return binIndex * hzPerBin;
}

/**
 * Returns the FFT bin index corresponding to a given screen ratio.
 */
export function getBinForRatio(
  ratio: number,
  isLog: boolean,
  sampleRate: number,
  binCount: number,
  minHz: number = 20,
  maxHz: number = 20000
): number {
  const freq = ratioToFrequency(ratio, isLog, minHz, Math.min(maxHz, sampleRate / 2));
  return frequencyToBin(freq, sampleRate, binCount);
}

/**
 * Peak-preserving magnitude lookup for a range of ratios [ratioStart, ratioEnd].
 * Ensures narrow high-frequency spikes and harmonics are never lost due to bin skipping.
 */
export function getMagnitudeForRatio(
  freqData: Uint8Array,
  ratioStart: number,
  ratioEnd: number,
  isLog: boolean,
  sampleRate: number,
  binCount: number,
  minHz: number = 20,
  maxHz: number = 20000
): number {
  const fStart = ratioToFrequency(ratioStart, isLog, minHz, maxHz);
  const fEnd = ratioToFrequency(ratioEnd, isLog, minHz, maxHz);
  const bStart = frequencyToBin(Math.min(fStart, fEnd), sampleRate, binCount);
  const bEnd = frequencyToBin(Math.max(fStart, fEnd), sampleRate, binCount);

  if (bStart === bEnd) {
    return freqData[bStart] || 0;
  }

  let maxVal = 0;
  for (let b = bStart; b <= bEnd; b++) {
    const val = freqData[b];
    if (val > maxVal) maxVal = val;
  }
  return maxVal;
}

/**
 * IEC 61672-1 Standard A-Weighting Filter Offset (dB).
 * Reflects human ear sensitivity attenuation (cuts bass and high frequencies, peaks around 2.5kHz).
 */
export function getAWeightingOffsetDb(freqHz: number): number {
  if (freqHz <= 0 || !isFinite(freqHz)) return -100;
  const f2 = freqHz * freqHz;
  const c1 = 12194.217 * 12194.217;
  const c2 = 20.598997 * 20.598997;
  const c3 = 107.65265 * 107.65265;
  const c4 = 737.86223 * 737.86223;
  
  const num = c1 * f2 * f2;
  const den = (f2 + c2) * Math.sqrt((f2 + c3) * (f2 + c4)) * (f2 + c1);
  if (den <= 0) return -100;
  const ra = num / den;
  return 20 * Math.log10(ra) + 2.0; // 0.0 dB at 1,000 Hz
}

/**
 * IEC 61672-1 Standard C-Weighting Filter Offset (dB).
 * Flat across speech frequencies with moderate roll-off at infrasonic (<31.5Hz) and ultrasonic (>8kHz).
 */
export function getCWeightingOffsetDb(freqHz: number): number {
  if (freqHz <= 0 || !isFinite(freqHz)) return -100;
  const f2 = freqHz * freqHz;
  const c1 = 12194.217 * 12194.217;
  const c2 = 20.598997 * 20.598997;
  const num = c1 * f2;
  const den = (f2 + c2) * (f2 + c1);
  if (den <= 0) return -100;
  const rc = num / den;
  return 20 * Math.log10(rc) + 0.06; // 0.0 dB at 1,000 Hz
}

/**
 * Returns the dB offset for a specified frequency under the selected weighting standard.
 */
export function getWeightingOffsetDb(freqHz: number, weighting: FrequencyWeighting): number {
  if (weighting === 'A') return getAWeightingOffsetDb(freqHz);
  if (weighting === 'C') return getCWeightingOffsetDb(freqHz);
  return 0.0; // Z / Flat unweighted
}

/**
 * High-precision Float32 magnitude lookup for sub-0.01 dBFS accuracy.
 */
export function getFloatMagnitudeForRatio(
  floatFreqData: Float32Array,
  ratioStart: number,
  ratioEnd: number,
  isLog: boolean,
  sampleRate: number,
  binCount: number,
  minHz: number = 20,
  maxHz: number = 20000
): number {
  const fStart = ratioToFrequency(ratioStart, isLog, minHz, maxHz);
  const fEnd = ratioToFrequency(ratioEnd, isLog, minHz, maxHz);
  const bStart = frequencyToBin(Math.min(fStart, fEnd), sampleRate, binCount);
  const bEnd = frequencyToBin(Math.max(fStart, fEnd), sampleRate, binCount);

  if (bStart === bEnd) {
    return floatFreqData[bStart] ?? -100;
  }

  let maxVal = -150;
  for (let b = bStart; b <= bEnd; b++) {
    const val = floatFreqData[b] ?? -150;
    if (val > maxVal) maxVal = val;
  }
  return maxVal;
}

/**
 * Real-Time Total Harmonic Distortion (THD% & THD+N dB) Analyzer.
 * Extracts the prominent fundamental and measures overtone energy at 2x, 3x, 4x, 5x, 6x, 7x, 8x.
 */
export function analyzeTotalHarmonicDistortion(
  floatFreqData: Float32Array,
  sampleRate: number,
  targetFundHz?: number
): DistortionAnalysis {
  const binCount = floatFreqData.length;
  const hzPerBin = (sampleRate / 2) / binCount;
  const minAudibleBin = Math.max(1, Math.ceil(20 / hzPerBin));
  const maxAudibleBin = Math.min(binCount - 1, Math.floor(20000 / hzPerBin));

  // 1. Locate fundamental peak
  let fundBin = 0;
  let maxDb = -150;

  if (targetFundHz && targetFundHz >= 20 && targetFundHz <= 10000) {
    // Search window within ±15% of specified target frequency
    const centerBin = frequencyToBin(targetFundHz, sampleRate, binCount);
    const win = Math.max(2, Math.round((targetFundHz * 0.15) / hzPerBin));
    const start = Math.max(minAudibleBin, centerBin - win);
    const end = Math.min(maxAudibleBin, centerBin + win);

    for (let i = start; i <= end; i++) {
      const val = floatFreqData[i];
      if (val > maxDb) {
        maxDb = val;
        fundBin = i;
      }
    }
  }

  // Fallback: search global maximum above 20 Hz
  if (maxDb <= -75 || fundBin === 0) {
    for (let i = minAudibleBin; i <= maxAudibleBin; i++) {
      const val = floatFreqData[i];
      if (val > maxDb) {
        maxDb = val;
        fundBin = i;
      }
    }
  }

  // Check if a valid tone is present (fundamental must be at least -70 dBFS)
  const isTone = maxDb > -70 && fundBin > minAudibleBin;
  if (!isTone) {
    return {
      isToneDetected: false,
      detected: false,
      fundamentalHz: 0,
      fundamentalFormatted: '---',
      fundamentalDb: -100,
      fundamentalNote: '---',
      thdPercent: 0,
      thdDb: -120,
      thdPlusNDb: -120,
      snrDb: 0,
      harmonics: [],
    };
  }

  // Parabolic interpolation around fundamental peak
  let refinedFundHz = fundBin * hzPerBin;
  if (fundBin > 0 && fundBin < binCount - 1) {
    const a = floatFreqData[fundBin - 1];
    const b = floatFreqData[fundBin];
    const c = floatFreqData[fundBin + 1];
    const denom = a - 2 * b + c;
    if (denom < -1e-4) {
      const delta = 0.5 * ((a - c) / denom);
      refinedFundHz = Math.max(20, (fundBin + Math.max(-0.5, Math.min(0.5, delta))) * hzPerBin);
    }
  }

  const fundPower = Math.pow(10, maxDb / 10);
  const harmonics: HarmonicOvertone[] = [];

  // Excluded bins set to isolate noise floor from harmonic peaks
  const toneBins = new Set<number>();
  for (let b = Math.max(0, fundBin - 2); b <= Math.min(binCount - 1, fundBin + 2); b++) {
    toneBins.add(b);
  }

  let harmonicPowerSum = 0;
  const maxHarmonics = 8;

  for (let h = 2; h <= maxHarmonics; h++) {
    const harmTargetHz = refinedFundHz * h;
    if (harmTargetHz >= (sampleRate / 2) - 100) break;

    const harmCenterBin = frequencyToBin(harmTargetHz, sampleRate, binCount);
    const searchWin = Math.max(1, Math.round((harmTargetHz * 0.04) / hzPerBin));
    const sStart = Math.max(minAudibleBin, harmCenterBin - searchWin);
    const sEnd = Math.min(binCount - 1, harmCenterBin + searchWin);

    let hMaxDb = -150;
    let hMaxBin = harmCenterBin;
    for (let b = sStart; b <= sEnd; b++) {
      toneBins.add(b);
      const val = floatFreqData[b];
      if (val > hMaxDb) {
        hMaxDb = val;
        hMaxBin = b;
      }
    }

    // Parabolic interpolation for harmonic peak frequency
    let hRefinedHz = hMaxBin * hzPerBin;
    if (hMaxBin > 0 && hMaxBin < binCount - 1) {
      const a = floatFreqData[hMaxBin - 1];
      const b = floatFreqData[hMaxBin];
      const c = floatFreqData[hMaxBin + 1];
      const denom = a - 2 * b + c;
      if (denom < -1e-4) {
        const delta = 0.5 * ((a - c) / denom);
        hRefinedHz = (hMaxBin + Math.max(-0.5, Math.min(0.5, delta))) * hzPerBin;
      }
    }

    const hPower = Math.pow(10, hMaxDb / 10);
    harmonicPowerSum += hPower;

    const deltaDb = hMaxDb - maxDb;
    const powerPercent = fundPower > 0 ? (hPower / fundPower) * 100 : 0;
    const actualHzRounded = Math.round(hRefinedHz * 10) / 10;
    const expectedHzRounded = Math.round(harmTargetHz * 10) / 10;
    const levelRounded = Number(hMaxDb.toFixed(1));
    const deltaRounded = Number(deltaDb.toFixed(1));

    harmonics.push({
      order: h,
      freqHz: actualHzRounded,
      expectedHz: expectedHzRounded,
      actualHz: actualHzRounded,
      levelDb: levelRounded,
      magnitudeDb: levelRounded,
      deltaDb: deltaRounded,
      relativeDb: deltaRounded,
      powerPercent: Number(powerPercent.toFixed(3)),
    });
  }

  // Calculate residual noise power
  let noisePowerSum = 0;
  for (let i = minAudibleBin; i <= maxAudibleBin; i++) {
    if (!toneBins.has(i)) {
      noisePowerSum += Math.pow(10, floatFreqData[i] / 10);
    }
  }

  // THD calculation
  const thdRatio = fundPower > 0 ? Math.sqrt(harmonicPowerSum / fundPower) : 0;
  const thdPercent = Math.min(100, thdRatio * 100);
  const thdDb = thdPercent > 0 ? 20 * Math.log10(thdPercent / 100) : -120;

  // THD + Noise calculation
  const thdPlusNRatio = fundPower > 0 ? Math.sqrt((harmonicPowerSum + noisePowerSum) / fundPower) : 0;
  const thdPlusNDb = thdPlusNRatio > 0 ? 20 * Math.log10(thdPlusNRatio) : -120;

  // Signal-to-Noise Ratio (SNR)
  const snrDb = noisePowerSum > 0 && fundPower > 0 ? 10 * Math.log10(fundPower / noisePowerSum) : 0;

  const noteInfo = frequencyToNote(refinedFundHz);

  return {
    isToneDetected: true,
    detected: true,
    fundamentalHz: Math.round(refinedFundHz * 10) / 10,
    fundamentalFormatted: formatFrequency(refinedFundHz),
    fundamentalDb: Number(maxDb.toFixed(1)),
    fundamentalNote: noteInfo.formatted,
    thdPercent: Number(thdPercent.toFixed(3)),
    thdDb: Number(thdDb.toFixed(1)),
    thdPlusNDb: Number(thdPlusNDb.toFixed(1)),
    snrDb: Number(snrDb.toFixed(1)),
    harmonics,
  };
}

