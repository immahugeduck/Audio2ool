/**
 * Pure spectral peak picking helpers (no Web Audio dependencies) so they can be
 * unit tested in Node and reused by the live engine and offline analysis.
 */

export interface SpectralPeak {
  /** Refined frequency in Hz (parabolic interpolation on the dB spectrum). */
  hz: number;
  /** Interpolated peak level in dB (same scale as the input spectrum). */
  db: number;
  /** Height above the local median floor in dB. */
  prominenceDb: number;
  /** Integer bin index of the local maximum. */
  bin: number;
}

export interface PeakSearchOptions {
  minHz?: number;
  maxHz?: number;
  /** Required height above the local median floor. Default 10 dB. */
  minProminenceDb?: number;
  /** Absolute level floor; quieter local maxima are ignored. Default -100 dB. */
  minDb?: number;
  /** Maximum peaks to return (loudest first). Default 8. */
  maxPeaks?: number;
  /** Half-width (in bins) of the window used for the local median floor. Default 32. */
  floorHalfWidthBins?: number;
  /** A peak must be the maximum within +/- this many bins (rejects window side lobes). Default 3. */
  neighbourhoodBins?: number;
  /** Ignore peaks more than this many dB below the strongest peak found. Default 60 dB. */
  maxBelowStrongestDb?: number;
}

/**
 * Quadratic (parabolic) interpolation of a peak from three neighbouring dB values.
 * Returns the fractional bin offset in [-0.5, 0.5] and the interpolated level.
 */
export function parabolicInterpolate(alpha: number, beta: number, gamma: number): { offset: number; value: number } {
  const denom = alpha - 2 * beta + gamma;
  if (!isFinite(denom) || denom >= -1e-9) return { offset: 0, value: beta };
  let offset = 0.5 * (alpha - gamma) / denom;
  offset = Math.max(-0.5, Math.min(0.5, offset));
  const value = beta - 0.25 * (alpha - gamma) * offset;
  return { offset, value };
}

function median(values: number[]): number {
  if (values.length === 0) return -Infinity;
  const s = values.slice().sort((a, b) => a - b);
  const mid = s.length >> 1;
  return s.length % 2 ? s[mid] : 0.5 * (s[mid - 1] + s[mid]);
}

/**
 * Finds prominent local maxima in a dB magnitude spectrum.
 * `spectrumDb[i]` is the level of bin i, whose centre frequency is i * sampleRate / fftSize.
 */
export function findSpectralPeaks(
  spectrumDb: ArrayLike<number>,
  sampleRate: number,
  fftSize: number,
  options: PeakSearchOptions = {}
): SpectralPeak[] {
  const {
    minHz = 20,
    maxHz = 20000,
    minProminenceDb = 10,
    minDb = -100,
    maxPeaks = 8,
    floorHalfWidthBins = 32,
    neighbourhoodBins = 3,
    maxBelowStrongestDb = 60,
  } = options;
  const n = spectrumDb.length;
  if (n < 3 || sampleRate <= 0 || fftSize <= 0) return [];
  const hzPerBin = sampleRate / fftSize;
  const lo = Math.max(1, Math.ceil(minHz / hzPerBin));
  const hi = Math.min(n - 2, Math.floor(maxHz / hzPerBin));
  const peaks: SpectralPeak[] = [];

  for (let i = lo; i <= hi; i++) {
    const v = spectrumDb[i];
    if (!isFinite(v) || v < minDb) continue;
    if (!(v > spectrumDb[i - 1] && v >= spectrumDb[i + 1])) continue;
    let isNeighbourhoodMax = true;
    for (let k = Math.max(0, i - neighbourhoodBins); k <= Math.min(n - 1, i + neighbourhoodBins); k++) {
      if (k !== i && spectrumDb[k] > v) { isNeighbourhoodMax = false; break; }
    }
    if (!isNeighbourhoodMax) continue;

    const a = Math.max(0, i - floorHalfWidthBins);
    const b = Math.min(n - 1, i + floorHalfWidthBins);
    const neighbourhood: number[] = [];
    for (let k = a; k <= b; k++) {
      const x = spectrumDb[k];
      neighbourhood.push(isFinite(x) ? x : -200);
    }
    const floor = median(neighbourhood);
    const prominence = v - floor;
    if (prominence < minProminenceDb) continue;

    const { offset, value } = parabolicInterpolate(spectrumDb[i - 1], v, spectrumDb[i + 1]);
    const hz = (i + offset) * hzPerBin;
    if (hz < minHz || hz > maxHz) continue;
    peaks.push({ hz, db: value, prominenceDb: prominence, bin: i });
  }

  peaks.sort((p, q) => q.db - p.db);
  if (peaks.length === 0) return peaks;
  const strongest = peaks[0].db;
  return peaks.filter((p) => p.db >= strongest - maxBelowStrongestDb).slice(0, maxPeaks);
}

