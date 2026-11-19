import { test } from 'node:test';
import assert from 'node:assert/strict';
import { analyzeTotalHarmonicDistortion } from '../../utils/frequencyTools';
import { magnitudeSpectrumDb } from '../fft';
import { sine, dbfsToAmplitude } from '../testSignals';

const SR = 48000;
const N = 8192;
const spec = (x: Float32Array) => magnitudeSpectrumDb(x, N, 'blackman');
// Add a -120 dB noise floor like a real analyser (avoid -240 dB numeric floors)
function withFloor(x: Float32Array) {
  let s = 7;
  for (let i = 0; i < x.length; i++) { s = (s * 16807) % 2147483647; x[i] += ((s / 2147483647) - 0.5) * 2e-6; }
  return x;
}

test('reference two tones (440 + 1000 Hz, equal level): multi-tone, no harmonics, THD N/A', () => {
  const a = dbfsToAmplitude(-12);
  const x = sine(440, SR, N, a);
  const y = sine(1000, SR, N, a);
  for (let i = 0; i < N; i++) x[i] += y[i];
  const d = analyzeTotalHarmonicDistortion(spec(withFloor(x)), SR);
  assert.equal(d.status, 'multi-tone');
  assert.equal(d.isToneDetected, false);
  assert.equal(d.harmonics.length, 0);
});

test('pure sine: single tone, no harmonics listed, THD near the floor', () => {
  const d = analyzeTotalHarmonicDistortion(spec(withFloor(sine(1000, SR, N, 0.5))), SR);
  assert.equal(d.status, 'single-tone');
  assert.equal(d.harmonics.length, 0);
  assert.ok(d.thdPercent < 0.05, `THD ${d.thdPercent}%`);
});

test('sine with a -40 dBc 2nd harmonic: harmonic listed, THD about 1 %', () => {
  const x = sine(1000, SR, N, 0.5);
  const h = sine(2000, SR, N, 0.005);
  for (let i = 0; i < N; i++) x[i] += h[i];
  const d = analyzeTotalHarmonicDistortion(spec(withFloor(x)), SR);
  assert.equal(d.status, 'single-tone');
  assert.deepEqual(d.harmonics.map((k) => k.order), [2]);
  assert.ok(Math.abs(d.harmonics[0].relativeDb - -40) < 0.5, `${d.harmonics[0].relativeDb}`);
  assert.ok(Math.abs(d.thdPercent - 1) < 0.1, `THD ${d.thdPercent}%`);
});
