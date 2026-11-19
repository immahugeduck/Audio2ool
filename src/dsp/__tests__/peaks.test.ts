import { test } from 'node:test';
import assert from 'node:assert/strict';
import { findSpectralPeaks, computeBinauralReadout, channelCorrelation, parabolicInterpolate, analyzeStereoTones } from '../peaks';
import { magnitudeSpectrumDb } from '../fft';
import { sine, dbfsToAmplitude } from '../testSignals';

const SR = 48000;

test('parabolic interpolation recovers the vertex of a parabola', () => {
  // y = -(x - 0.3)^2 sampled at -1, 0, 1
  const f = (x: number) => -((x - 0.3) ** 2);
  const { offset, value } = parabolicInterpolate(f(-1), f(0), f(1));
  assert.ok(Math.abs(offset - 0.3) < 1e-9);
  assert.ok(Math.abs(value - 0) < 1e-9);
});

test('reference tones: both 440 Hz and 1000 Hz are listed (live-size FFT, within 0.5 Hz)', () => {
  const n = 32768;
  const a = dbfsToAmplitude(-12);
  const x = sine(440, SR, n, a);
  const y = sine(1000, SR, n, a);
  for (let i = 0; i < n; i++) x[i] += y[i];
  const spec = magnitudeSpectrumDb(x, n, 'blackman');
  const peaks = findSpectralPeaks(spec, SR, n);
  const hz = peaks.map((p) => p.hz).sort((p, q) => p - q);
  assert.equal(hz.length, 2, `expected exactly 2 peaks, got ${hz.join(', ')}`);
  assert.ok(Math.abs(hz[0] - 440) < 0.5, `440 read ${hz[0]}`);
  assert.ok(Math.abs(hz[1] - 1000) < 0.5, `1000 read ${hz[1]}`);
  for (const p of peaks) assert.ok(Math.abs(p.db - -12) < 0.5, `level ${p.db}`);
});

test('peak search honours the frequency span', () => {
  const n = 16384;
  const x = sine(200, SR, n, 0.25);
  const y = sine(700, SR, n, 0.5);
  for (let i = 0; i < n; i++) x[i] += y[i];
  const spec = magnitudeSpectrumDb(x, n, 'blackman');
  const peaks = findSpectralPeaks(spec, SR, n, { minHz: 20, maxHz: 250 });
  assert.equal(peaks.length, 1);
  assert.ok(Math.abs(peaks[0].hz - 200) < 0.5);
});

test('flat noise-free silence yields no peaks', () => {
  const spec = new Float32Array(1024).fill(-240);
  assert.deepEqual(findSpectralPeaks(spec, SR, 2048), []);
});

for (const [name, fl, fr, beat] of [
  ['theta', 200, 206, 6],
  ['alpha', 200, 210, 10],
] as const) {
  test(`${name} clip: per-channel peaks L ${fl} / R ${fr} and ${beat} Hz beat within 0.1 Hz at fftSize 32768`, () => {
    const n = 32768;
    const l = sine(fl, SR, n, 0.5);
    const r = sine(fr, SR, n, 0.5);
    const pl = findSpectralPeaks(magnitudeSpectrumDb(l, n, 'blackman'), SR, n);
    const pr = findSpectralPeaks(magnitudeSpectrumDb(r, n, 'blackman'), SR, n);
    const out = computeBinauralReadout(pl, pr, channelCorrelation(l, r));
    assert.ok(Math.abs(out.leftHz! - fl) < 0.1, `L ${out.leftHz}`);
    assert.ok(Math.abs(out.rightHz! - fr) < 0.1, `R ${out.rightHz}`);
    assert.ok(Math.abs(out.differenceHz! - beat) < 0.1, `beat ${out.differenceHz}`);
    assert.equal(out.isBinaural, true);
    assert.ok(Math.abs(out.correlation!) < 0.1, `correlation ${out.correlation}`);
  });
}

