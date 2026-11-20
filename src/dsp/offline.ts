/**
 * Whole-file ("offline") analysis: high-resolution peak lists per channel, binaural carrier,
 * BS.1770 loudness, sample/true peak, RMS, tempo and key. Runs in a Web Worker in the app
 * and directly in Node for tests and fixture checks.
 */
import { magnitudeSpectrumDb, nextPowerOfTwo } from './fft';
import { findSpectralPeaks, analyzeStereoTones, channelCorrelation, SpectralPeak, BinauralReadout } from './peaks';
import { measureLoudness, samplePeakDb, truePeakDb, rmsDb, LoudnessResult } from './loudness';
import { estimateTempo, estimateKey, toMono, TempoResult, KeyResult } from './tempoKey';

export interface OfflineAnalysisInput {
  channels: Float32Array[];
  sampleRate: number;
  /** Optional analysis span for peak lists (Hz). */
  minHz?: number;
  maxHz?: number;
}

export interface OfflineAnalysisResult {
  durationSec: number;
  sampleRate: number;
  channelCount: number;
  segment: { startSec: number; lengthSec: number; fftSize: number; resolutionHz: number };
  peaksL: SpectralPeak[];
  peaksR: SpectralPeak[];
  stereo: (BinauralReadout & { mode: 'binaural-pair' | 'dominant' }) | null;
  loudness: LoudnessResult;
  samplePeakDb: number;
  truePeakDb: number;
  rmsDb: number;
  tempo: TempoResult | null;
  key: KeyResult | null;
  elapsedMs: number;
}

const prevPowerOfTwo = (n: number) => { let p = 1; while (p * 2 <= n) p *= 2; return p; };

export function analyzeOffline(input: OfflineAnalysisInput): OfflineAnalysisResult {
  const t0 = Date.now();
  const { sampleRate } = input;
  const channels = input.channels.length ? input.channels : [new Float32Array(0)];
  const n = channels[0].length;
  const L = channels[0];
  const R = channels[1] ?? channels[0];

  // Long segment from the middle of the file, Blackman-Harris, zero-padded 2x.
  const segLen = Math.min(prevPowerOfTwo(Math.max(1, n)), 1 << 18);
  const fftSize = nextPowerOfTwo(segLen) * 2;
  const start = Math.max(0, Math.floor((n - segLen) / 2));
  const specL = magnitudeSpectrumDb(L, fftSize, 'blackman-harris', start, segLen);
  const specR = magnitudeSpectrumDb(R, fftSize, 'blackman-harris', start, segLen);
  const pad = fftSize / segLen;
  const peakOpts = {
    minHz: input.minHz ?? 20,
    maxHz: Math.min(input.maxHz ?? 20000, sampleRate / 2),
    minProminenceDb: 10,
    minDb: -100,
    maxPeaks: 10,
    neighbourhoodBins: 4 * pad,
    floorHalfWidthBins: 64 * pad,
    maxBelowStrongestDb: 60,
  };
  const peaksL = findSpectralPeaks(specL, sampleRate, fftSize, peakOpts);
  const peaksR = findSpectralPeaks(specR, sampleRate, fftSize, peakOpts);
  const corr = channelCorrelation(L.subarray(start, start + segLen), R.subarray(start, start + segLen));
  const stereo = channels.length >= 2
    ? analyzeStereoTones(specL, specR, sampleRate, fftSize, corr, { ...peakOpts, sameToleranceHz: 0.005 })
    : null;

  const loudness = measureLoudness(channels, sampleRate);
  const decim = Math.max(1, Math.round(sampleRate / 22050));
  const mono = toMono(channels, decim);
  const monoRate = sampleRate / decim;

  return {
    durationSec: n / sampleRate,
    sampleRate,
    channelCount: input.channels.length,
    segment: { startSec: start / sampleRate, lengthSec: segLen / sampleRate, fftSize, resolutionHz: sampleRate / fftSize },
    peaksL,
    peaksR,
    stereo,
    loudness,
    samplePeakDb: samplePeakDb(channels),
    truePeakDb: truePeakDb(channels),
    rmsDb: rmsDb(channels),
    tempo: estimateTempo(mono, monoRate),
    key: estimateKey(mono, monoRate),
    elapsedMs: Date.now() - t0,
  };
}
