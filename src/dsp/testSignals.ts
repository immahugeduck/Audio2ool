/** Deterministic test-signal and spectrum helpers shared by unit tests and fixture scripts. */

export function sine(freqHz: number, sampleRate: number, length: number, amplitude = 1, phase = 0): Float32Array {
  const out = new Float32Array(length);
  const w = (2 * Math.PI * freqHz) / sampleRate;
  for (let i = 0; i < length; i++) out[i] = amplitude * Math.sin(w * i + phase);
  return out;
}

export function dbfsToAmplitude(db: number): number {
  return Math.pow(10, db / 20);
}
