/**
 * Lossless Linear PCM WAV (RIFF) Audio Encoder
 * Encodes multi-channel Float32Array audio samples into standard 16-bit PCM WAV Blobs.
 */

function writeString(view: DataView, offset: number, string: string): void {
  for (let i = 0; i < string.length; i++) {
    view.setUint8(offset + i, string.charCodeAt(i));
  }
}

export function encodeWav(
  channelData: Float32Array[],
  sampleRate: number,
  bitsPerSample: number = 16
): Blob {
  const numChannels = channelData.length;
  if (numChannels === 0 || channelData[0].length === 0) {
    return new Blob([], { type: 'audio/wav' });
  }

  const numSamples = channelData[0].length;
  const bytesPerSample = bitsPerSample / 8;
  const blockAlign = numChannels * bytesPerSample;
  const byteRate = sampleRate * blockAlign;
  const dataSize = numSamples * blockAlign;
  const headerSize = 44;
  const totalSize = headerSize + dataSize;

  const buffer = new ArrayBuffer(totalSize);
  const view = new DataView(buffer);

  // 1. RIFF Chunk Descriptor
  writeString(view, 0, 'RIFF');
  view.setUint32(4, 36 + dataSize, true); // ChunkSize = 36 + SubChunk2Size
  writeString(view, 8, 'WAVE');

  // 2. fmt Sub-chunk
  writeString(view, 12, 'fmt ');
  view.setUint32(16, 16, true); // Subchunk1Size for PCM (16 bytes)
  view.setUint16(20, 1, true); // AudioFormat = 1 (Linear PCM)
  view.setUint16(22, numChannels, true);
  view.setUint32(24, sampleRate, true);
  view.setUint32(28, byteRate, true);
  view.setUint16(32, blockAlign, true);
  view.setUint16(34, bitsPerSample, true);

  // 3. data Sub-chunk
  writeString(view, 36, 'data');
  view.setUint32(40, dataSize, true);

  // Write Interleaved 16-bit PCM samples
  let offset = 44;
  for (let i = 0; i < numSamples; i++) {
    for (let channel = 0; channel < numChannels; channel++) {
      let sample = channelData[channel][i];
      // Hard clamp between -1.0 and +1.0
      sample = Math.max(-1.0, Math.min(1.0, sample));
      // Convert float [-1.0, 1.0] to 16-bit signed integer [-32768, 32767]
      const int16 = sample < 0 ? Math.floor(sample * 32768) : Math.floor(sample * 32767);
      view.setInt16(offset, int16, true);
      offset += 2;
    }
  }

  return new Blob([view], { type: 'audio/wav' });
}

export function audioBufferToWav(buffer: AudioBuffer): Blob {
  const channelData: Float32Array[] = [];
  for (let ch = 0; ch < buffer.numberOfChannels; ch++) {
    channelData.push(buffer.getChannelData(ch));
  }
  return encodeWav(channelData, buffer.sampleRate, 16);
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
