import { useState, useRef, useEffect, useCallback } from 'react';
import { AudioMetrics, NoiseBaselineProfile } from '../types';

export function useNoiseBaseline(
  getFrequencyData: () => Uint8Array,
  metrics: AudioMetrics,
  isListening: boolean
) {
  const [profile, setProfile] = useState<NoiseBaselineProfile>({
    isCalibrated: false,
    calibrationProgress: 0,
    noiseFloorDb: -75,
    averageRmsDb: -70,
    snrDb: 0,
    noiseCriteriaRating: 'NC-25 (Quiet Environment)',
    dominantNoiseBand: 'Sub-Bass (Quiet)',
    bandFloors: new Array(32).fill(5),
    transientCount: 0,
    transientsPerMin: 0,
  });

  const [isCalibrating, setIsCalibrating] = useState(false);

  // Buffer references for long-term calculation
  const metricsRef = useRef(metrics);
  metricsRef.current = metrics;

  const bandHistoryRef = useRef<number[][]>([]);
  const transientCounterRef = useRef<number>(0);
  const lastTransientTimeRef = useRef<number>(0);
  const smoothedRmsRef = useRef<number>(-70);
  const listenStartTimeRef = useRef<number>(Date.now());

  // Reset transient counters
  const resetTransients = useCallback(() => {
    transientCounterRef.current = 0;
    listenStartTimeRef.current = Date.now();
    setProfile((prev) => ({
      ...prev,
      transientCount: 0,
      transientsPerMin: 0,
      lastTransientTime: undefined,
    }));
  }, []);

  // Recalibrate / Start Calibration sequence (e.g. 3-second sample of room background noise)
  const startCalibration = useCallback(() => {
    setIsCalibrating(true);
    bandHistoryRef.current = [];
    transientCounterRef.current = 0;
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

  // Continuous background noise profiling & accurate transient onset tracking
  useEffect(() => {
    if (!isListening) return;

    const interval = setInterval(() => {
      const freqData = getFrequencyData();
      if (!freqData || freqData.length === 0) return;

      // Downsample frequency bins into 32 bands
      const numBands = 32;
      const step = Math.floor(freqData.length / numBands) || 1;
      const currentBands: number[] = [];

      for (let i = 0; i < numBands; i++) {
        let sum = 0;
        for (let j = 0; j < step; j++) {
          sum += freqData[i * step + j] || 0;
        }
        // Normalize 0-255 to 0-100
        currentBands.push(Math.round((sum / step / 255) * 100));
      }

      // Add to rolling history (keep last 80 samples ~ 8 seconds)
      bandHistoryRef.current.push(currentBands);
      if (bandHistoryRef.current.length > 80) {
        bandHistoryRef.current.shift();
      }

      // Compute per-band min/baseline noise floor across the rolling window
      const computedFloors: number[] = new Array(numBands).fill(100);
      bandHistoryRef.current.forEach((frame) => {
        frame.forEach((val, bandIdx) => {
          if (val < computedFloors[bandIdx]) {
            computedFloors[bandIdx] = val;
          }
        });
      });

      // Calculate global noise floor in dB
      const avgFloorNormalized = computedFloors.reduce((a, b) => a + b, 0) / numBands;
      // Map 0-100 to -90dB to -10dB
      const estimatedFloorDb = Math.round(-90 + (avgFloorNormalized / 100) * 80);

      // Signal to Noise Ratio (SNR = current RMS dB - Noise Floor dB)
      const currentRms = metricsRef.current.rmsDb || -80;
      const currentPeak = metricsRef.current.peakDb || -80;
      const crestFactor = metricsRef.current.crestFactorDb || 0;
      const calculatedSnr = Math.max(0, Math.round(currentRms - estimatedFloorDb));

      // Accurate Acoustic Transient Detection (Energy Rate of Rise + Crest Factor):
      // A true transient is an impulsive sudden onset (clap, snap, door click, percussion spike)
      // rather than sustained sound level. We measure delta relative to preceding smoothed baseline.
      const now = performance.now();
      const previousSmoothed = smoothedRmsRef.current;
      const deltaRmsRise = currentRms - previousSmoothed;

      // Update smoothed RMS reference with fast attack / slow decay leaky integrator
      if (currentRms > previousSmoothed) {
        smoothedRmsRef.current = previousSmoothed + 0.25 * (currentRms - previousSmoothed);
      } else {
        smoothedRmsRef.current = previousSmoothed + 0.08 * (currentRms - previousSmoothed);
      }

      // Trigger condition:
      // 1. Sudden energy spike (deltaRmsRise >= 12 dB in <100ms) OR extreme crest factor (>= 16 dB with peak >= -36 dBFS)
      // 2. Must be above the estimated ambient floor by at least 10 dB to ignore silence jitter
      // 3. Minimum refractory period of 300ms to avoid multi-counting a single echo/decay tail
      const isTransientOnset =
        (deltaRmsRise >= 12 && currentPeak > -50 && currentRms > estimatedFloorDb + 8) ||
        (crestFactor >= 16 && currentPeak > -36 && currentRms > estimatedFloorDb + 10);

      if (isTransientOnset && now - lastTransientTimeRef.current > 300) {
        transientCounterRef.current += 1;
        lastTransientTimeRef.current = now;
      }

      // Calculate transients per minute rate
      const activeSeconds = Math.max(1, (Date.now() - listenStartTimeRef.current) / 1000);
      const transientsPerMin = Number(((transientCounterRef.current / activeSeconds) * 60).toFixed(1));

      // Determine Noise Criteria (NC) rating and dominant band
      let ncRating = 'NC-20 (Recording Studio)';
      if (estimatedFloorDb > -45) {
        ncRating = 'NC-55+ (Very Noisy / Industrial)';
      } else if (estimatedFloorDb > -55) {
        ncRating = 'NC-45 (Open Office / Fan Noise)';
      } else if (estimatedFloorDb > -65) {
        ncRating = 'NC-35 (Standard Room / Residence)';
      } else if (estimatedFloorDb > -75) {
        ncRating = 'NC-28 (Quiet Home / Library)';
      }

      // Dominant noise band evaluation
      let dominant = 'Sub-Bass Ground Hum';
      const subBassFloor = computedFloors.slice(0, 4).reduce((a, b) => a + b, 0) / 4;
      const midFloor = computedFloors.slice(8, 20).reduce((a, b) => a + b, 0) / 12;
      const highFloor = computedFloors.slice(20, 32).reduce((a, b) => a + b, 0) / 12;

      if (midFloor > subBassFloor && midFloor > highFloor) {
        dominant = 'Midrange Ambient (HVAC / Fan)';
      } else if (highFloor > subBassFloor && highFloor > midFloor) {
        dominant = 'High Frequency (Hiss / Static)';
      } else if (subBassFloor < 10 && midFloor < 10 && highFloor < 10) {
        dominant = 'Ultra Quiet Baseline';
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
  };
}
