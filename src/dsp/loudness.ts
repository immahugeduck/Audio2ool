/**
 * ITU-R BS.1770-4 / EBU R128 loudness, loudness range (EBU Tech 3342) and true peak.
 * Pure functions over Float32 channel data so they run in a worker and in Node tests.
 */

export interface Biquad { b0: number; b1: number; b2: number; a1: number; a2: number }

/**
 * K-weighting stage 1 (high shelf) and stage 2 (RLB high-pass), recomputed for any sample
 * rate with the bilinear-transform design used by libebur128. At 48 kHz this reproduces the
 * BS.1770 coefficient table.
 */
export function kWeightingCoefficients(sampleRate: number): [Biquad, Biquad] {
  let f0 = 1681.974450955533;
  const G = 3.999843853973347;
  let Q = 0.7071752369554196;
  let K = Math.tan((Math.PI * f0) / sampleRate);
  const Vh = Math.pow(10, G / 20);
  const Vb = Math.pow(Vh, 0.4996667741545416);
  let a0 = 1 + K / Q + K * K;
  const shelf: Biquad = {
    b0: (Vh + (Vb * K) / Q + K * K) / a0,
    b1: (2 * (K * K - Vh)) / a0,
    b2: (Vh - (Vb * K) / Q + K * K) / a0,
    a1: (2 * (K * K - 1)) / a0,
    a2: (1 - K / Q + K * K) / a0,
  };
  f0 = 38.13547087602444;
  Q = 0.5003270373238773;
  K = Math.tan((Math.PI * f0) / sampleRate);
  a0 = 1 + K / Q + K * K;
  const hp: Biquad = {
    b0: 1,
    b1: -2,
    b2: 1,
    a1: (2 * (K * K - 1)) / a0,
    a2: (1 - K / Q + K * K) / a0,
  };
  return [shelf, hp];
}

export function applyBiquad(x: ArrayLike<number>, c: Biquad): Float64Array {
  const y = new Float64Array(x.length);
  let x1 = 0, x2 = 0, y1 = 0, y2 = 0;
  for (let i = 0; i < x.length; i++) {
    const xi = x[i];
    const yi = c.b0 * xi + c.b1 * x1 + c.b2 * x2 - c.a1 * y1 - c.a2 * y2;
    x2 = x1; x1 = xi; y2 = y1; y1 = yi;
    y[i] = yi;
  }
  return y;
}

export function kWeight(x: ArrayLike<number>, sampleRate: number): Float64Array {
  const [s1, s2] = kWeightingCoefficients(sampleRate);
  return applyBiquad(applyBiquad(x, s1), s2);
}

const LUFS_OFFSET = -0.691;
const toLufs = (ms: number) => (ms > 0 ? LUFS_OFFSET + 10 * Math.log10(ms) : -Infinity);

/** Mean-square (summed over channels, weights 1.0 for L/R/C) of K-weighted blocks. */
function blockPowers(weighted: Float64Array[], sampleRate: number, blockSec: number, hopSec: number): number[] {
  const n = weighted[0]?.length ?? 0;
  const block = Math.round(blockSec * sampleRate);
  const hop = Math.max(1, Math.round(hopSec * sampleRate));
  if (n < block || block <= 0) return [];
  // prefix sums of squares per channel for O(1) block energy
  const prefix = weighted.map((ch) => {
    const p = new Float64Array(n + 1);
    for (let i = 0; i < n; i++) p[i + 1] = p[i] + ch[i] * ch[i];
    return p;
  });
  const out: number[] = [];
  for (let start = 0; start + block <= n; start += hop) {
    let z = 0;
    for (const p of prefix) z += (p[start + block] - p[start]) / block;
    out.push(z);
  }
  return out;
}

export interface LoudnessResult {
  integratedLufs: number;
  /** Loudness range (LU), EBU Tech 3342. */
  lraLu: number;
  /** Highest momentary (400 ms) loudness. */
  maxMomentaryLufs: number;
  /** Highest short-term (3 s) loudness. */
  maxShortTermLufs: number;
}

