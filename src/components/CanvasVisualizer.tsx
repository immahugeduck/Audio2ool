import React, { useRef, useEffect, useState, useCallback } from 'react';
import { VisualizerSettings, AudioMetrics } from '../types';
import { COLOR_PRESETS, getPresetById, createCanvasGradient, getPeakColor } from '../utils/colorGradients';
import { 
  Maximize2, 
  Minimize2, 
  Camera, 
  Sparkles, 
  Pin, 
  RefreshCw, 
  Layers, 
  Plus, 
  Trash2, 
  Eye, 
  EyeOff, 
  X,
  Activity,
  Zap
} from 'lucide-react';

interface SpectrumLayer {
  id: string;
  name: string;
  data: Uint8Array;
  color: string;
  timestamp: string;
  visible: boolean;
}

const blendHexColors = (color1: string, color2: string, ratio: number): string => {
  ratio = Math.max(0, Math.min(1, ratio));
  const c1 = color1.startsWith('#') ? color1.slice(1) : color1;
  const c2 = color2.startsWith('#') ? color2.slice(1) : color2;
  
  const r1 = parseInt(c1.substring(0, 2), 16) || 0;
  const g1 = parseInt(c1.substring(2, 4), 16) || 0;
  const b1 = parseInt(c1.substring(4, 6), 16) || 0;
  
  const r2 = parseInt(c2.substring(0, 2), 16) || 0;
  const g2 = parseInt(c2.substring(2, 4), 16) || 0;
  const b2 = parseInt(c2.substring(4, 6), 16) || 0;
  
  const r = Math.round(r1 + (r2 - r1) * ratio);
  const g = Math.round(g1 + (g2 - g1) * ratio);
  const b = Math.round(b1 + (b2 - b1) * ratio);
  
  return `#${r.toString(16).padStart(2, '0')}${g.toString(16).padStart(2, '0')}${b.toString(16).padStart(2, '0')}`;
};

const LAYER_COLORS = [
  '#06b6d4', // Cyan
  '#10b981', // Emerald
  '#f59e0b', // Amber
  '#ec4899', // Pink
  '#8b5cf6', // Purple
  '#f97316', // Orange
];

interface CanvasVisualizerProps {
  settings: VisualizerSettings;
  getFrequencyData: () => Uint8Array;
  getTimeDomainData: () => Uint8Array;
  metrics: AudioMetrics;
  isPlaying: boolean;
}

