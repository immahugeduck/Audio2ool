/** Offline tempo (BPM) and musical key estimation. Pure functions over mono Float32 audio. */
import { fftInPlace, makeWindow } from './fft';

export interface StftFrames {
  /** magnitude frames, each frameSize/2 bins */
  frames: Float32Array[];
  hop: number;
  frameSize: number;
  sampleRate: number;
}

export function stftMagnitudes(x: ArrayLike<number>, sampleRate: number, frameSize: number, hop: number): StftFrames {
  const w = makeWindow('hann', frameSize);
  const half = frameSize >> 1;
  const frames: Float32Array[] = [];
  const re = new Float64Array(frameSize);
  const im = new Float64Array(frameSize);
  for (let start = 0; start + frameSize <= x.length; start += hop) {
    for (let i = 0; i < frameSize; i++) { re[i] = x[start + i] * w[i]; im[i] = 0; }
    fftInPlace(re, im);
    const mag = new Float32Array(half);
    for (let i = 0; i < half; i++) mag[i] = Math.sqrt(re[i] * re[i] + im[i] * im[i]);
    frames.push(mag);
  }
  return { frames, hop, frameSize, sampleRate };
}

/** Mixes channels to mono and decimates by an integer factor with a simple moving-average anti-alias. */
export function toMono(channels: ArrayLike<number>[], decimate = 1): Float32Array {
  const n = channels[0]?.length ?? 0;
  const out = new Float32Array(Math.floor(n / decimate));
  for (let j = 0; j < out.length; j++) {
    let s = 0;
    for (let k = 0; k < decimate; k++) {
      const i = j * decimate + k;
      for (const c of channels) s += c[i];
    }
    out[j] = s / (decimate * channels.length);
  }
  return out;
}

export interface TempoResult {
  bpm: number;
  confidence: number; // 0..1, normalised autocorrelation strength
  /** z-score of the chosen periodicity within the searched lag range. */
  salience: number;
  pulseRatio: number;
  /** False for material without a steady pulse (tones, drones, noise): show "no clear beat". */
  hasClearBeat: boolean;
  alternatives: { bpm: number; strength: number }[];
  /**
   * Set when the strongest periodicity was outside the preferred 70-140 BPM range and the
   * reported tempo is its half/double (e.g. a hi-hat-driven 175 reported as 87.5 half-time).
   */
  foldedFromBpm?: number;
}

export const MIN_BEAT_SALIENCE = 3.5;
/** Normalised autocorrelation strength above which a pulse counts as clear (white noise ~0.43, steady tones <0.3). */
export const MIN_BEAT_STRENGTH = 0.55;
/** Minimum onset-envelope peakiness (steady tones ~0.04, music ~0.3+, drums ~0.8+). */
export const MIN_PULSE_RATIO = 0.15;

/** Preferred tempo range (DJ-software style) used to settle half/double-time ambiguity. */
export const PREFERRED_BPM_RANGE: [number, number] = [70, 140];

/**
 * Spectral-flux onset envelope -> autocorrelation -> tempo in [minBpm, maxBpm] with a
 * mild log-Gaussian prior around 100 BPM to settle half/double-time ambiguity.
 */
