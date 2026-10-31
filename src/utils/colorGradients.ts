import { ColorGradientPreset, CustomGradient, SpectrogramColorMap } from '../types';

export interface ScientificColorMapPreset extends ColorGradientPreset {
  id: SpectrogramColorMap;
  description: string;
  previewGradient: string;
}

export const COLOR_PRESETS: ScientificColorMapPreset[] = [
  {
    id: 'thermal',
    name: 'Thermal Neon',
    description: 'Calibrated Navy → Laser Cyan → Gold → Magenta Peak',
    previewGradient: 'from-slate-900 via-cyan-500 to-pink-500',
    colors: ['#06b6d4', '#eab308', '#ec4899'],
    peakColor: '#ffffff',
    glowColor: 'rgba(6, 182, 212, 0.45)',
  },
  {
    id: 'viridis',
    name: 'Viridis (ISO)',
    description: 'Perceptually Uniform Deep Violet → Teal → Solar Yellow',
    previewGradient: 'from-purple-950 via-teal-500 to-yellow-300',
    colors: ['#3b528b', '#21918c', '#fde725'],
    peakColor: '#fef08a',
    glowColor: 'rgba(33, 145, 140, 0.45)',
  },
  {
    id: 'inferno',
    name: 'Inferno Lab',
    description: 'High-Contrast Obsidian → Crimson → Incandescent Yellow',
    previewGradient: 'from-zinc-950 via-red-600 to-amber-200',
    colors: ['#57106e', '#dd513a', '#fcffa4'],
    peakColor: '#fef9c3',
    glowColor: 'rgba(221, 81, 58, 0.45)',
  },
  {
    id: 'magma',
    name: 'Magma Acoustic',
    description: 'Deep Indigo → Warm Magenta → Coral → White Hot',
    previewGradient: 'from-slate-950 via-fuchsia-600 to-orange-200',
    colors: ['#3b0f70', '#de4968', '#fe9f6d'],
    peakColor: '#fff7ed',
    glowColor: 'rgba(222, 73, 104, 0.45)',
  },
  {
    id: 'matrix',
    name: 'Phosphor CRT',
    description: 'Monochrome Sonar Green Persistence & High-Visibility Trace',
    previewGradient: 'from-emerald-950 via-emerald-500 to-lime-200',
    colors: ['#059669', '#10b981', '#a3e635'],
    peakColor: '#ecfccb',
    glowColor: 'rgba(16, 185, 129, 0.45)',
  },
];

export function getPresetById(id: string): ScientificColorMapPreset {
  return COLOR_PRESETS.find((p) => p.id === id) || COLOR_PRESETS[0];
}

export function createCanvasGradient(
  ctx: CanvasRenderingContext2D,
  width: number,
  height: number,
  preset: ColorGradientPreset,
  custom?: CustomGradient,
  useCustom: boolean = false
): CanvasGradient {
  const gradient = ctx.createLinearGradient(0, height, 0, 0);

  if (useCustom && custom) {
    gradient.addColorStop(0, custom.start);
    gradient.addColorStop(0.5, custom.middle);
    gradient.addColorStop(1, custom.end);
    return gradient;
  }

  const colors = preset.colors;
  if (colors.length === 2) {
    gradient.addColorStop(0, colors[0]);
    gradient.addColorStop(1, colors[1]);
  } else if (colors.length >= 3) {
    gradient.addColorStop(0, colors[0]);
    gradient.addColorStop(0.5, colors[1]);
    gradient.addColorStop(1, colors[2]);
  } else {
    gradient.addColorStop(0, colors[0] || '#06b6d4');
    gradient.addColorStop(1, '#ec4899');
  }

  return gradient;
}

export function getPeakColor(
  preset: ColorGradientPreset,
  custom?: CustomGradient,
  useCustom: boolean = false
): string {
  if (useCustom && custom) {
    return custom.peak;
  }
  return preset.peakColor;
}