export function measureLoudness(channels: ArrayLike<number>[], sampleRate: number): LoudnessResult {
  const weighted = channels.slice(0, 5).map((c) => kWeight(c, sampleRate));
  // Integrated: 400 ms blocks, 75 % overlap, absolute gate -70 LUFS, relative gate -10 LU
  const m = blockPowers(weighted, sampleRate, 0.4, 0.1);
  const absGated = m.filter((z) => toLufs(z) > -70);
  let integratedLufs = -Infinity;
  if (absGated.length) {
    const rel = toLufs(absGated.reduce((a, b) => a + b, 0) / absGated.length) - 10;
    const relGated = absGated.filter((z) => toLufs(z) > rel);
    if (relGated.length) integratedLufs = toLufs(relGated.reduce((a, b) => a + b, 0) / relGated.length);
  }
  // LRA: 3 s short-term blocks, hop 100 ms (>= 10 Hz), abs gate -70, relative gate -20 LU, P95 - P10
  const st = blockPowers(weighted, sampleRate, 3, 0.1);
  const stAbs = st.filter((z) => toLufs(z) > -70);
  let lraLu = 0;
  if (stAbs.length) {
    const rel = toLufs(stAbs.reduce((a, b) => a + b, 0) / stAbs.length) - 20;
    const vals = stAbs.map(toLufs).filter((l) => l > rel).sort((a, b) => a - b);
    if (vals.length) {
      const pct = (p: number) => vals[Math.min(vals.length - 1, Math.max(0, Math.round((p / 100) * (vals.length - 1))))];
      lraLu = pct(95) - pct(10);
    }
  }
  const maxMomentaryLufs = m.length ? toLufs(Math.max(...m)) : -Infinity;
  const maxShortTermLufs = st.length ? toLufs(Math.max(...st)) : -Infinity;
  return { integratedLufs, lraLu, maxMomentaryLufs, maxShortTermLufs };
}

/** Sample peak in dBFS across channels. */
export function samplePeakDb(channels: ArrayLike<number>[]): number {
  let m = 0;
  for (const c of channels) for (let i = 0; i < c.length; i++) { const a = Math.abs(c[i]); if (a > m) m = a; }
  return m > 0 ? 20 * Math.log10(m) : -Infinity;
}

/** RMS in dBFS (mean over channels' mean squares, DC included like a plain RMS meter). */
export function rmsDb(channels: ArrayLike<number>[]): number {
  let s = 0, n = 0;
  for (const c of channels) for (let i = 0; i < c.length; i++) { s += c[i] * c[i]; n++; }
  return n && s > 0 ? 10 * Math.log10(s / n) : -Infinity;
}

let cachedTaps: Float64Array[] | null = null;
/** 4x polyphase interpolation filter: windowed sinc, 48 taps per phase (BS.1770-4 Annex 2 style). */
function truePeakPhases(): Float64Array[] {
  if (cachedTaps) return cachedTaps;
  const L = 4;
  const tapsPerPhase = 48;
  const N = L * tapsPerPhase;
  const h = new Float64Array(N);
  const center = (N - 1) / 2;
  for (let i = 0; i < N; i++) {
    const t = (i - center) / L;
    const sinc = t === 0 ? 1 : Math.sin(Math.PI * t) / (Math.PI * t);
    const w = 0.42 - 0.5 * Math.cos((2 * Math.PI * i) / (N - 1)) + 0.08 * Math.cos((4 * Math.PI * i) / (N - 1));
    h[i] = sinc * w;
  }
  cachedTaps = [];
  for (let p = 0; p < L; p++) {
    const ph = new Float64Array(tapsPerPhase);
    let sum = 0;
    for (let k = 0; k < tapsPerPhase; k++) { ph[k] = h[k * L + p]; sum += ph[k]; }
    for (let k = 0; k < tapsPerPhase; k++) ph[k] /= sum; // unity DC gain per phase
    cachedTaps.push(ph);
  }
  return cachedTaps;
}

/**
 * True peak (dBTP) via 4x oversampling. Always >= the sample peak (sample values are included).
 * Only neighbourhoods that could exceed the sample peak are interpolated: an interpolated value
 * is bounded by (max |x| in its window) * (L1 norm of the phase filter), so windows whose samples
 * are all below samplePeak / L1 are skipped exactly, not approximately.
 */
export function truePeakDb(channels: ArrayLike<number>[]): number {
  const phases = truePeakPhases();
  const T = phases[0].length;
  const halfT = T >> 1;
  let l1 = 0;
  for (const ph of phases) { let s = 0; for (const v of ph) s += Math.abs(v); l1 = Math.max(l1, s); }
  let sp = 0;
  for (const c of channels) for (let i = 0; i < c.length; i++) { const a = Math.abs(c[i]); if (a > sp) sp = a; }
  if (sp === 0) return -Infinity;
  let m = sp;
  for (const c of channels) {
    const n = c.length;
    // candidate mask: samples within T of any sample >= m / l1
    let lastHot = -Infinity;
    const thr = sp / l1;
    // Seed with the first halfT samples: the look-ahead below starts at index halfT.
    for (let j = 0; j < Math.min(halfT, n); j++) if (Math.abs(c[j]) >= thr) lastHot = j;
    for (let i = 0; i < n; i++) {
      // look ahead so the window [i - halfT, i + halfT] is covered
      const ahead = i + halfT;
      if (ahead < n && Math.abs(c[ahead]) >= thr) lastHot = ahead;
      if (i - lastHot > T) continue;
      for (const ph of phases) {
        let acc = 0;
        for (let k = 0; k < T; k++) {
          const idx = i - k + halfT;
          if (idx >= 0 && idx < n) acc += c[idx] * ph[k];
        }
        const v = Math.abs(acc);
        if (v > m) m = v;
      }
    }
  }
  return 20 * Math.log10(m);
}