export function estimateTempo(mono: ArrayLike<number>, sampleRate: number, minBpm = 60, maxBpm = 180): TempoResult | null {
  const frameSize = 2048;
  const hop = 256;
  const { frames } = stftMagnitudes(mono, sampleRate, frameSize, hop);
  if (frames.length < 64) return null;
  const maxBin = Math.min(frames[0].length, Math.floor((8000 * frameSize) / sampleRate));
  const env = new Float64Array(frames.length);
  let prev: Float32Array | null = null;
  for (let t = 0; t < frames.length; t++) {
    const f = frames[t];
    let flux = 0;
    if (prev) {
      for (let k = 1; k < maxBin; k++) {
        const d = Math.log1p(1000 * f[k]) - Math.log1p(1000 * prev[k]);
        if (d > 0) flux += d;
      }
    }
    env[t] = flux;
    prev = f;
  }
  // remove slow trend (local mean over ~0.5 s) and half-wave rectify
  const fps = sampleRate / hop;
  const win = Math.max(1, Math.round(fps * 0.5));
  const detr = new Float64Array(env.length);
  let acc = 0;
  for (let i = 0; i < env.length; i++) {
    acc += env[i];
    if (i >= win) acc -= env[i - win];
    const mean = acc / Math.min(i + 1, win);
    detr[i] = Math.max(0, env[i] - mean);
  }
  // Onset "peakiness": share of the flux that stands above its local mean. Steady tones and
  // stationary noise have a flat envelope (low ratio); drums and note onsets have a spiky one.
  let envSum = 0, detrSum = 0;
  for (let i = 0; i < env.length; i++) { envSum += env[i]; detrSum += detr[i]; }
  const pulseRatio = envSum > 0 ? detrSum / envSum : 0;
  const lagMin = Math.floor((60 * fps) / maxBpm);
  const lagMax = Math.ceil((60 * fps) / minBpm);
  const ac = new Float64Array(lagMax + 2);
  let zero = 0;
  for (let i = 0; i < detr.length; i++) zero += detr[i] * detr[i];
  if (zero <= 0) return null;
  for (let lag = 1; lag <= lagMax + 1; lag++) {
    let s = 0;
    for (let i = lag; i < detr.length; i++) s += detr[i] * detr[i - lag];
    ac[lag] = s / zero;
  }
  const prior = (bpm: number) => Math.exp(-0.5 * Math.pow(Math.log2(bpm / 100) / 1.0, 2));
  const cands: { lag: number; bpm: number; strength: number; score: number }[] = [];
  for (let lag = Math.max(2, lagMin); lag <= lagMax; lag++) {
    if (ac[lag] > ac[lag - 1] && ac[lag] >= ac[lag + 1]) {
      // parabolic refinement of the lag
      const a = ac[lag - 1], b = ac[lag], c = ac[lag + 1];
      const den = a - 2 * b + c;
      const off = den < 0 ? Math.max(-0.5, Math.min(0.5, (0.5 * (a - c)) / den)) : 0;
      const bpm = (60 * fps) / (lag + off);
      // reinforce with the double-period lag (a true beat period also correlates at 2x)
      const l2 = Math.round(2 * (lag + off));
      const support = l2 < ac.length ? ac[l2] : 0;
      const strength = b + 0.5 * support;
      cands.push({ lag, bpm, strength, score: strength * prior(bpm) });
    }
  }
  if (!cands.length) return null;
  cands.sort((p, q) => q.score - p.score);
  const best = cands[0];
  // Salience: how far the chosen periodicity stands out from the autocorrelation in range (z-score).
  let mean = 0, cnt = 0;
  for (let lag = Math.max(2, lagMin); lag <= lagMax; lag++) { mean += ac[lag]; cnt++; }
  mean /= Math.max(1, cnt);
  let varSum = 0;
  for (let lag = Math.max(2, lagMin); lag <= lagMax; lag++) varSum += (ac[lag] - mean) ** 2;
  const sd = Math.sqrt(varSum / Math.max(1, cnt));
  const salience = sd > 0 ? (ac[best.lag] - mean) / sd : 0;
  let bpm = best.bpm;
  let foldedFromBpm: number | undefined;
  const [lo, hi] = PREFERRED_BPM_RANGE;
  if (bpm > hi || bpm < lo) {
    const target = bpm > hi ? bpm / 2 : bpm * 2;
    // Prefer a measured octave-related candidate (within 3 %) over a purely arithmetic fold.
    const related = cands.find((c) => Math.abs(c.bpm - target) / target < 0.03);
    const folded = related ? related.bpm : target;
    if (folded >= lo && folded <= hi) {
      foldedFromBpm = bpm;
      bpm = folded;
    }
  }
  return {
    bpm,
    confidence: Math.max(0, Math.min(1, best.strength)),
    salience,
    pulseRatio,
    hasClearBeat: salience >= MIN_BEAT_SALIENCE || (best.strength >= MIN_BEAT_STRENGTH && pulseRatio >= MIN_PULSE_RATIO),
    alternatives: cands.filter((c) => c !== best).slice(0, 3).map((c) => ({ bpm: c.bpm, strength: c.strength })),
    foldedFromBpm,
  };
}

