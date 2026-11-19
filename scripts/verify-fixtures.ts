/**
 * Runs the offline analyzer against known-value audio files (decoded with ffmpeg) and prints
 * measured vs expected values. Usage: npx tsx scripts/verify-fixtures.ts [dir]
 * Files are not committed; the script skips any that are missing.
 */
import { execFileSync } from 'node:child_process';
import { existsSync } from 'node:fs';
import { analyzeOffline } from '../src/dsp/offline';

const DIR = process.argv[2] || '/workspace/firstcall/meditation/analyzer-test';
const SONG = process.argv[3] || '/workspace/firstcall/daily/palm-shadow-drift.mp3';

function decode(file: string): { channels: Float32Array[]; sampleRate: number } {
  const probe = execFileSync('ffprobe', ['-v', 'error', '-select_streams', 'a:0', '-show_entries', 'stream=sample_rate', '-of', 'csv=p=0', file]).toString().trim();
  const sampleRate = parseInt(probe, 10);
  const raw = execFileSync('ffmpeg', ['-v', 'error', '-i', file, '-f', 'f32le', '-ac', '2', '-ar', String(sampleRate), '-'], { maxBuffer: 1 << 30 });
  const all = new Float32Array(raw.buffer, raw.byteOffset, raw.byteLength / 4);
  const n = all.length / 2;
  const L = new Float32Array(n), R = new Float32Array(n);
  for (let i = 0; i < n; i++) { L[i] = all[2 * i]; R[i] = all[2 * i + 1]; }
  return { channels: [L, R], sampleRate };
}

const f = (v: number | null | undefined, d = 3) => (v === null || v === undefined || !isFinite(v) ? 'n/a' : v.toFixed(d));
const cases: [string, string][] = [
  ['reference', `${DIR}/reference_440Hz_1000Hz_tones.wav`],
  ['theta', `${DIR}/theta_6Hz_L200_R206_clip.wav`],
  ['alpha', `${DIR}/alpha_10Hz_L200_R210_clip.wav`],
  ['palm-shadow-drift', SONG],
];
const out: Record<string, unknown> = {};
for (const [name, file] of cases) {
  if (!existsSync(file)) { console.log(`skip ${name}: ${file} not found`); continue; }
  const r = analyzeOffline(decode(file));
  out[name] = r;
  console.log(`\n== ${name} (${f(r.durationSec, 2)} s, ${r.sampleRate} Hz, ${r.elapsedMs} ms)`);
  console.log(`  peaks L: ${r.peaksL.slice(0, 6).map((p) => `${f(p.hz)} Hz @ ${f(p.db, 1)}`).join(', ')}`);
  console.log(`  peaks R: ${r.peaksR.slice(0, 6).map((p) => `${f(p.hz)} Hz @ ${f(p.db, 1)}`).join(', ')}`);
  if (r.stereo) console.log(`  stereo (${r.stereo.mode}): L ${f(r.stereo.leftHz)} R ${f(r.stereo.rightHz)} diff ${f(r.stereo.differenceHz)} corr ${f(r.stereo.correlation, 2)}`);
  console.log(`  integrated ${f(r.loudness.integratedLufs, 2)} LUFS, LRA ${f(r.loudness.lraLu, 1)} LU, sample peak ${f(r.samplePeakDb, 2)} dBFS, true peak ${f(r.truePeakDb, 2)} dBTP, RMS ${f(r.rmsDb, 2)} dBFS`);
  console.log(`  tempo ${f(r.tempo?.bpm, 1)} BPM conf ${f(r.tempo?.confidence, 3)} sal ${f(r.tempo?.salience, 2)} clear ${r.tempo?.hasClearBeat} folded ${f(r.tempo?.foldedFromBpm, 1)} (alts ${r.tempo?.alternatives.map((a) => f(a.bpm, 1)).join(', ')}), key ${r.key?.key} (runner-up ${r.key?.runnerUp}, margin ${f(r.key?.confidence, 3)})`);
}
if (process.env.JSON_OUT) {
  const { writeFileSync } = await import('node:fs');
  writeFileSync(process.env.JSON_OUT, JSON.stringify(out, null, 1));
}
