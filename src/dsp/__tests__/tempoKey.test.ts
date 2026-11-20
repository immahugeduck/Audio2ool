import { test } from 'node:test';
import assert from 'node:assert/strict';
import { estimateTempo, estimateKey } from '../tempoKey';
import { sine } from '../testSignals';

const SR = 22050;

function clickTrack(bpm: number, seconds: number): Float32Array {
  const x = new Float32Array(SR * seconds);
  const period = (60 / bpm) * SR;
  for (let b = 0; b * period < x.length; b++) {
    const start = Math.round(b * period);
    for (let i = 0; i < 800 && start + i < x.length; i++) {
      x[start + i] += Math.sin((2 * Math.PI * 1500 * i) / SR) * Math.exp(-i / 120) * 0.8;
    }
  }
  return x;
}

for (const bpm of [87.6, 120, 140]) {
  test(`tempo: click track at ${bpm} BPM reads within 1 BPM`, () => {
    const r = estimateTempo(clickTrack(bpm, 30), SR);
    assert.ok(r, 'no tempo');
    assert.ok(Math.abs(r!.bpm - bpm) < 1, `got ${r!.bpm}`);
  });
}

function chordSeq(chords: number[][], seconds: number): Float32Array {
  const x = new Float32Array(SR * seconds);
  const seg = Math.floor(x.length / chords.length);
  chords.forEach((notes, ci) => {
    for (const midi of notes) {
      const hz = 440 * Math.pow(2, (midi - 69) / 12);
      const s = sine(hz, SR, seg, 0.15);
      const h = sine(hz * 2, SR, seg, 0.05);
      for (let i = 0; i < seg; i++) x[ci * seg + i] += s[i] + h[i];
    }
  });
  return x;
}

test('key: i-iv-V-i in D minor reads D minor', () => {
  // Dm (D F A), Gm (G Bb D), A (A C# E), Dm
  const x = chordSeq([[50, 53, 57, 62], [55, 58, 62, 67], [57, 61, 64, 69], [50, 53, 57, 62]], 16);
  const k = estimateKey(x, SR);
  assert.equal(k?.key, 'D minor');
});

test('key: I-IV-V-I in G major reads G major', () => {
  const x = chordSeq([[55, 59, 62, 67], [60, 64, 67, 72], [62, 66, 69, 74], [55, 59, 62, 67]], 16);
  const k = estimateKey(x, SR);
  assert.equal(k?.key, 'G major');
});

test('tempo: double-time hi-hat pattern over an 87.6 BPM kick folds to ~87.6 and is flagged', () => {
  const kick = clickTrack(87.6, 30);
  const hats = clickTrack(175.2, 30);
  for (let i = 0; i < kick.length; i++) kick[i] += 0.9 * hats[i];
  const r = estimateTempo(kick, SR)!;
  assert.ok(Math.abs(r.bpm - 87.6) < 1, `got ${r.bpm}`);
  assert.ok(r.foldedFromBpm === undefined || Math.abs(r.foldedFromBpm - 175.2) < 2);
});

function mulberry32(seed: number) {
  return () => {
    seed |= 0; seed = (seed + 0x6d2b79f5) | 0;
    let t = Math.imul(seed ^ (seed >>> 15), 1 | seed);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

test('tempo: steady (dithered) tones and white noise report no clear beat', () => {
  const rnd = mulberry32(42);
  // Like the reference file: two steady tones plus -90 dBFS dither (real files are never bit-exact sines).
  const tones = sine(440, SR, SR * 20, 0.25);
  const t2 = sine(1000, SR, SR * 20, 0.25);
  for (let i = 0; i < tones.length; i++) tones[i] += t2[i] + (rnd() - 0.5) * 6e-5;
  assert.equal(estimateTempo(tones, SR)?.hasClearBeat ?? false, false);
  const noise = new Float32Array(SR * 20).map(() => rnd() - 0.5);
  assert.equal(estimateTempo(noise, SR)?.hasClearBeat ?? false, false);
});

test('tempo: click tracks report a clear beat', () => {
  assert.equal(estimateTempo(clickTrack(120, 20), SR)?.hasClearBeat, true);
});
