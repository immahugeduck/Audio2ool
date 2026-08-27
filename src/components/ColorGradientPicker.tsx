import React from 'react';
import { VisualizerSettings, CustomGradient } from '../types';
import { COLOR_PRESETS } from '../utils/colorGradients';
import { Palette, Check, Sparkles } from 'lucide-react';

interface ColorGradientPickerProps {
  settings: VisualizerSettings;
  updateSettings: (partial: Partial<VisualizerSettings>) => void;
}

export const ColorGradientPicker: React.FC<ColorGradientPickerProps> = ({
  settings,
  updateSettings,
}) => {
  const handleCustomColorChange = (key: keyof CustomGradient, value: string) => {
    updateSettings({
      useCustomGradient: true,
      customGradient: {
        ...settings.customGradient,
        [key]: value,
      },
    });
  };

  return (
    <div className="bg-slate-900/95 rounded-2xl border border-cyan-500/20 p-4 sm:p-5 shadow-2xl backdrop-blur-md flex flex-col gap-4">
      <div className="flex items-center justify-between pb-3 border-b border-slate-800">
        <div className="flex items-center gap-2">
          <div className="p-1.5 rounded-lg bg-fuchsia-500/10 border border-fuchsia-500/30 text-fuchsia-400">
            <Palette className="w-4 h-4" />
          </div>
          <div>
            <h2 className="text-sm font-bold text-white tracking-wide">Neon Palettes & Color Schemes</h2>
            <p className="text-[11px] text-slate-400">High-contrast phosphor, laser, and cyberpunk color themes</p>
          </div>
        </div>

        <button
          onClick={() => updateSettings({ useCustomGradient: !settings.useCustomGradient })}
          id="btn-toggle-custom-gradient"
          className={`flex items-center gap-1.5 px-3 py-1.5 rounded-xl text-xs font-bold border transition-all cursor-pointer ${
            settings.useCustomGradient
              ? 'bg-fuchsia-500/20 border-fuchsia-400 text-fuchsia-300 shadow-[0_0_12px_rgba(217,70,239,0.3)]'
              : 'bg-slate-950 border-slate-800 text-slate-400 hover:text-white hover:border-slate-700'
          }`}
        >
          <Sparkles className="w-3.5 h-3.5" />
          {settings.useCustomGradient ? 'Custom Mode Active' : 'Custom Builder'}
        </button>
      </div>

      {/* Preset Cards Grid */}
      {!settings.useCustomGradient ? (
        <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 gap-2.5">
          {COLOR_PRESETS.map((preset) => {
            const isSelected = settings.colorPresetId === preset.id;
            return (
              <button
                key={preset.id}
                onClick={() =>
                  updateSettings({
                    colorPresetId: preset.id,
                    useCustomGradient: false,
                  })
                }
                id={`btn-preset-${preset.id}`}
                className={`flex flex-col gap-2 p-2.5 rounded-xl border text-left transition-all cursor-pointer ${
                  isSelected
                    ? 'bg-slate-800/90 border-cyan-400 text-cyan-200 ring-1 ring-cyan-400/40 shadow-[0_0_14px_rgba(6,182,212,0.25)]'
                    : 'bg-slate-950/80 border-slate-800/90 text-slate-300 hover:border-slate-700 hover:bg-slate-900/80'
                }`}
              >
                <div className="flex items-center justify-between">
                  <span className="text-xs font-bold truncate">{preset.name}</span>
                  {isSelected && <Check className="w-3.5 h-3.5 text-cyan-400 shrink-0" />}
                </div>

                {/* Gradient Preview Strip */}
                <div
                  className="w-full h-3 rounded-md shadow-inner ring-1 ring-white/10"
                  style={{
                    background: `linear-gradient(to right, ${preset.colors.join(', ')})`,
                  }}
                />
              </button>
            );
          })}
        </div>
      ) : (
        /* Custom Color Builder */
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 bg-slate-950/90 p-3 rounded-xl border border-slate-800">
          <div className="flex flex-col gap-1.5">
            <label className="text-xs text-slate-300 font-medium">Base Color</label>
            <div className="flex items-center gap-2">
              <input
                type="color"
                value={settings.customGradient.start}
                onChange={(e) => handleCustomColorChange('start', e.target.value)}
                className="w-8 h-8 rounded-lg border-0 bg-transparent cursor-pointer"
              />
              <span className="font-mono text-xs text-cyan-400 font-bold">{settings.customGradient.start}</span>
            </div>
          </div>

          <div className="flex flex-col gap-1.5">
            <label className="text-xs text-slate-300 font-medium">Mid Color</label>
            <div className="flex items-center gap-2">
              <input
                type="color"
                value={settings.customGradient.middle}
                onChange={(e) => handleCustomColorChange('middle', e.target.value)}
                className="w-8 h-8 rounded-lg border-0 bg-transparent cursor-pointer"
              />
              <span className="font-mono text-xs text-cyan-400 font-bold">{settings.customGradient.middle}</span>
            </div>
          </div>

          <div className="flex flex-col gap-1.5">
            <label className="text-xs text-slate-300 font-medium">Top Color</label>
            <div className="flex items-center gap-2">
              <input
                type="color"
                value={settings.customGradient.end}
                onChange={(e) => handleCustomColorChange('end', e.target.value)}
                className="w-8 h-8 rounded-lg border-0 bg-transparent cursor-pointer"
              />
              <span className="font-mono text-xs text-cyan-400 font-bold">{settings.customGradient.end}</span>
            </div>
          </div>

          <div className="flex flex-col gap-1.5">
            <label className="text-xs text-slate-300 font-medium">Peak Cap Color</label>
            <div className="flex items-center gap-2">
              <input
                type="color"
                value={settings.customGradient.peak}
                onChange={(e) => handleCustomColorChange('peak', e.target.value)}
                className="w-8 h-8 rounded-lg border-0 bg-transparent cursor-pointer"
              />
              <span className="font-mono text-xs text-cyan-400 font-bold">{settings.customGradient.peak}</span>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
