import { useState, useRef, useEffect, useCallback } from 'react';
import { AudioMetrics, NoiseBaselineProfile } from '../types';
import { getMagnitudeForRatio } from '../utils/frequencyTools';

const SENSITIVITY_CONFIG = {
  strict: {
    rmsRiseMin: 12,
    peakRiseMin: 14,
    minCrest: 13,
    minPeakDb: -24,
    snrMargin: 20,
    cooldownMs: 750,
  },
  balanced: {
    rmsRiseMin: 9,
    peakRiseMin: 11,
    minCrest: 11,
    minPeakDb: -32,
    snrMargin: 16,
    cooldownMs: 550,
  },
  sensitive: {
    rmsRiseMin: 6,
    peakRiseMin: 8,
    minCrest: 9,
    minPeakDb: -40,
    snrMargin: 12,
    cooldownMs: 400,
  },
} as const;

export function useNoiseBaseline(
  getFrequencyData: () => Uint8Array,
  metrics: AudioMetrics,
  isListening: boolean
) {
  const [profile, setProfile] = useState<NoiseBaselineProfile>({
    isCalibrated: false,
    calibrationProgress: 0,
    noiseFloorDb: -72,
    averageRmsDb: -70,
    snrDb: 0,
    noiseCriteriaRating: 'NC-25 (Quiet Environment)',
    dominantNoiseBand: 'Ultra Quiet Baseline',
    bandFloors: new Array(32).fill(5),
    transientCount: 0,
    transientsPerMin: 0,
    transientSensitivity: 'balanced',
  });

  const [isCalibrating, setIsCalibrating] = useState(false);

  // Buffer references for long-term calculation
  const metricsRef = useRef(metrics);
  metricsRef.current = metrics;

  const sensitivityRef = useRef<'strict' | 'balanced' | 'sensitive'>('balanced');
  const bandHistoryRef = useRef<number[][]>([]);
  const rmsHistoryRef = useRef<number[]>([]);
  const transientCounterRef = useRef<number>(0);
  const lastTransientTimeRef = useRef<number>(0);
  const lastTransientTimeStrRef = useRef<string | undefined>(undefined);
  const lastTransientDeltaRef = useRef<number | undefined>(undefined);
  const smoothedRmsRef = useRef<number>(-70);
  const smoothedPeakRef = useRef<number>(-65);
  const isArmedRef = useRef<boolean>(true);
  const warmupUntilRef = useRef<number>(performance.now() + 1200);
  const listenStartTimeRef = useRef<number>(Date.now());

  const setTransientSensitivity = useCallback((mode: 'strict' | 'balanced' | 'sensitive') => {
    sensitivityRef.current = mode;
    setProfile((prev) => ({
      ...prev,
      transientSensitivity: mode,
    }));
  }, []);

  // Reset transient counters
  const resetTransients = useCallback(() => {
    transientCounterRef.current = 0;
    lastTransientTimeStrRef.current = undefined;
    lastTransientDeltaRef.current = undefined;
    isArmedRef.current = true;
    listenStartTimeRef.current = Date.now();
    setProfile((prev) => ({
      ...prev,
      transientCount: 0,
      transientsPerMin: 0,
      lastTransientTime: undefined,
      lastTransientDeltaDb: undefined,
    }));
  }, []);

  // Recalibrate / Start Calibration sequence (e.g. 3-second sample of room background noise)
  const startCalibration = useCallback(() => {
    setIsCalibrating(true);
    bandHistoryRef.current = [];
    rmsHistoryRef.current = [];
    transientCounterRef.current = 0;
    lastTransientTimeStrRef.current = undefined;
    lastTransientDeltaRef.current = undefined;
    isArmedRef.current = true;
    warmupUntilRef.current = performance.now() + 1500;
    listenStartTimeRef.current = Date.now();

    let progress = 0;
    const interval = setInterval(() => {
      progress += 5;
      setProfile((prev) => ({
        ...prev,
        calibrationProgress: Math.min(100, progress),
      }));

      if (progress >= 100) {
        clearInterval(interval);
        setIsCalibrating(false);
        setProfile((prev) => ({
          ...prev,
          isCalibrated: true,
          lastCalibratedTime: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit', second: '2-digit' }),
        }));
      }
    }, 150);
  }, []);

  // Continuous background noise profiling & Schmitt-trigger transient onset tracking
  useEffect(() => {
    if (!isListening) return;

    // Give 1.2s warmup when listening starts so initial mic stream click doesn't count as a transient
    warmupUntilRef.current = performance.now() + 1200;
    isArmedRef.current = true;

    const interval = setInterval(() => {
      const freqData = getFrequencyData();
      if (!freqData || freqData.length === 0) return;

      const binCount = freqData.length;
      const numBands = 32;
      const currentBands: number[] = [];

      // Map 32 bands logarithmically across 20 Hz - 20 kHz to match the UI scale
      for (let i = 0; i < numBands; i++) {
        const ratioStart = i / numBands;
        const ratioEnd = (i + 1) / numBands;
        const mag = getMagnitudeForRatio(freqData, ratioStart, ratioEnd, true, 44100, binCount);
        currentBands.push(Math.round((mag / 255) * 100));
      }

      // Add to rolling history (keep last 80 samples ~ 8 seconds)
      bandHistoryRef.current.push(currentBands);
      if (bandHistoryRef.current.length > 80) {
        bandHistoryRef.current.shift();
      }

      // Compute per-band baseline noise floor across the rolling window
      const computedFloors: number[] = new Array(numBands).fill(100);
      bandHistoryRef.current.forEach((frame) => {
        frame.forEach((val, bandIdx) => {
          if (val < computedFloors[bandIdx]) {
            computedFloors[bandIdx] = val;
          }
        });
      });

      const currentRms = metricsRef.current.rmsDb > -99 ? metricsRef.current.rmsDb : -80;
      const currentPeak = metricsRef.current.peakDb > -99 ? metricsRef.current.peakDb : -80;
      const crestFactor = metricsRef.current.crestFactorDb || 0;

      // Track rolling RMS history to derive the true 20th-percentile ambient room noise floor in dBFS
      rmsHistoryRef.current.push(currentRms);
      if (rmsHistoryRef.current.length > 80) {
        rmsHistoryRef.current.shift();
      }

      const sortedRms = [...rmsHistoryRef.current].sort((a, b) => a - b);
      const p20Idx = Math.min(sortedRms.length - 1, Math.floor(sortedRms.length * 0.2));
      const estimatedFloorDb = Math.max(-88, Math.min(-15, Math.round(sortedRms[p20Idx] ?? -72)));

      // Signal to Noise Ratio (SNR = current RMS dB - Noise Floor dB)
      const calculatedSnr = Math.max(0, Math.round(currentRms - estimatedFloorDb));

      // Accurate Acoustic Transient Detection (Schmitt-Trigger Onset + Crest Factor + SNR Gate):
      // A true transient is a sharp, sudden impulsive onset (handclap, finger snap, desk knock)
      // that jumps rapidly above the preceding smoothed envelope and then decays.
      const now = performance.now();
      const previousSmoothedRms = smoothedRmsRef.current;
      const previousSmoothedPeak = smoothedPeakRef.current;
      const deltaRmsRise = currentRms - previousSmoothedRms;
      const deltaPeakRise = currentPeak - previousSmoothedPeak;

      const thresh = SENSITIVITY_CONFIG[sensitivityRef.current];

      // Re-arm Schmitt trigger once signal drops back within 4 dB of baseline
      if (!isArmedRef.current && currentRms <= previousSmoothedRms + 4) {
        isArmedRef.current = true;
      }

      const isTransientOnset =
        now > warmupUntilRef.current &&
        isArmedRef.current &&
        now - lastTransientTimeRef.current >= thresh.cooldownMs &&
        deltaRmsRise >= thresh.rmsRiseMin &&
        deltaPeakRise >= thresh.peakRiseMin &&
        crestFactor >= thresh.minCrest &&
        currentPeak >= Math.max(thresh.minPeakDb, estimatedFloorDb + thresh.snrMargin);

      if (isTransientOnset) {
        transientCounterRef.current += 1;
        lastTransientTimeRef.current = now;
        isArmedRef.current = false; // Disarm until impulse decays so echoes aren't double-counted
        lastTransientDeltaRef.current = Math.round(deltaPeakRise);
        lastTransientTimeStrRef.current = new Date().toLocaleTimeString([], {
          hour: '2-digit',
          minute: '2-digit',
          second: '2-digit',
        });
      } else {
        // Update smoothed envelope only on non-transient frames so spikes don't corrupt the baseline reference
        const alphaRms = currentRms > previousSmoothedRms ? 0.15 : 0.25;
        smoothedRmsRef.current = previousSmoothedRms + alphaRms * (currentRms - previousSmoothedRms);

        const alphaPeak = currentPeak > previousSmoothedPeak ? 0.15 : 0.25;
        smoothedPeakRef.current = previousSmoothedPeak + alphaPeak * (currentPeak - previousSmoothedPeak);
      }

      // Calculate transients per minute rate
      const activeSeconds = Math.max(5, (Date.now() - listenStartTimeRef.current) / 1000);
      const transientsPerMin =
        transientCounterRef.current > 0
          ? Number(((transientCounterRef.current / activeSeconds) * 60).toFixed(1))
          : 0;

      // Determine Noise Criteria (NC) rating and dominant band
      let ncRating = 'NC-20 (Recording Studio)';
      if (estimatedFloorDb > -40) {
        ncRating = 'NC-55+ (Very Noisy / Industrial)';
      } else if (estimatedFloorDb > -50) {
        ncRating = 'NC-45 (Open Office / Fan Noise)';
      } else if (estimatedFloorDb > -60) {
        ncRating = 'NC-35 (Standard Room / Residence)';
      } else if (estimatedFloorDb > -70) {
        ncRating = 'NC-28 (Quiet Home / Library)';
      }

      // Dominant noise band evaluation across log-spaced bands
      let dominant = 'Sub-Bass Ground Hum';
      const subBassFloor = computedFloors.slice(0, 8).reduce((a, b) => a + b, 0) / 8;
      const midFloor = computedFloors.slice(8, 22).reduce((a, b) => a + b, 0) / 14;
      const highFloor = computedFloors.slice(22, 32).reduce((a, b) => a + b, 0) / 10;

      if (subBassFloor < 8 && midFloor < 8 && highFloor < 8) {
        dominant = 'Ultra Quiet Baseline';
      } else if (midFloor >= subBassFloor && midFloor >= highFloor) {
        dominant = 'Midrange Ambient (HVAC / Room Tone)';
      } else if (highFloor > subBassFloor && highFloor > midFloor) {
        dominant = 'High Frequency (Air / Static Hiss)';
      }

      setTimeout(() => {
        setProfile((prev) => ({
          ...prev,
          noiseFloorDb: estimatedFloorDb,
          averageRmsDb: Math.round(currentRms),
          snrDb: calculatedSnr,
          noiseCriteriaRating: ncRating,
          dominantNoiseBand: dominant,
          bandFloors: computedFloors,
          transientCount: transientCounterRef.current,
          transientsPerMin,
          lastTransientTime: lastTransientTimeStrRef.current,
          lastTransientDeltaDb: lastTransientDeltaRef.current,
          transientSensitivity: sensitivityRef.current,
        }));
      }, 0);
    }, 100);

    return () => clearInterval(interval);
  }, [getFrequencyData, isListening]);

  return {
    profile,
    isCalibrating,
    startCalibration,
    resetTransients,
    setTransientSensitivity,
  };
}