export const PITCH_CLASSES = ['C', 'C#', 'D', 'D#', 'E', 'F', 'F#', 'G', 'G#', 'A', 'A#', 'B'];
// Krumhansl-Kessler key profiles
const MAJOR = [6.35, 2.23, 3.48, 2.33, 4.38, 4.09, 2.52, 5.19, 2.39, 3.66, 2.29, 2.88];
const MINOR = [6.33, 2.68, 3.52, 5.38, 2.6, 3.53, 2.54, 4.75, 3.98, 2.69, 3.34, 3.17];

export function chromaFromStft(stft: StftFrames, minHz = 55, maxHz = 5000): number[] {
  const chroma = new Array(12).fill(0);
  const { frames, frameSize, sampleRate } = stft;
  const hzPerBin = sampleRate / frameSize;
  const lo = Math.max(1, Math.floor(minHz / hzPerBin));
  const hi = Math.min((frames[0]?.length ?? 1) - 1, Math.ceil(maxHz / hzPerBin));
  const pcOfBin: number[] = [];
  for (let k = 0; k <= hi; k++) {
    const hz = k * hzPerBin;
    pcOfBin[k] = k < lo ? -1 : ((Math.round(12 * Math.log2(hz / 440)) % 12) + 12 + 9) % 12;
  }
  for (const f of frames) {
    // per-frame peak picking keeps tonal components and suppresses broadband noise
    for (let k = lo + 1; k < hi; k++) {
      const v = f[k];
      if (v > f[k - 1] && v >= f[k + 1]) chroma[pcOfBin[k]] += Math.sqrt(v);
    }
  }
  const max = Math.max(...chroma);
  return max > 0 ? chroma.map((c) => c / max) : chroma;
}

function pearson(a: number[], b: number[]): number {
  const n = a.length;
  const ma = a.reduce((s, v) => s + v, 0) / n;
  const mb = b.reduce((s, v) => s + v, 0) / n;
  let num = 0, da = 0, db = 0;
  for (let i = 0; i < n; i++) { num += (a[i] - ma) * (b[i] - mb); da += (a[i] - ma) ** 2; db += (b[i] - mb) ** 2; }
  return da > 0 && db > 0 ? num / Math.sqrt(da * db) : 0;
}

export interface KeyResult {
  key: string; // e.g. "D minor"
  tonic: string;
  mode: 'major' | 'minor';
  correlation: number;
  /** Margin over the runner-up key (0..1); small values mean low confidence. */
  confidence: number;
  runnerUp: string;
}

export function estimateKeyFromChroma(chroma: number[]): KeyResult | null {
  if (chroma.every((c) => c === 0)) return null;
  const scores: { key: string; tonic: string; mode: 'major' | 'minor'; r: number }[] = [];
  for (let t = 0; t < 12; t++) {
    const rot = (p: number[]) => p.map((_, i) => p[(i - t + 12) % 12]);
    scores.push({ key: `${PITCH_CLASSES[t]} major`, tonic: PITCH_CLASSES[t], mode: 'major', r: pearson(chroma, rot(MAJOR)) });
    scores.push({ key: `${PITCH_CLASSES[t]} minor`, tonic: PITCH_CLASSES[t], mode: 'minor', r: pearson(chroma, rot(MINOR)) });
  }
  scores.sort((a, b) => b.r - a.r);
  const [best, second] = scores;
  return {
    key: best.key, tonic: best.tonic, mode: best.mode, correlation: best.r,
    confidence: Math.max(0, best.r - second.r), runnerUp: second.key,
  };
}

export function estimateKey(mono: ArrayLike<number>, sampleRate: number): KeyResult | null {
  const stft = stftMagnitudes(mono, sampleRate, 8192, 4096);
  if (!stft.frames.length) return null;
  return estimateKeyFromChroma(chromaFromStft(stft));
}
