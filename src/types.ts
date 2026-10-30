export type VisualizationMode = 'bars' | 'curve' | 'oscilloscope' | 'waterfall' | 'spectrogram' | 'waveform' | 'hybrid';

export type AudioSourceType = 'sample' | 'file' | 'mic' | 'url';

export interface DashboardModuleConfig {
  id: string;
  title: string;
  enabled: boolean;
}

export interface ColorGradientPreset {
  id: string;
  name: string;
  colors: string[]; // e.g. ['#06b6d4', '#a855f7', '#ec4899']
  peakColor: string;
  glowColor: string;
}

export interface CustomGradient {
  start: string;
  middle: string;
  end: string;
  peak: string;
}

export interface VisualizerSettings {
  mode: VisualizationMode;
  fftSize: number; // 128, 256, 512, 1024, 2048, 4096, 8192
  smoothing: number; // 0.0 - 0.99
  minDecibels: number; // e.g. -90
  maxDecibels: number; // e.g. -10
  showHzScale: boolean;
  showDbGrid: boolean;
  showPeaks: boolean;
  colorPresetId: string;
  customGradient: CustomGradient;
  useCustomGradient: boolean;
  sensitivity: number; // 0.5 - 2.5
  logScale: boolean;
  reactiveColors: boolean;
  beatPulseAnimation: boolean;
  fillOpacity: number; // 0.1 - 1.0
  barSpacing: number; // 1 - 8
  barWidthMultiplier: number; // 0.5 - 2.0
}

export interface AudioInputDevice {
  deviceId: string;
  label: string;
  isBluetooth: boolean;
  isPhoneMic: boolean;
}

export interface AudioEngineState {
  sourceType: AudioSourceType;
  isPlaying: boolean;
  isPaused: boolean;
  duration: number;
  currentTime: number;
  volume: number;
  isMuted: boolean;
  bassGain: number; // dB (-20 to +20)
  midGain: number; // dB (-20 to +20)
  trebleGain: number; // dB (-20 to +20)
  playbackRate: number; // 0.5 to 2.0
  pan: number; // -1 to 1
  fileName: string | null;
  activeSampleId: string;
  micActive: boolean;
  micError: string | null;
  micMonitoring: boolean;
  urlLoading?: boolean;
  urlError?: string | null;
  activeUrl?: string | null;
  audioInputDevices: AudioInputDevice[];
  selectedDeviceId: string | null;
  isBluetoothConnected: boolean;
  bluetoothDeviceName: string | null;
  phoneMicDeviceName: string | null;
}

export interface AudioMetrics {
  peakFrequencyHz: number;
  peakFrequencyFormatted: string;
  peakNoteName: string;
  prominenceDb: number;
  spectralCentroidHz: number;
  rmsDb: number;
  peakDb: number;
  crestFactorDb: number;
  subBass: number; // 0 - 100
  bass: number; // 0 - 100
  mid: number; // 0 - 100
  treble: number; // 0 - 100
  fps: number;
}

export interface SampleTrack {
  id: string;
  title: string;
  artist: string;
  genre: string;
  bpm: number;
  generatorType: 'synthwave' | 'ambient' | 'techno' | 'lofi' | 'chords';
}

export interface NoiseBaselineProfile {
  isCalibrated: boolean;
  calibrationProgress: number; // 0 - 100%
  noiseFloorDb: number; // e.g. -65 dB
  averageRmsDb: number; // e.g. -58 dB
  snrDb: number; // Signal-to-Noise Ratio in dB
  noiseCriteriaRating: string; // e.g. 'NC-25 (Quiet Studio)', 'NC-35 (Residential/Office)', 'NC-50+ (Noisy Industrial)'
  dominantNoiseBand: string; // e.g. 'Sub-Bass (Hum)', 'Midrange (HVAC/Fan)', 'Highs (Hiss)'
  bandFloors: number[]; // Array of noise floor values across spectral bins (0 - 100)
  transientCount: number; // Count of true impulsive transient spikes detected
  transientsPerMin?: number; // Rate of transient impulses per minute
  lastTransientTime?: string;
  lastTransientDeltaDb?: number;
  transientSensitivity?: 'strict' | 'balanced' | 'sensitive';
  lastCalibratedTime?: string;
}

export interface AiNoiseDetectionResult {
  primarySound: string;
  confidence: number;
  category: string;
  description: string;
  top2OtherNoises?: string[];
  acousticCharacteristics?: string;
  timestamp?: string;
  // Psychoacoustic & Sound Quality Metrics
  psychoacoustics?: {
    sharpnessScore: number; // 0 - 100
    brightnessScore: number; // 0 - 100
    warmthScore: number; // 0 - 100
    harshnessScore: number; // 0 - 100
    perceivedLoudnessLufs: number; // e.g. -24 LUFS
    soundPurity: 'Pure Tone' | 'Harmonic' | 'Noise / Broadband' | 'Impulsive / Transient';
  };
  // Recommended Audio Fixes / Room Mitigation
  recommendedFixes?: {
    eqAction: string; // e.g., 'Apply High-Pass filter at 80 Hz to cut ground hum'
    roomTreatment: string; // e.g., 'Place absorber panel at primary reflection points'
    hardwareFix: string; // e.g., 'Use a noise gate or ground loop isolator'
  };
}

// Frequency Tools Types
export type SignalGeneratorWaveform = 'sine' | 'triangle' | 'square' | 'sawtooth' | 'pink' | 'white' | 'sweep';

export interface SignalGeneratorState {
  isActive: boolean;
  waveform: SignalGeneratorWaveform;
  frequency: number; // 20 - 20000 Hz
  volume: number; // 0.0 - 1.0
  isMuted: boolean;
  // Sweep mode parameters
  isSweeping: boolean;
  sweepStartHz: number;
  sweepEndHz: number;
  sweepDurationSec: number;
  sweepProgress: number; // 0 - 1.0
  sweepLoop: boolean;
}

export type FrequencyIsolatorType = 'off' | 'bandpass' | 'notch' | 'highpass' | 'lowpass';

export interface FrequencyIsolatorState {
  enabled: boolean;
  type: FrequencyIsolatorType;
  frequency: number; // 20 - 20000 Hz
  q: number; // 0.5 - 20.0
}

export interface OctaveBandData {
  centerHz: number;
  label: string;
  rmsDb: number; // e.g. -45 dBFS
  peakDb: number; // e.g. -38 dBFS
  energyPercent: number; // 0 - 100%
  isDominant: boolean;
}

// Premium Audio Recording Types
export type RecordingSource = 'mic' | 'master';
export type RecordingFormat = 'wav' | 'webm' | 'webm-320' | 'webm-128';
export type RecordingQuality = '128k' | '256k' | '320k' | 'lossless';

export interface AudioRecordingTake {
  id: string;
  title: string;
  timestamp: string | number;
  durationSeconds: number;
  durationSec: number;
  format: string;
  quality?: RecordingQuality;
  source: RecordingSource;
  sampleRate: number;
  channels?: number;
  blob: Blob;
  url: string;
  audioUrl: string;
  file: File;
  sizeBytes: number;
  peakDb: number;
  isClipped?: boolean;
  isNormalized?: boolean;
}

export interface StudioRecorderSettings {
  source: RecordingSource;
  format: RecordingFormat;
  quality: RecordingQuality;
  preAmpGainDb: number; // -12 to +18 dB
  noiseGateEnabled: boolean;
  noiseGateThresholdDb: number; // -60 to -24 dB
  preRollCountdown: boolean; // 3-second countdown
}


