import { test } from 'node:test';
import assert from 'node:assert/strict';
import { measureLoudness, samplePeakDb, truePeakDb, rmsDb } from '../loudness';
import { sine, dbfsToAmplitude } from '../testSignals';

const SR = 48000;

// EBU Tech 3341 test cases 1 & 2: stereo 1 kHz sine at -23 / -33 dBFS reads -23 / -33 LUFS.
for (const level of [-23, -33]) {
  test(`EBU 3341: stereo 1 kHz at ${level} dBFS reads ${level} LUFS (±0.1)`, () => {
    const x = sine(1000, SR, SR * 20, dbfsToAmplitude(level));
    const r = measureLoudness([x, x], SR);
    assert.ok(Math.abs(r.integratedLufs - level) < 0.1, `got ${r.integratedLufs}`);
  });
}

test('44.1 kHz coefficients give the same loudness (sample-rate independent K-weighting)', () => {
  const x = sine(1000, 44100, 44100 * 10, dbfsToAmplitude(-23));
  const r = measureLoudness([x, x], 44100);
  assert.ok(Math.abs(r.integratedLufs - -23) < 0.1, `got ${r.integratedLufs}`);
});

test('relative gate ignores quiet passages (EBU 3341 case 3-like)', () => {
  // 10 s at -36, 60 s at -23, 10 s at -36 dBFS -> about -23 LUFS
  const a = sine(1000, SR, SR * 10, dbfsToAmplitude(-36));
  const b = sine(1000, SR, SR * 60, dbfsToAmplitude(-23));
  const x = new Float32Array(a.length * 2 + b.length);
  x.set(a, 0); x.set(b, a.length); x.set(a, a.length + b.length);
  const r = measureLoudness([x, x], SR);
  assert.ok(Math.abs(r.integratedLufs - -23) < 0.1, `got ${r.integratedLufs}`);
});

test('loudness range: 20 s at -20 then 20 s at -30 LUFS gives about 10 LU (EBU 3342 case 1)', () => {
  const a = sine(1000, SR, SR * 20, dbfsToAmplitude(-20));
  const b = sine(1000, SR, SR * 20, dbfsToAmplitude(-30));
  const x = new Float32Array(a.length + b.length);
  x.set(a, 0); x.set(b, a.length);
  const r = measureLoudness([x, x], SR);
  assert.ok(Math.abs(r.lraLu - 10) < 1, `LRA ${r.lraLu}`);
});

test('reference-like tones: sample peak -6.05 and RMS -12.06 dBFS', () => {
  const a = dbfsToAmplitude(-12);
  const x = sine(440, SR, SR * 2, a);
  const y = sine(1000, SR, SR * 2, a);
  for (let i = 0; i < x.length; i++) x[i] += y[i];
  // RMS of two -12 dBFS (peak) sines = -12 - 3.01 + 3.01 = -12.04 dB; peak of the sum depends on phase alignment.
  assert.ok(Math.abs(rmsDb([x, x]) - -12.04) < 0.1, `rms ${rmsDb([x, x])}`);
  const sp = samplePeakDb([x]);
  assert.ok(sp <= -6.0 && sp > -6.5, `sample peak ${sp}`);
});

test('true peak catches inter-sample overs (fs/4 sine at 45° phase)', () => {
  // Samples land at ±0.7071 of a full-scale sine: sample peak -3.01 dBFS, true peak 0 dBTP.
  const x = sine(SR / 4, SR, 4800, 1, Math.PI / 4);
  const sp = samplePeakDb([x]);
  const tp = truePeakDb([x]);
  assert.ok(Math.abs(sp - -3.01) < 0.05, `sp ${sp}`);
  assert.ok(Math.abs(tp - 0) < 0.3, `tp ${tp}`);
  assert.ok(tp >= sp);
});
