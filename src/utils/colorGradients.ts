import { ColorGradientPreset, CustomGradient } from '../types';

export const COLOR_PRESETS: ColorGradientPreset[] = [
  {
    id: 'cyberpunk',
    name: 'Cyberpunk Neon',
    colors: ['#00f0ff', '#7000ff', '#ff007f'],
    peakColor: '#ffffff',
    glowColor: 'rgba(0, 240, 255, 0.45)',
  },
  {
    id: 'phosphor',
    name: 'Phosphor Green CRT',
    colors: ['#00ff66', '#39ff14', '#ccff00'],
    peakColor: '#ffffff',
    glowColor: 'rgba(57, 255, 20, 0.45)',
  },
  {
    id: 'laser',
    name: 'Laser Cyan & Blue',
    colors: ['#00f6ff', '#0072ff', '#00d2ff'],
    peakColor: '#ffffff',
    glowColor: 'rgba(0, 246, 255, 0.45)',
  },
  {
    id: 'plasma',
    name: 'Neon Plasma Pink',
    colors: ['#ff007f', '#9b00e8', '#ff3399'],
    peakColor: '#ffffff',
    glowColor: 'rgba(255, 0, 127, 0.45)',
  },
  {
    id: 'aurora',
    name: 'Emerald Aurora',
    colors: ['#00e676', '#00b0ff', '#ffea00'],
    peakColor: '#ffffff',
    glowColor: 'rgba(0, 230, 118, 0.4)',
  },
  {
    id: 'sunset',
    name: 'Inferno Sunset',
    colors: ['#ffc400', '#ff3d00', '#d50000'],
    peakColor: '#ffe57f',
    glowColor: 'rgba(255, 61, 0, 0.4)',
  },
  {
    id: 'electric',
    name: 'Electric Violet',
    colors: ['#3d5af1', '#651fff', '#f50057'],
    peakColor: '#00e5ff',
    glowColor: 'rgba(101, 31, 255, 0.4)',
  },
  {
    id: 'solar',
    name: 'Solar Flare',
    colors: ['#ff6d00', '#ffab00', '#ffffff'],
    peakColor: '#ffffff',
    glowColor: 'rgba(255, 171, 0, 0.4)',
  },
  {
    id: 'matrix',
    name: 'Matrix Code',
    colors: ['#00c853', '#64dd17', '#aeea00'],
    peakColor: '#ffffff',
    glowColor: 'rgba(0, 200, 83, 0.4)',
  },
  {
    id: 'synthwave',
    name: '80s Synthwave',
    colors: ['#4a148c', '#ff4081', '#18ffff'],
    peakColor: '#ffffff',
    glowColor: 'rgba(255, 64, 129, 0.4)',
  },
  {
    id: 'monochrome',
    name: 'Monochrome Silver',
    colors: ['#475569', '#94a3b8', '#f8fafc'],
    peakColor: '#38bdf8',
    glowColor: 'rgba(148, 163, 184, 0.25)',
  },
];

export function getPresetById(id: string): ColorGradientPreset {
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
    gradient.addColorStop(0, colors[0] || '#00f0ff');
    gradient.addColorStop(1, '#ff007f');
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