test('identical channels: L = R, beat 0, correlation +1', () => {
  const n = 8192;
  const x = sine(440, SR, n, 0.25);
  const p = findSpectralPeaks(magnitudeSpectrumDb(x, n, 'blackman'), SR, n);
  const out = computeBinauralReadout(p, p, channelCorrelation(x, x));
  assert.equal(out.sameFrequency, true);
  assert.equal(out.differenceHz, 0);
  assert.equal(out.isBinaural, false);
  assert.ok(Math.abs(out.correlation! - 1) < 1e-9);
});

test('channel correlation handles silence and polarity inversion', () => {
  const x = sine(100, SR, 4800, 0.5);
  const inv = x.map((v) => -v);
  assert.equal(channelCorrelation(new Float32Array(10), new Float32Array(10)), null);
  assert.ok(Math.abs(channelCorrelation(x, inv)! + 1) < 1e-9);
});

test('binaural carrier is found under louder shared music content (like the theta/alpha clips)', () => {
  const n = 32768;
  const pad = (len: number) => {
    const a = sine(368.4, SR, len, 0.1);
    const b = sine(556.5, SR, len, 0.2);
    const c = sine(146.6, SR, len, 0.06);
    for (let i = 0; i < len; i++) a[i] += b[i] + c[i];
    return a;
  };
  const l = pad(n), r = pad(n);
  const cl = sine(200, SR, n, 0.075), cr = sine(206, SR, n, 0.075);
  for (let i = 0; i < n; i++) { l[i] += cl[i]; r[i] += cr[i]; }
  const sl = magnitudeSpectrumDb(l, n, 'blackman');
  const sr = magnitudeSpectrumDb(r, n, 'blackman');
  // Dominant-only logic would report 556.5 Hz in both channels.
  assert.ok(Math.abs(findSpectralPeaks(sr, SR, n)[0].hz - 556.5) < 0.5);
  const out = analyzeStereoTones(sl, sr, SR, n, channelCorrelation(l, r));
  assert.equal(out.mode, 'binaural-pair');
  assert.ok(Math.abs(out.leftHz! - 200) < 0.1, `L ${out.leftHz}`);
  assert.ok(Math.abs(out.rightHz! - 206) < 0.1, `R ${out.rightHz}`);
  assert.ok(Math.abs(out.differenceHz! - 6) < 0.1);
  assert.equal(out.isBinaural, true);
});

test('shared two-tone content (reference file) gives no binaural pair and L = R', () => {
  const n = 16384;
  const x = sine(440, SR, n, 0.25);
  const y = sine(1000, SR, n, 0.25);
  for (let i = 0; i < n; i++) x[i] += y[i];
  const s = magnitudeSpectrumDb(x, n, 'blackman');
  const out = analyzeStereoTones(s, s, SR, n, 1);
  assert.equal(out.mode, 'dominant');
  assert.equal(out.differenceHz, 0);
  assert.equal(out.sameFrequency, true);
});

test('offline analysis: reference two tones at 440.000 / 1000.000 Hz within 0.01 Hz, binaural 6.000 Hz within 0.01 Hz', async () => {
  const { analyzeOffline } = await import('../offline');
  const n = SR * 8;
  const a = dbfsToAmplitude(-12);
  const x = sine(440, SR, n, a);
  const y = sine(1000, SR, n, a);
  for (let i = 0; i < n; i++) x[i] += y[i];
  const ref = analyzeOffline({ channels: [x, x], sampleRate: SR });
  const hz = ref.peaksL.map((p) => p.hz).sort((p, q) => p - q);
  assert.equal(hz.length, 2, hz.join(','));
  assert.ok(Math.abs(hz[0] - 440) < 0.01 && Math.abs(hz[1] - 1000) < 0.01, hz.join(','));
  assert.ok(Math.abs(ref.samplePeakDb - -6.02) < 0.1, `peak ${ref.samplePeakDb}`);

  const l = sine(200, SR, n, 0.3);
  const r = sine(206, SR, n, 0.3);
  const th = analyzeOffline({ channels: [l, r], sampleRate: SR });
  assert.equal(th.stereo?.mode, 'binaural-pair');
  assert.ok(Math.abs(th.stereo!.leftHz! - 200) < 0.01);
  assert.ok(Math.abs(th.stereo!.rightHz! - 206) < 0.01);
  assert.ok(Math.abs(th.stereo!.differenceHz! - 6) < 0.01);
});
