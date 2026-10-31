/**
 * Lossless Linear PCM (16-bit) & IEEE 32-Bit Floating-Point WAV (RIFF) Audio Encoder
 * Supports embedded RIFF 'cue ' and 'LIST' ('adtl' / 'labl') transient & user cue markers
 * compatible with professional DAWs (Audition, Reaper, Logic Pro, Pro Tools, Izotope RX).
 */
import { WavCueMarker } from '../types';

function writeString(view: DataView, offset: number, str: string): void {
  for (let i = 0; i < str.length; i++) {
    view.setUint8(offset + i, str.charCodeAt(i));
  }
}

/**
 * Builds optional RIFF 'cue ' and 'LIST' ('adtl' -> 'labl') chunks for embedded markers.
 */
function buildCueAndListChunks(markers: WavCueMarker[]): ArrayBuffer | null {
  if (!markers || markers.length === 0) return null;

  const numCues = markers.length;
  // 'cue ' chunk: 4 ('cue ') + 4 (chunkSize) + 4 (numCuePoints) + numCues * 24 bytes
  const cueDataSize = 4 + numCues * 24;
  const cueTotalSize = 8 + cueDataSize;

  // 'LIST' chunk with 'adtl' type and 'labl' sub-chunks
  // Each 'labl': 4 ('labl') + 4 (subChunkSize) + 4 (cuePointId) + null-terminated string (padded to even byte count)
  const encodedLabels = markers.map((m, idx) => {
    const cleanText = (m.label || `Cue #${idx + 1}`).replace(/[^\x20-\x7E]/g, '');
    const strWithNullLen = cleanText.length + 1;
    const paddedStrLen = strWithNullLen % 2 === 1 ? strWithNullLen + 1 : strWithNullLen;
    return {
      id: m.id || idx + 1,
      sampleOffset: Math.max(0, Math.floor(m.sampleOffset)),
      text: cleanText,
      subChunkDataSize: 4 + strWithNullLen, // cueId (4) + string + null
      paddedTotalBytes: 8 + 4 + paddedStrLen, // 'labl'(4) + size(4) + cueId(4) + paddedString
    };
  });

  const listContentSize = 4 + encodedLabels.reduce((acc, l) => acc + l.paddedTotalBytes, 0); // 'adtl' (4) + all labl subchunks
  const listTotalSize = 8 + listContentSize;

  const totalExtraBytes = cueTotalSize + listTotalSize;
  const buf = new ArrayBuffer(totalExtraBytes);
  const view = new DataView(buf);

  let pos = 0;

  // 1. Write 'cue ' chunk
  writeString(view, pos, 'cue ');
  view.setUint32(pos + 4, cueDataSize, true);
  view.setUint32(pos + 8, numCues, true);
  pos += 12;

  for (const item of encodedLabels) {
    view.setUint32(pos, item.id, true); // dwName (unique cue ID)
    view.setUint32(pos + 4, item.sampleOffset, true); // dwPosition
    writeString(view, pos + 8, 'data'); // fccChunk
    view.setUint32(pos + 12, 0, true); // dwChunkStart
    view.setUint32(pos + 16, 0, true); // dwBlockStart
    view.setUint32(pos + 20, item.sampleOffset, true); // dwSampleOffset
    pos += 24;
  }

  // 2. Write 'LIST' ('adtl') chunk
  writeString(view, pos, 'LIST');
  view.setUint32(pos + 4, listContentSize, true);
  writeString(view, pos + 8, 'adtl');
  pos += 12;

  for (const item of encodedLabels) {
    writeString(view, pos, 'labl');
    view.setUint32(pos + 4, item.subChunkDataSize, true);
    view.setUint32(pos + 8, item.id, true);
    writeString(view, pos + 12, item.text);
    // Remaining null byte(s) are already 0 in ArrayBuffer
    pos += item.paddedTotalBytes;
  }

  return buf;
}