/** Pearson-style inter-channel correlation in [-1, 1] (no mean removal, like a phase meter). */
export function channelCorrelation(left: ArrayLike<number>, right: ArrayLike<number>): number | null {
  const n = Math.min(left.length, right.length);
  if (n === 0) return null;
  let lr = 0, ll = 0, rr = 0;
  for (let i = 0; i < n; i++) {
    const l = left[i];
    const r = right[i];
    lr += l * r;
    ll += l * l;
    rr += r * r;
  }
  const denom = Math.sqrt(ll * rr);
  if (denom < 1e-12) return null;
  return Math.max(-1, Math.min(1, lr / denom));
}

export interface BinauralReadout {
  leftHz: number | null;
  rightHz: number | null;
  leftDb: number | null;
  rightDb: number | null;
  /** |fL - fR| when both channels have a dominant tone, otherwise null. */
  differenceHz: number | null;
  /** True when the L/R difference is in the audible binaural-beat range (0 < diff <= 40 Hz). */
  isBinaural: boolean;
  /** True when both channels show the same dominant frequency (within tolerance). */
  sameFrequency: boolean;
  correlation: number | null;
}

export const BINAURAL_MAX_BEAT_HZ = 40;

export function computeBinauralReadout(
  leftPeaks: SpectralPeak[],
  rightPeaks: SpectralPeak[],
  correlation: number | null,
  toleranceHz = 0.05
): BinauralReadout {
  const l = leftPeaks[0] ?? null;
  const r = rightPeaks[0] ?? null;
  let differenceHz: number | null = null;
  let sameFrequency = false;
  let isBinaural = false;
  if (l && r) {
    const diff = Math.abs(l.hz - r.hz);
    sameFrequency = diff <= toleranceHz;
    differenceHz = sameFrequency ? 0 : diff;
    isBinaural = !sameFrequency && diff <= BINAURAL_MAX_BEAT_HZ;
  }
  return {
    leftHz: l ? l.hz : null,
    rightHz: r ? r.hz : null,
    leftDb: l ? l.db : null,
    rightDb: r ? r.db : null,
    differenceHz,
    isBinaural,
    sameFrequency,
    correlation,
  };
}

/** Level of a spectrum at an arbitrary frequency (max of the two nearest bins). */
export function levelAtHz(spectrumDb: ArrayLike<number>, hz: number, sampleRate: number, fftSize: number): number {
  const pos = (hz * fftSize) / sampleRate;
  const i = Math.floor(pos);
  const a = i >= 0 && i < spectrumDb.length ? spectrumDb[i] : -Infinity;
  const b = i + 1 >= 0 && i + 1 < spectrumDb.length ? spectrumDb[i + 1] : -Infinity;
  return Math.max(a, b);
}

export interface StereoToneOptions extends PeakSearchOptions {
  /** How much louder a tone must be in its own channel than in the other to count as channel-exclusive. Default 12 dB. */
  exclusivityDb?: number;
  /** Peaks per channel considered when searching for a binaural carrier pair. Default 12. */
  candidatePeaks?: number;
}

/**
 * Stereo tone readout that understands binaural recordings mixed with music:
 * a binaural carrier is a tone present in ONE channel only, paired with a different
 * channel-exclusive tone in the other channel within 40 Hz. Content shared by both
 * channels (pads, music) is ignored for the beat. Falls back to each channel's
 * dominant peak when no such pair exists.
 */
export function analyzeStereoTones(
  specL: ArrayLike<number>,
  specR: ArrayLike<number>,
  sampleRate: number,
  fftSize: number,
  correlation: number | null,
  options: StereoToneOptions = {}
): BinauralReadout & { mode: 'binaural-pair' | 'dominant' } {
  const { exclusivityDb = 12, candidatePeaks = 12, ...peakOpts } = options;
  const pl = findSpectralPeaks(specL, sampleRate, fftSize, { ...peakOpts, maxPeaks: candidatePeaks });
  const pr = findSpectralPeaks(specR, sampleRate, fftSize, { ...peakOpts, maxPeaks: candidatePeaks });

  const exclusiveL = pl.filter((p) => p.db - levelAtHz(specR, p.hz, sampleRate, fftSize) >= exclusivityDb);
  const exclusiveR = pr.filter((p) => p.db - levelAtHz(specL, p.hz, sampleRate, fftSize) >= exclusivityDb);

  let best: { l: SpectralPeak; r: SpectralPeak; score: number } | null = null;
  for (const l of exclusiveL) {
    for (const r of exclusiveR) {
      const diff = Math.abs(l.hz - r.hz);
      if (diff <= 0 || diff > BINAURAL_MAX_BEAT_HZ) continue;
      const score = Math.min(l.db, r.db);
      if (!best || score > best.score) best = { l, r, score };
    }
  }

  if (best) {
    return { ...computeBinauralReadout([best.l], [best.r], correlation), mode: 'binaural-pair' };
  }
  return { ...computeBinauralReadout(pl, pr, correlation), mode: 'dominant' };
}
