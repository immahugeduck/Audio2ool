/** Small dependency-free FFT and windowing helpers (radix-2, in place). */

export type WindowType = 'hann' | 'blackman' | 'blackman-harris' | 'rect';

export function isPowerOfTwo(n: number): boolean {
  return n > 0 && (n & (n - 1)) === 0;
}

export function nextPowerOfTwo(n: number): number {
  let p = 1;
  while (p < n) p <<= 1;
  return p;
}

/** In-place iterative radix-2 complex FFT. `re` and `im` must have the same power-of-two length. */
export function fftInPlace(re: Float64Array, im: Float64Array): void {
  const n = re.length;
  if (!isPowerOfTwo(n) || im.length !== n) throw new Error('FFT length must be a power of two');
  for (let i = 1, j = 0; i < n; i++) {
    let bit = n >> 1;
    for (; j & bit; bit >>= 1) j ^= bit;
    j ^= bit;
    if (i < j) {
      let t = re[i]; re[i] = re[j]; re[j] = t;
      t = im[i]; im[i] = im[j]; im[j] = t;
    }
  }
  for (let len = 2; len <= n; len <<= 1) {
    const ang = (-2 * Math.PI) / len;
    const wRe = Math.cos(ang);
    const wIm = Math.sin(ang);
    const half = len >> 1;
    for (let i = 0; i < n; i += len) {
      let cRe = 1, cIm = 0;
      for (let k = 0; k < half; k++) {
        const aRe = re[i + k], aIm = im[i + k];
        const bRe = re[i + k + half] * cRe - im[i + k + half] * cIm;
        const bIm = re[i + k + half] * cIm + im[i + k + half] * cRe;
        re[i + k] = aRe + bRe; im[i + k] = aIm + bIm;
        re[i + k + half] = aRe - bRe; im[i + k + half] = aIm - bIm;
        const nRe = cRe * wRe - cIm * wIm;
        cIm = cRe * wIm + cIm * wRe;
        cRe = nRe;
      }
    }
  }
}

export function makeWindow(type: WindowType, length: number): Float64Array {
  const w = new Float64Array(length);
  const N = length;
  for (let i = 0; i < N; i++) {
    const x = (2 * Math.PI * i) / N;
    switch (type) {
      case 'hann': w[i] = 0.5 - 0.5 * Math.cos(x); break;
      case 'blackman': w[i] = 0.42 - 0.5 * Math.cos(x) + 0.08 * Math.cos(2 * x); break;
      case 'blackman-harris':
        w[i] = 0.35875 - 0.48829 * Math.cos(x) + 0.14128 * Math.cos(2 * x) - 0.01168 * Math.cos(3 * x);
        break;
      default: w[i] = 1;
    }
  }
  return w;
}

/**
 * Windowed magnitude spectrum in dBFS-like units: a full-scale sine reads about 0 dB
 * (amplitude-normalised by the window's coherent gain). Optional zero-padding to `fftSize`.
 * Returns fftSize/2 bins; bin i is at i * sampleRate / fftSize Hz.
 */
export function magnitudeSpectrumDb(
  samples: ArrayLike<number>,
  fftSize: number,
  windowType: WindowType = 'blackman-harris',
  start = 0,
  segmentLength?: number
): Float32Array {
  const segLen = Math.min(segmentLength ?? fftSize, fftSize, Math.max(0, samples.length - start));
  const re = new Float64Array(fftSize);
  const im = new Float64Array(fftSize);
  const w = makeWindow(windowType, segLen);
  let wSum = 0;
  for (let i = 0; i < segLen; i++) {
    re[i] = samples[start + i] * w[i];
    wSum += w[i];
  }
  fftInPlace(re, im);
  const half = fftSize >> 1;
  const out = new Float32Array(half);
  const norm = wSum > 0 ? 2 / wSum : 0;
  for (let i = 0; i < half; i++) {
    const mag = Math.sqrt(re[i] * re[i] + im[i] * im[i]) * norm;
    out[i] = mag > 1e-12 ? 20 * Math.log10(mag) : -240;
  }
  return out;
}