export const CanvasVisualizer: React.FC<CanvasVisualizerProps> = ({
  settings,
  getFrequencyData,
  getTimeDomainData,
  metrics,
  isPlaying,
}) => {
  const containerRef = useRef<HTMLDivElement>(null);
  const canvasRef = useRef<HTMLCanvasElement>(null);

  // Offscreen canvas for Spectrogram Waterfall scrolling
  const spectrogramCanvasRef = useRef<HTMLCanvasElement | null>(null);

  // History buffer for 3D Waterfall & Spectrogram Rainfall depth
  const waterfallHistoryRef = useRef<Uint8Array[]>([]);

  // Peak hold array for frequency bars
  const peakValuesRef = useRef<number[]>([]);
  const peakHoldTimeRef = useRef<number[]>([]);

  // Peak hold array for smooth curve modes
  const curvePeakValuesRef = useRef<number[]>([]);
  const curvePeakHoldTimeRef = useRef<number[]>([]);

  // Particles for curve / radial mode
  const particlesRef = useRef<{ x: number; y: number; vx: number; vy: number; size: number; alpha: number; color: string }[]>([]);

  // Beat Detection Algorithm Refs
  const bassHistoryRef = useRef<number[]>([]);
  const lastBeatTimeRef = useRef<number>(0);
  const beatScaleRef = useRef<number>(1.0);

  const [isFullscreen, setIsFullscreen] = useState(false);
  const [toastMessage, setToastMessage] = useState<string | null>(null);
  
  // Custom interactive features
  const [infinitePeakHold, setInfinitePeakHold] = useState(false);
  const [savedLayers, setSavedLayers] = useState<SpectrumLayer[]>([]);
  const [showLayersManager, setShowLayersManager] = useState(false);

  const showToast = (msg: string) => {
    setToastMessage(msg);
    setTimeout(() => {
      setToastMessage((current) => current === msg ? null : current);
    }, 2000);
  };

  // Capture current frequency spectrum as reference overlay layer
  const captureCurrentLayer = () => {
    const freqData = getFrequencyData();
    if (!freqData || freqData.length === 0) {
      showToast('No frequency data to capture');
      return;
    }

    // Capture clone of current data
    const dataClone = new Uint8Array(freqData);

    const newLayer: SpectrumLayer = {
      id: `layer-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`,
      name: `Ref Spectrum ${savedLayers.length + 1}`,
      data: dataClone,
      color: LAYER_COLORS[savedLayers.length % LAYER_COLORS.length],
      timestamp: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit', second: '2-digit' }),
      visible: true,
    };

    setSavedLayers((prev) => [...prev, newLayer]);
    setShowLayersManager(true);
    showToast('Reference layer captured!');
  };

  // Reset absolute peak holds to zero
  const resetPeaks = () => {
    peakValuesRef.current = peakValuesRef.current.map(() => 0);
    curvePeakValuesRef.current = curvePeakValuesRef.current.map(() => 0);
    showToast('Peak values cleared');
  };

  // Layer manipulation utilities
  const renameLayer = (id: string, newName: string) => {
    setSavedLayers((prev) =>
      prev.map((layer) => (layer.id === id ? { ...layer, name: newName } : layer))
    );
  };

  const changeLayerColor = (id: string, color: string) => {
    setSavedLayers((prev) =>
      prev.map((layer) => (layer.id === id ? { ...layer, color } : layer))
    );
  };

  const toggleLayerVisibility = (id: string) => {
    setSavedLayers((prev) =>
      prev.map((layer) => (layer.id === id ? { ...layer, visible: !layer.visible } : layer))
    );
  };

  const deleteLayer = (id: string) => {
    setSavedLayers((prev) => prev.filter((layer) => layer.id !== id));
  };

  // Initialize spectrogram offscreen canvas
  useEffect(() => {
    if (!spectrogramCanvasRef.current) {
      spectrogramCanvasRef.current = document.createElement('canvas');
      spectrogramCanvasRef.current.width = 1000;
      spectrogramCanvasRef.current.height = 500;
    }
  }, []);

  // Fullscreen Handler
  const toggleFullscreen = () => {
    if (!containerRef.current) return;
    if (!document.fullscreenElement) {
      containerRef.current.requestFullscreen().then(() => setIsFullscreen(true)).catch(() => {});
    } else {
      document.exitFullscreen().then(() => setIsFullscreen(false)).catch(() => {});
    }
  };

  // Screenshot capture function
  const exportSnapshot = () => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const dataUrl = canvas.toDataURL('image/png');
    const link = document.createElement('a');
    link.download = `spectrum-analyzer-${new Date().toISOString().slice(0, 19).replace(/:/g, '-')}.png`;
    link.href = dataUrl;
    link.click();

    showToast('High-res PNG frame exported!');
  };

  // Main Render Loop
  useEffect(() => {
    let animationFrameId: number;
    const canvas = canvasRef.current;
    const container = containerRef.current;
    if (!canvas || !container) return;

    const ctx = canvas.getContext('2d', { alpha: false });
    if (!ctx) return;

    // Handle high DPI display sizing
    const handleResize = () => {
      const rect = container.getBoundingClientRect();
      const dpr = Math.min(window.devicePixelRatio || 1, 2);
      
      const width = Math.floor(rect.width);
      const height = Math.floor(rect.height);

      if (canvas.width !== width * dpr || canvas.height !== height * dpr) {
        canvas.width = width * dpr;
        canvas.height = height * dpr;
      }
    };

    const resizeObserver = new ResizeObserver(handleResize);
    resizeObserver.observe(container);
    handleResize();

    const render = () => {
      const dpr = Math.min(window.devicePixelRatio || 1, 2);
      const width = canvas.width / dpr;
      const height = canvas.height / dpr;

      ctx.save();
      ctx.scale(dpr, dpr);

      // Deep studio dark background
      ctx.fillStyle = '#090d16';
      ctx.fillRect(0, 0, width, height);

      // Fetch raw data
      const freqData = getFrequencyData();
      const timeData = getTimeDomainData();
      const binCount = freqData.length;

      // Beat Detection Algorithm (Internal State Tracking)
      const instantBass = metrics.subBass * 0.65 + metrics.bass * 0.35;
      const history = bassHistoryRef.current;
      history.push(instantBass);
      if (history.length > 35) history.shift();

      const avgBass = history.reduce((a, b) => a + b, 0) / (history.length || 1);
      const now = performance.now();

      if (
        instantBass > 30 &&
        instantBass > avgBass * 1.35 &&
        now - lastBeatTimeRef.current > 220
      ) {
        lastBeatTimeRef.current = now;
        beatScaleRef.current = 1.0;
      }

      // Ensure container transform/shadow remains completely stable without shaking
      if (containerRef.current && containerRef.current.style.transform) {
        containerRef.current.style.transform = '';
        containerRef.current.style.borderColor = '';
        containerRef.current.style.boxShadow = '';
      }

      const preset = getPresetById(settings.colorPresetId);
      const peakColor = getPeakColor(preset, settings.customGradient, settings.useCustomGradient);

      // Smooth & subtle background reactive ambient glow (toned down)
      if (settings.reactiveColors && metrics.bass > 40) {
        const glowRadius = Math.min(width, height) * 0.5;
        const radialGlow = ctx.createRadialGradient(
          width / 2,
          height / 2,
          10,
          width / 2,
          height / 2,
          glowRadius
        );
        const glowOpacity = Math.min(0.12, (metrics.bass / 1000)).toFixed(2);
        radialGlow.addColorStop(0, `rgba(6, 182, 212, ${glowOpacity})`);
        radialGlow.addColorStop(1, 'rgba(9, 13, 22, 0)');
        ctx.fillStyle = radialGlow;
        ctx.fillRect(0, 0, width, height);
      }

      // -------------------------------------------------------------
      // DRAW SAVED REFERENCE SPECTRUM LAYERS
      // -------------------------------------------------------------
      if (savedLayers.length > 0 && (settings.mode === 'bars' || settings.mode === 'curve' || settings.mode === 'hybrid')) {
        savedLayers.forEach((layer) => {
          if (!layer.visible) return;

          const pointsCount = 128; // standard comparative resolution
          const points: { x: number; y: number }[] = [];

          for (let i = 0; i < pointsCount; i++) {
            let dataIndex: number;
            if (settings.logScale) {
              const exp = Math.pow(i / pointsCount, 2.2);
              dataIndex = Math.min(layer.data.length - 1, Math.floor(exp * layer.data.length));
            } else {
              dataIndex = Math.floor((i / pointsCount) * (layer.data.length * 0.7));
            }

            const rawValue = layer.data[dataIndex] || 0;
            const normalized = (rawValue / 255) * settings.sensitivity;
            const h = normalized * (height * 0.75);

            const x = (i / (pointsCount - 1)) * width;
            const y = height - h - 35;
            points.push({ x, y });
          }

          if (points.length > 0) {
            ctx.save();
            ctx.beginPath();
            ctx.moveTo(points[0].x, points[0].y);
            for (let i = 0; i < points.length - 1; i++) {
              const xc = (points[i].x + points[i + 1].x) / 2;
              const yc = (points[i].y + points[i + 1].y) / 2;
              ctx.quadraticCurveTo(points[i].x, points[i].y, xc, yc);
            }
            
            // Subtle comparative fill
            ctx.globalAlpha = 0.04;
            ctx.fillStyle = layer.color;
            ctx.lineTo(width, height - 35);
            ctx.lineTo(0, height - 35);
            ctx.closePath();
            ctx.fill();

            // Distinctive comparative outline
            ctx.beginPath();
            ctx.moveTo(points[0].x, points[0].y);
            for (let i = 0; i < points.length - 1; i++) {
              const xc = (points[i].x + points[i + 1].x) / 2;
              const yc = (points[i].y + points[i + 1].y) / 2;
              ctx.quadraticCurveTo(points[i].x, points[i].y, xc, yc);
            }
            ctx.globalAlpha = 0.45;
            ctx.strokeStyle = layer.color;
            ctx.lineWidth = 1.8;
            ctx.stroke();
            ctx.restore();
          }
        });
      }

      // -------------------------------------------------------------
      // BARS SPECTRUM MODE
      // -------------------------------------------------------------
      if (settings.mode === 'bars') {
        const numBars = Math.min(binCount, Math.floor(width / (settings.barSpacing + 3)));
        const barWidth = Math.max(2, (width / numBars) - settings.barSpacing);

        // Ensure peak values array length matches numBars
        if (peakValuesRef.current.length !== numBars) {
          peakValuesRef.current = new Array(numBars).fill(0);
          peakHoldTimeRef.current = new Array(numBars).fill(0);
        }

        const gradient = createCanvasGradient(ctx, width, height, preset, settings.customGradient, settings.useCustomGradient);

        for (let i = 0; i < numBars; i++) {
          // Logarithmic or Linear Bin Mapping
          let dataIndex: number;
          if (settings.logScale) {
            const exp = Math.pow(i / numBars, 2); // Logarithmic mapping accentuating low frequencies
            dataIndex = Math.min(binCount - 1, Math.floor(exp * binCount));
          } else {
            dataIndex = Math.floor((i / numBars) * (binCount * 0.75)); // Focus on audible range
          }

          const rawValue = freqData[dataIndex] || 0;
          const normalized = (rawValue / 255) * settings.sensitivity;
          const barHeight = Math.max(3, normalized * (height * 0.78));

          const x = i * (barWidth + settings.barSpacing) + (width - numBars * (barWidth + settings.barSpacing)) / 2;
          const y = height - barHeight - 35; // Leave space for bottom scale

          // Draw Bar
          ctx.fillStyle = gradient;
          ctx.beginPath();
          ctx.roundRect(x, y, barWidth, barHeight, [3, 3, 0, 0]);
          ctx.fill();

          // Bar top accent cap
          ctx.fillStyle = peakColor;
          ctx.fillRect(x, y, barWidth, Math.min(2, barHeight));

          // Peak cap hold & decay physics
          if (settings.showPeaks) {
            if (barHeight > peakValuesRef.current[i]) {
              peakValuesRef.current[i] = barHeight;
              peakHoldTimeRef.current[i] = performance.now();
            } else if (!infinitePeakHold) {
              const elapsed = performance.now() - peakHoldTimeRef.current[i];
              if (elapsed > 400) {
                peakValuesRef.current[i] = Math.max(0, peakValuesRef.current[i] - 2.5);
              }
            }

            const peakY = height - peakValuesRef.current[i] - 35;
            if (peakValuesRef.current[i] > 2) {
              ctx.fillStyle = peakColor;
              ctx.shadowColor = preset.glowColor;
              ctx.shadowBlur = 6;
              ctx.fillRect(x, peakY - 3, barWidth, 3);
              ctx.shadowBlur = 0;
            }
          }
        }
      }

      // -------------------------------------------------------------
      // SMOOTH CURVE SPECTRUM MODE
      // -------------------------------------------------------------
      else if (settings.mode === 'curve' || settings.mode === 'hybrid') {
        const pointsCount = Math.min(binCount, 128);
        const points: { x: number; y: number }[] = [];

        // Ensure peak values array length matches pointsCount
        if (curvePeakValuesRef.current.length !== pointsCount) {
          curvePeakValuesRef.current = new Array(pointsCount).fill(0);
          curvePeakHoldTimeRef.current = new Array(pointsCount).fill(0);
        }

        for (let i = 0; i < pointsCount; i++) {
          let dataIndex: number;
          if (settings.logScale) {
            const exp = Math.pow(i / pointsCount, 2.2);
            dataIndex = Math.min(binCount - 1, Math.floor(exp * binCount));
          } else {
            dataIndex = Math.floor((i / pointsCount) * (binCount * 0.7));
          }

          const rawValue = freqData[dataIndex] || 0;
          const normalized = (rawValue / 255) * settings.sensitivity;
          const h = normalized * (height * 0.75);

          // Update peak values
          if (h > curvePeakValuesRef.current[i]) {
            curvePeakValuesRef.current[i] = h;
            curvePeakHoldTimeRef.current[i] = performance.now();
          } else if (!infinitePeakHold) {
            const elapsed = performance.now() - curvePeakHoldTimeRef.current[i];
            if (elapsed > 400) {
              curvePeakValuesRef.current[i] = Math.max(0, curvePeakValuesRef.current[i] - 1.5);
            }
          }

          const x = (i / (pointsCount - 1)) * width;
          const y = height - h - 35;
          points.push({ x, y });
        }

        if (points.length > 0) {
          const gradient = createCanvasGradient(ctx, width, height, preset, settings.customGradient, settings.useCustomGradient);

          ctx.beginPath();
          ctx.moveTo(points[0].x, height - 35);
          ctx.lineTo(points[0].x, points[0].y);

          // Bezier curve interpolation
          for (let i = 0; i < points.length - 1; i++) {
            const xc = (points[i].x + points[i + 1].x) / 2;
            const yc = (points[i].y + points[i + 1].y) / 2;
            ctx.quadraticCurveTo(points[i].x, points[i].y, xc, yc);
          }

          ctx.lineTo(points[points.length - 1].x, points[points.length - 1].y);
          ctx.lineTo(points[points.length - 1].x, height - 35);
          ctx.closePath();

          // Gradient fill
          ctx.save();
          ctx.globalAlpha = settings.fillOpacity;
          ctx.fillStyle = gradient;
          ctx.fill();
          ctx.restore();

          // Glowing contour line
          ctx.beginPath();
          ctx.moveTo(points[0].x, points[0].y);
          for (let i = 0; i < points.length - 1; i++) {
            const xc = (points[i].x + points[i + 1].x) / 2;
            const yc = (points[i].y + points[i + 1].y) / 2;
            ctx.quadraticCurveTo(points[i].x, points[i].y, xc, yc);
          }
          ctx.strokeStyle = peakColor;
          ctx.lineWidth = 2.5;
          ctx.shadowColor = preset.glowColor;
          ctx.shadowBlur = 10;
          ctx.stroke();
          ctx.shadowBlur = 0;

          // Draw Curve Peak Hold Line
          if (settings.showPeaks) {
            ctx.beginPath();
            const peakY0 = height - curvePeakValuesRef.current[0] - 35;
            ctx.moveTo(points[0].x, peakY0);
            for (let i = 0; i < points.length - 1; i++) {
              const xc = (points[i].x + points[i + 1].x) / 2;
              const peakYc = height - (curvePeakValuesRef.current[i] + curvePeakValuesRef.current[i + 1]) / 2 - 35;
              ctx.quadraticCurveTo(points[i].x, height - curvePeakValuesRef.current[i] - 35, xc, peakYc);
            }
            ctx.strokeStyle = peakColor + 'bb'; // semi-transparent
            ctx.lineWidth = 1.5;
            ctx.setLineDash([3, 4]); // Dashed line for peaks
            ctx.stroke();
            ctx.setLineDash([]); // Reset
          }
        }

        // Particle dynamics on heavy audio hits
        if (metrics.bass > 40 && isPlaying) {
          if (particlesRef.current.length < 40) {
            particlesRef.current.push({
              x: Math.random() * width,
              y: height - 40 - Math.random() * (metrics.bass * 2),
              vx: (Math.random() - 0.5) * 1.5,
              vy: -Math.random() * 2 - 1,
              size: Math.random() * 3 + 1.5,
              alpha: 1,
              color: preset.colors[Math.floor(Math.random() * preset.colors.length)],
            });
          }
        }

        // Render particles
        particlesRef.current.forEach((p, index) => {
          p.x += p.vx;
          p.y += p.vy;
          p.alpha -= 0.02;

          if (p.alpha <= 0) {
            particlesRef.current.splice(index, 1);
            return;
          }

          ctx.save();
          ctx.globalAlpha = p.alpha;
          ctx.fillStyle = p.color;
          ctx.beginPath();
          ctx.arc(p.x, p.y, p.size, 0, Math.PI * 2);
          ctx.fill();
          ctx.restore();
        });
      }

      // -------------------------------------------------------------
      // 3D WATERFALL & SPECTROGRAM RAINFALL MODE
      // -------------------------------------------------------------
      else if (settings.mode === 'waterfall') {
        const historyDepth = 60; // Deeper history buffer for smooth waterfall trails
        // Push frame into waterfall history buffer
        if (freqData && freqData.length > 0) {
          const frameCopy = new Uint8Array(freqData);
          waterfallHistoryRef.current.unshift(frameCopy);
          if (waterfallHistoryRef.current.length > historyDepth) {
            waterfallHistoryRef.current.pop();
          }
        }

        const history = waterfallHistoryRef.current;
        const currentHistoryLength = history.length;
        const numBins = Math.min(binCount, 80); // Optimal bin resolution for high-performance mesh

        // Precompute all grid vertex coordinates
        const grid: { x: number; y: number; val: number; color: string }[][] = [];

        for (let f = 0; f < currentHistoryLength; f++) {
          const frameData = history[f];
          // depthVal goes from 0.0 (newest frame at back horizon) to 1.0 (oldest frame at front)
          const depthVal = f / (currentHistoryLength - 1 || 1);
          
          const scale = 0.32 + depthVal * 0.68; // perspective scaling factor
          const frameBaseY = (height * 0.36) + depthVal * (height * 0.48);
          const frameWidth = width * 0.84 * scale;
          const startX = (width - frameWidth) / 2;

          const frameRow: { x: number; y: number; val: number; color: string }[] = [];

          for (let i = 0; i < numBins; i++) {
            let dataIndex: number;
            if (settings.logScale) {
              const exp = Math.pow(i / (numBins - 1 || 1), 2.2);
              dataIndex = Math.min(frameData.length - 1, Math.floor(exp * frameData.length));
            } else {
              dataIndex = Math.floor((i / (numBins - 1 || 1)) * (frameData.length * 0.72));
            }

            const rawVal = frameData[dataIndex] || 0;
            const normalized = (rawVal / 255) * settings.sensitivity;
            const barH = normalized * (120 * scale); // 3D mountain peak height displacement

            const px = startX + (i / (numBins - 1 || 1)) * frameWidth;
            const py = frameBaseY - barH;

            // Compute vertex color based on amplitude value
            const valNorm = Math.min(1.0, normalized);
            let vertexColor = '#00f0ff';
            if (preset.colors.length >= 3) {
              if (valNorm < 0.4) {
                vertexColor = blendHexColors(preset.colors[0], preset.colors[1], valNorm / 0.4);
              } else {
                vertexColor = blendHexColors(preset.colors[1], preset.colors[2], (valNorm - 0.4) / 0.6);
              }
            } else if (preset.colors.length === 2) {
              vertexColor = blendHexColors(preset.colors[0], preset.colors[1], valNorm);
            } else {
              vertexColor = preset.colors[0] || '#00f0ff';
            }

            frameRow.push({ x: px, y: py, val: rawVal, color: vertexColor });
          }
          grid.push(frameRow);
        }

        ctx.save();
        
        // Render from back (f = 0, horizon, depthVal = 0.0) to front (f = last, foreground, depthVal = 1.0)
        // This ensures proper 3D depth overlapping/masking
        for (let f = 0; f < currentHistoryLength; f++) {
          const depthVal = f / (currentHistoryLength - 1 || 1);
          const scale = 0.32 + depthVal * 0.68;
          const frameBaseY = (height * 0.36) + depthVal * (height * 0.48);
          
          const row = grid[f];
          if (!row || row.length === 0) continue;

          // 1. Draw solid masking shape below the mountains to obscure background peaks
          ctx.beginPath();
          ctx.moveTo(row[0].x, frameBaseY);
          for (let i = 0; i < numBins; i++) {
            ctx.lineTo(row[i].x, row[i].y);
          }
          ctx.lineTo(row[numBins - 1].x, frameBaseY);
          ctx.closePath();

          // Smooth depth fog to occlude background shapes completely
          const alphaFog = Math.min(0.98, 0.76 + depthVal * 0.22);
          ctx.fillStyle = `rgba(9, 13, 22, ${alphaFog})`;
          ctx.fill();

          // 2. Draw Longitudinal Grid Lines (Z-axis connectors/ribbons) connecting back-to-front
          if (f > 0) {
            const prevRow = grid[f - 1];
            ctx.beginPath();
            // Connect every 4th bin to create a beautiful grid spacing
            for (let i = 0; i < numBins; i += 4) {
              ctx.moveTo(row[i].x, row[i].y);
              ctx.lineTo(prevRow[i].x, prevRow[i].y);
            }
            ctx.lineWidth = Math.max(0.5, 0.8 * scale);
            // Dynamic grid connectors opacity
            ctx.strokeStyle = `rgba(56, 189, 248, ${0.08 + depthVal * 0.22})`;
            ctx.stroke();
          }

          // 3. Draw Transverse Contour Line (mountain peaks)
          ctx.beginPath();
          ctx.moveTo(row[0].x, row[0].y);
          for (let i = 1; i < numBins; i++) {
            ctx.lineTo(row[i].x, row[i].y);
          }
          
          // Symmetrical linear gradient for the crest line
          const crestGradient = ctx.createLinearGradient(row[0].x, 0, row[numBins - 1].x, 0);
          preset.colors.forEach((c, idx) => {
            crestGradient.addColorStop(idx / (preset.colors.length - 1 || 1), c);
          });

          ctx.strokeStyle = crestGradient;
          ctx.lineWidth = Math.max(1.0, 2.2 * scale);
          ctx.globalAlpha = 0.25 + depthVal * 0.75; // Horizon lines are slightly faded for atmospheric perspective
          ctx.stroke();
          ctx.globalAlpha = 1.0;

          // 4. Glow peaks - add bright glowing dots at the high spectral peaks of each frame
          for (let i = 2; i < numBins - 2; i += 2) {
            const pt = row[i];
            if (pt.val > 140) { // High amplitude signals get neon hot spots
              ctx.fillStyle = pt.color;
              ctx.shadowColor = pt.color;
              ctx.shadowBlur = Math.min(10, (pt.val - 120) * 0.15);
              ctx.beginPath();
              ctx.arc(pt.x, pt.y, Math.max(1, 2.5 * scale), 0, Math.PI * 2);
              ctx.fill();
              ctx.shadowBlur = 0;
            }
          }
        }
        ctx.restore();
      }

      // -------------------------------------------------------------
      // SPECTROGRAM / WATERFALL MODE
      // -------------------------------------------------------------
      else if (settings.mode === 'spectrogram') {
        const sCanvas = spectrogramCanvasRef.current;
        if (sCanvas) {
          if (sCanvas.width !== width || sCanvas.height !== height) {
            sCanvas.width = width;
            sCanvas.height = height;
          }
          const sCtx = sCanvas.getContext('2d');
          if (sCtx) {
            // Scroll existing image down by 2 pixels
            sCtx.drawImage(sCanvas, 0, 0, width, height, 0, 2, width, height);

            // Render new line at top (y=0)
            const numBins = Math.min(binCount, width);
            for (let x = 0; x < width; x++) {
              const binIdx = Math.floor((x / width) * (binCount * 0.7));
              const intensity = freqData[binIdx] || 0;

              // Enhanced Thermal / Plasma Color Mapping for Spectrogram Noise Floor Tracking
              let r = 0, g = 0, b = 0;
              const normalized = Math.min(1.0, (intensity / 255) * settings.sensitivity);

              if (normalized < 0.1) {
                // Noise Floor / Silence: Deep Navy / Charcoal
                r = Math.floor(9 + normalized * 100);
                g = Math.floor(13 + normalized * 100);
                b = Math.floor(22 + normalized * 300);
              } else if (normalized < 0.4) {
                // Low level ambient: Cyan / Teal
                r = Math.floor((normalized - 0.1) * 3 * 30);
                g = Math.floor(100 + (normalized - 0.1) * 3 * 155);
                b = 210;
              } else if (normalized < 0.75) {
                // Mid level sound: Bright Yellow / Gold
                r = 255;
                g = Math.floor(160 + (normalized - 0.4) * 2.8 * 95);
                b = Math.floor(30 + (normalized - 0.4) * 2.8 * 80);
              } else {
                // High transient spike: Intense Magenta / Hot Pink
                r = 255;
                g = Math.floor(255 - (normalized - 0.75) * 4 * 180);
                b = Math.floor(200 + (normalized - 0.75) * 4 * 55);
              }

              sCtx.fillStyle = `rgb(${r},${g},${b})`;
              sCtx.fillRect(x, 0, 1, 2);
            }
            ctx.drawImage(sCanvas, 0, 0);
          }
        }
      }

      // -------------------------------------------------------------
      // OSCILLOSCOPE / WAVEFORM MODE
      // -------------------------------------------------------------
      else if (settings.mode === 'waveform') {
        ctx.beginPath();
        const sliceWidth = width / timeData.length;
        let x = 0;

        for (let i = 0; i < timeData.length; i++) {
          const v = timeData[i] / 128.0; // 128 is zero crossing
          const y = (v * (height / 2.5)) + (height / 2 - 15);

          if (i === 0) {
            ctx.moveTo(x, y);
          } else {
            ctx.lineTo(x, y);
          }
          x += sliceWidth;
        }

        ctx.lineTo(width, height / 2 - 15);
        ctx.strokeStyle = preset.colors[0] || '#00f0ff';
        ctx.lineWidth = 2.5;
        ctx.shadowColor = preset.glowColor;
        ctx.shadowBlur = 12;
        ctx.stroke();
        ctx.shadowBlur = 0;
      }

      // -------------------------------------------------------------
      // HYBRID MODE OVERLAY: WAVEFORM MINI OSCILLOSCOPE
      // -------------------------------------------------------------
      if (settings.mode === 'hybrid') {
        const miniHeight = 60;
        const miniY = 25;

        ctx.save();
        ctx.fillStyle = 'rgba(15, 23, 42, 0.6)';
        ctx.strokeStyle = 'rgba(51, 65, 85, 0.4)';
        ctx.roundRect(15, miniY, width - 30, miniHeight, 6);
        ctx.fill();
        ctx.stroke();

        ctx.beginPath();
        const sliceWidth = (width - 40) / timeData.length;
        let x = 20;

        for (let i = 0; i < timeData.length; i++) {
          const v = timeData[i] / 128.0;
          const y = miniY + (miniHeight / 2) + ((v - 1) * (miniHeight / 2.2));

          if (i === 0) {
            ctx.moveTo(x, y);
          } else {
            ctx.lineTo(x, y);
          }
          x += sliceWidth;
        }

        ctx.strokeStyle = '#38bdf8';
        ctx.lineWidth = 1.5;
        ctx.stroke();
        ctx.restore();
      }

      // -------------------------------------------------------------
      // OVERLAYS: Hz FREQUENCY SCALE & dB GRID
      // -------------------------------------------------------------
      if (settings.showHzScale) {
        ctx.fillStyle = 'rgba(148, 163, 184, 0.7)';
        ctx.font = '11px monospace';
        ctx.textAlign = 'center';

        const hzLabels = [
          { hz: '20Hz', ratio: 0.02 },
          { hz: '60Hz', ratio: 0.08 },
          { hz: '250Hz', ratio: 0.22 },
          { hz: '500Hz', ratio: 0.35 },
          { hz: '1kHz', ratio: 0.5 },
          { hz: '2.5kHz', ratio: 0.65 },
          { hz: '5kHz', ratio: 0.78 },
          { hz: '10kHz', ratio: 0.88 },
          { hz: '20kHz', ratio: 0.98 },
        ];

        // Bottom axis border line
        ctx.strokeStyle = 'rgba(51, 65, 85, 0.6)';
        ctx.beginPath();
        ctx.moveTo(0, height - 32);
        ctx.lineTo(width, height - 32);
        ctx.stroke();

        hzLabels.forEach((label) => {
          const labelX = label.ratio * width;
          ctx.fillText(label.hz, labelX, height - 12);

          // Tick line
          ctx.beginPath();
          ctx.moveTo(labelX, height - 32);
          ctx.lineTo(labelX, height - 26);
          ctx.stroke();
        });
      }

      if (settings.showDbGrid) {
        ctx.fillStyle = 'rgba(148, 163, 184, 0.5)';
        ctx.font = '10px monospace';
        ctx.textAlign = 'left';

        const dbSteps = [-6, -12, -24, -36, -48, -60];
        dbSteps.forEach((db) => {
          const norm = (db - settings.minDecibels) / (settings.maxDecibels - settings.minDecibels);
          const lineY = height - 35 - norm * (height * 0.75);

          if (lineY > 20 && lineY < height - 40) {
            ctx.strokeStyle = 'rgba(51, 65, 85, 0.25)';
            ctx.setLineDash([4, 4]);
            ctx.beginPath();
            ctx.moveTo(0, lineY);
            ctx.lineTo(width, lineY);
            ctx.stroke();
            ctx.setLineDash([]);

            ctx.fillText(`${db} dB`, 8, lineY - 3);
          }
        });
      }

      ctx.restore();
      animationFrameId = requestAnimationFrame(render);
    };

    render();

    return () => {
      cancelAnimationFrame(animationFrameId);
      resizeObserver.disconnect();
    };
  }, [settings, getFrequencyData, getTimeDomainData, metrics, isPlaying, savedLayers, infinitePeakHold]);

  return (
    <div
      ref={containerRef}
      id="spectrum-canvas-container"
      className="relative w-full h-[440px] md:h-[520px] bg-slate-950 rounded-2xl border border-slate-800 shadow-2xl overflow-hidden flex flex-col group"
    >
      {/* Top Bar Floating Controls on Canvas */}
      <div className="absolute top-4 right-4 flex items-center gap-2 z-10 pointer-events-auto">
        <button
          onClick={exportSnapshot}
          title="Export PNG Snapshot"
          id="btn-export-snapshot"
          className="p-2 bg-slate-900/80 hover:bg-slate-800 backdrop-blur-md text-slate-300 hover:text-white rounded-xl border border-slate-700/60 transition-all active:scale-95 shadow-md cursor-pointer"
        >
          <Camera className="w-4 h-4" />
        </button>
        <button
          onClick={toggleFullscreen}
          title={isFullscreen ? 'Exit Fullscreen' : 'Fullscreen Display'}
          id="btn-toggle-fullscreen"
          className="p-2 bg-slate-900/80 hover:bg-slate-800 backdrop-blur-md text-slate-300 hover:text-white rounded-xl border border-slate-700/60 transition-all active:scale-95 shadow-md cursor-pointer"
        >
          {isFullscreen ? <Minimize2 className="w-4 h-4" /> : <Maximize2 className="w-4 h-4" />}
        </button>
      </div>

      {/* Toast Notification Banner */}
      {toastMessage && (
        <div className="absolute top-16 left-1/2 -translate-x-1/2 z-20 bg-gradient-to-r from-cyan-500 to-emerald-500 text-slate-950 px-4 py-2 rounded-full font-bold text-xs shadow-xl flex items-center gap-2 border border-cyan-400/30">
          <Sparkles className="w-3.5 h-3.5 animate-pulse" /> {toastMessage}
        </div>
      )}

      {/* HTML5 Canvas */}
      <div className="flex-1 w-full min-h-0 relative">
        <canvas ref={canvasRef} className="w-full h-full block cursor-crosshair" />
      </div>

      {/* Collapsible Layers Manager Drawer */}
      {showLayersManager && savedLayers.length > 0 && (
        <div className="bg-slate-950/95 border-t border-slate-800/85 p-3 max-h-[160px] overflow-y-auto z-10 backdrop-blur-md">
          <div className="flex items-center justify-between mb-2 pb-1 border-b border-slate-800/60">
            <h4 className="text-[11px] font-bold text-slate-400 uppercase tracking-wider flex items-center gap-1.5">
              <Layers className="w-3.5 h-3.5 text-cyan-400" />
              Active Spectrum Overlays & Comparators
            </h4>
            <button
              onClick={() => setShowLayersManager(false)}
              className="p-1 text-slate-500 hover:text-slate-300 hover:bg-slate-900 rounded-md transition-all cursor-pointer"
            >
              <X className="w-3.5 h-3.5" />
            </button>
          </div>

          <div className="flex flex-col gap-2">
            {savedLayers.map((layer) => (
              <div key={layer.id} className="flex items-center justify-between gap-3 bg-slate-900/60 border border-slate-800/50 p-2 rounded-lg text-xs">
                {/* Name & input to edit */}
                <div className="flex items-center gap-2 flex-1 min-w-0">
                  <div className="w-2.5 h-2.5 rounded-full shrink-0 shadow-sm" style={{ backgroundColor: layer.color }} />
                  <input
                    type="text"
                    value={layer.name}
                    onChange={(e) => renameLayer(layer.id, e.target.value)}
                    className="bg-transparent border-b border-transparent hover:border-slate-700 focus:border-cyan-500 focus:outline-none text-slate-200 font-medium px-1 py-0.5 rounded transition-all w-full max-w-[150px] sm:max-w-xs truncate"
                  />
                  <span className="text-[10px] text-slate-500 hidden sm:inline shrink-0">{layer.timestamp}</span>
                </div>

                {/* Controls (Visibility, Color change, Delete) */}
                <div className="flex items-center gap-2 shrink-0">
                  {/* Quick Color Selector */}
                  <div className="flex items-center gap-1 bg-slate-950/50 p-1 rounded-md border border-slate-800/40">
                    {LAYER_COLORS.map((color) => (
                      <button
                        key={color}
                        onClick={() => changeLayerColor(layer.id, color)}
                        className={`w-3 h-3 rounded-full hover:scale-125 transition-all shrink-0 cursor-pointer ${
                          layer.color === color ? 'ring-1 ring-offset-1 ring-offset-slate-950 ring-white scale-110' : 'opacity-60 hover:opacity-100'
                        }`}
                        style={{ backgroundColor: color }}
                      />
                    ))}
                  </div>

                  {/* Toggle Visibility */}
                  <button
                    onClick={() => toggleLayerVisibility(layer.id)}
                    className={`p-1 rounded-md hover:bg-slate-800 border transition-all cursor-pointer ${
                      layer.visible
                        ? 'border-slate-850 text-slate-200'
                        : 'border-slate-850/40 text-slate-600 hover:text-slate-400'
                    }`}
                    title={layer.visible ? 'Hide overlay' : 'Show overlay'}
                  >
                    {layer.visible ? <Eye className="w-3.5 h-3.5" /> : <EyeOff className="w-3.5 h-3.5" />}
                  </button>

                  {/* Delete */}
                  <button
                    onClick={() => deleteLayer(layer.id)}
                    className="p-1 rounded-md hover:bg-rose-500/10 border border-transparent hover:border-rose-500/20 text-slate-500 hover:text-rose-400 transition-all cursor-pointer"
                    title="Delete reference layer"
                  >
                    <Trash2 className="w-3.5 h-3.5" />
                  </button>
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Bottom Dashboard Bar for High-Precision Analyzers */}
      <div className="bg-slate-900/95 border-t border-slate-800/80 p-3 flex flex-col sm:flex-row items-stretch sm:items-center justify-between gap-3 text-xs text-slate-300">
        {/* Left side: Peak Hold Controls */}
        <div className="flex items-center gap-2">
          <span className="text-[10px] font-bold text-slate-500 uppercase tracking-wider">Peak Hold:</span>
          <button
            onClick={() => setInfinitePeakHold(!infinitePeakHold)}
            id="btn-toggle-infinite-peak"
            className={`px-2.5 py-1.5 rounded-lg border flex items-center gap-1.5 font-semibold transition-all cursor-pointer ${
              infinitePeakHold
                ? 'bg-amber-500/15 border-amber-500/40 text-amber-300 font-bold'
                : 'bg-slate-950 border-slate-800 hover:bg-slate-850 text-slate-400 hover:text-slate-200'
            }`}
            title="Toggle infinite peak hold (locks peak lines at maximum values)"
          >
            {infinitePeakHold ? <Pin className="w-3.5 h-3.5 rotate-45 text-amber-400" /> : <Pin className="w-3.5 h-3.5 opacity-60" />}
            {infinitePeakHold ? 'Infinite Hold' : 'Decaying Peak'}
          </button>
          
          <button
            onClick={resetPeaks}
            id="btn-reset-peaks"
            className="px-2.5 py-1.5 rounded-lg bg-slate-950 border border-slate-800 hover:bg-slate-850 hover:border-slate-700 text-slate-300 font-semibold flex items-center gap-1.5 transition-all cursor-pointer"
            title="Reset current peak levels to zero"
          >
            <RefreshCw className="w-3.5 h-3.5 text-slate-400" />
            Reset Peaks
          </button>
        </div>

        {/* Right side: Layering system */}
        <div className="flex items-center gap-2 flex-wrap sm:flex-nowrap justify-between">
          <div className="flex items-center gap-1.5">
            <span className="text-[10px] font-bold text-slate-500 uppercase tracking-wider">Layers:</span>
            <button
              onClick={captureCurrentLayer}
              disabled={!isPlaying && metrics.peakFrequencyHz === 0}
              id="btn-capture-layer"
              className="px-2.5 py-1.5 rounded-lg bg-gradient-to-r from-cyan-500/10 to-emerald-500/10 hover:from-cyan-500/20 hover:to-emerald-500/20 border border-cyan-500/30 hover:border-cyan-500/50 text-cyan-300 font-bold flex items-center gap-1.5 transition-all cursor-pointer disabled:opacity-40 disabled:cursor-not-allowed"
              title="Capture current frequency spectrum envelope as a comparative overlay"
            >
              <Plus className="w-3.5 h-3.5" />
              Capture Layer
            </button>
          </div>

          {savedLayers.length > 0 && (
            <button
              onClick={() => setShowLayersManager(!showLayersManager)}
              id="btn-toggle-layers-manager"
              className={`px-2.5 py-1.5 rounded-lg border flex items-center gap-1.5 font-semibold transition-all cursor-pointer ${
                showLayersManager
                  ? 'bg-cyan-500/15 border-cyan-500/40 text-cyan-300'
                  : 'bg-slate-950 border-slate-800 hover:bg-slate-850 text-slate-400 hover:text-slate-200'
              }`}
            >
              <Layers className="w-3.5 h-3.5" />
              Manage ({savedLayers.length})
            </button>
          )}
        </div>
      </div>
    </div>
  );
};