export function encodeWav(
  channelData: Float32Array[],
  sampleRate: number,
  bitsPerSample: 16 | 32 = 32,
  cueMarkers?: WavCueMarker[]
): Blob {
  const numChannels = channelData.length;
  if (numChannels === 0 || channelData[0].length === 0) {
    return new Blob([], { type: 'audio/wav' });
  }

  const isFloat32 = bitsPerSample === 32;
  const audioFormat = isFloat32 ? 3 : 1; // 3 = IEEE 754 Float, 1 = Linear PCM
  const numSamples = channelData[0].length;
  const bytesPerSample = bitsPerSample / 8;
  const blockAlign = numChannels * bytesPerSample;
  const byteRate = sampleRate * blockAlign;
  const dataSize = numSamples * blockAlign;

  const extraChunksBuf = cueMarkers && cueMarkers.length > 0 ? buildCueAndListChunks(cueMarkers) : null;
  const extraBytes = extraChunksBuf ? extraChunksBuf.byteLength : 0;

  const headerSize = 44;
  const totalSize = headerSize + dataSize + extraBytes;

  const buffer = new ArrayBuffer(totalSize);
  const view = new DataView(buffer);

  // 1. RIFF Chunk Descriptor
  writeString(view, 0, 'RIFF');
  view.setUint32(4, 36 + dataSize + extraBytes, true);
  writeString(view, 8, 'WAVE');

  // 2. fmt Sub-chunk
  writeString(view, 12, 'fmt ');
  view.setUint32(16, 16, true); // Subchunk1Size (16 bytes)
  view.setUint16(20, audioFormat, true); // 1 = PCM, 3 = IEEE Float
  view.setUint16(22, numChannels, true);
  view.setUint32(24, sampleRate, true);
  view.setUint32(28, byteRate, true);
  view.setUint16(32, blockAlign, true);
  view.setUint16(34, bitsPerSample, true);

  // 3. data Sub-chunk
  writeString(view, 36, 'data');
  view.setUint32(40, dataSize, true);

  // Write Interleaved Samples
  let offset = 44;
  if (isFloat32) {
    // 32-bit IEEE Floating-Point (preserves full unclipped headroom & sub-noise-floor precision)
    for (let i = 0; i < numSamples; i++) {
      for (let channel = 0; channel < numChannels; channel++) {
        const sample = channelData[channel][i] || 0;
        view.setFloat32(offset, sample, true);
        offset += 4;
      }
    }
  } else {
    // 16-bit Linear PCM (hard-clamped to [-1.0, +1.0])
    for (let i = 0; i < numSamples; i++) {
      for (let channel = 0; channel < numChannels; channel++) {
        let sample = channelData[channel][i] || 0;
        sample = Math.max(-1.0, Math.min(1.0, sample));
        const int16 = sample < 0 ? Math.floor(sample * 32768) : Math.floor(sample * 32767);
        view.setInt16(offset, int16, true);
        offset += 2;
      }
    }
  }

  // 4. Append embedded 'cue ' and 'LIST' chunks if present
  if (extraChunksBuf) {
    const destBytes = new Uint8Array(buffer, offset, extraBytes);
    destBytes.set(new Uint8Array(extraChunksBuf));
  }

  return new Blob([buffer], { type: 'audio/wav' });
}

export function audioBufferToWav(
  buffer: AudioBuffer,
  bitsPerSample: 16 | 32 = 32,
  cueMarkers?: WavCueMarker[]
): Blob {
  const channelData: Float32Array[] = [];
  for (let ch = 0; ch < buffer.numberOfChannels; ch++) {
    channelData.push(buffer.getChannelData(ch));
  }
  return encodeWav(channelData, buffer.sampleRate, bitsPerSample, cueMarkers);
}

/**
 * Normalizes PCM channel samples to target peak dBFS (default -0.1 dBFS).
 * Returns new normalized Float32 arrays and the gain applied in dB.
 */
export function normalizePcmSamples(
  channelData: Float32Array[],
  targetPeakDb: number = -0.1
): { normalizedData: Float32Array[]; gainAppliedDb: number } {
  let maxAbs = 0;
  for (let ch = 0; ch < channelData.length; ch++) {
    const data = channelData[ch];
    for (let i = 0; i < data.length; i++) {
      const abs = Math.abs(data[i]);
      if (abs > maxAbs) maxAbs = abs;
    }
  }

  if (maxAbs <= 0.00001) {
    return { normalizedData: channelData, gainAppliedDb: 0 };
  }

  const targetLinear = Math.pow(10, targetPeakDb / 20);
  const gainFactor = targetLinear / maxAbs;
  const gainAppliedDb = 20 * Math.log10(gainFactor);

  const normalizedData: Float32Array[] = channelData.map((channel) => {
    const output = new Float32Array(channel.length);
    for (let i = 0; i < channel.length; i++) {
      output[i] = Math.max(-1.0, Math.min(1.0, channel[i] * gainFactor));
    }
    return output;
  });

  return { normalizedData, gainAppliedDb };
}
