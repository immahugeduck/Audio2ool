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
    <div className="bg-slate-900/90 rounded-2xl border border-slate-800 p-4 sm:p-5 shadow-xl flex flex-col gap-4">
      <div className="flex items-center justify-between pb-3 border-b border-slate-800">
        <div className="flex items-center gap-2">
          <Palette className="w-4 h-4 text-cyan-400" />
          <h2 className="text-sm font-semibold text-white">Color Gradients & Themes</h2>
        </div>

        <button
          onClick={() => updateSettings({ useCustomGradient: !settings.useCustomGradient })}
          id="btn-toggle-custom-gradient"
          className={`flex items-center gap-1.5 px-3 py-1 rounded-full text-xs font-medium border transition-all cursor-pointer ${
            settings.useCustomGradient
              ? 'bg-fuchsia-500/20 border-fuchsia-500/50 text-fuchsia-300'
              : 'bg-slate-950 border-slate-800 text-slate-400 hover:text-white'
          }`}
        >
          <Sparkles className="w-3 h-3" />
          {settings.useCustomGradient ? 'Using Custom Colors' : 'Enable Custom Builder'}
        </button>
      </div>

      {/* Preset Cards Grid */}
      {!settings.useCustomGradient ? (
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-2.5">
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
                    ? 'bg-slate-800/90 border-cyan-500/60 ring-1 ring-cyan-500/40 shadow-lg'
                    : 'bg-slate-950 border-slate-800 hover:border-slate-700 hover:bg-slate-900'
                }`}
              >
                <div className="flex items-center justify-between">
                  <span className="text-xs font-medium text-slate-200 truncate">{preset.name}</span>
                  {isSelected && <Check className="w-3.5 h-3.5 text-cyan-400 shrink-0" />}
                </div>

                {/* Gradient Preview Strip */}
                <div
                  className="w-full h-3.5 rounded-md shadow-inner"
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
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 bg-slate-950 p-3 rounded-xl border border-slate-800">
          <div className="flex flex-col gap-1.5">
            <label className="text-xs text-slate-400">Start Color (Base)</label>
            <div className="flex items-center gap-2">
              <input
                type="color"
                value={settings.customGradient.start}
                onChange={(e) => handleCustomColorChange('start', e.target.value)}
                className="w-8 h-8 rounded-lg border-0 bg-transparent cursor-pointer"
              />
              <span className="font-mono text-xs text-slate-300">{settings.customGradient.start}</span>
            </div>
          </div>

          <div className="flex flex-col gap-1.5">
            <label className="text-xs text-slate-400">Middle Color</label>
            <div className="flex items-center gap-2">
              <input
                type="color"
                value={settings.customGradient.middle}
                onChange={(e) => handleCustomColorChange('middle', e.target.value)}
                className="w-8 h-8 rounded-lg border-0 bg-transparent cursor-pointer"
              />
              <span className="font-mono text-xs text-slate-300">{settings.customGradient.middle}</span>
            </div>
          </div>

          <div className="flex flex-col gap-1.5">
            <label className="text-xs text-slate-400">End Color (Top)</label>
            <div className="flex items-center gap-2">
              <input
                type="color"
                value={settings.customGradient.end}
                onChange={(e) => handleCustomColorChange('end', e.target.value)}
                className="w-8 h-8 rounded-lg border-0 bg-transparent cursor-pointer"
              />
              <span className="font-mono text-xs text-slate-300">{settings.customGradient.end}</span>
            </div>
          </div>

          <div className="flex flex-col gap-1.5">
            <label className="text-xs text-slate-400">Peak Cap Color</label>
            <div className="flex items-center gap-2">
              <input
                type="color"
                value={settings.customGradient.peak}
                onChange={(e) => handleCustomColorChange('peak', e.target.value)}
                className="w-8 h-8 rounded-lg border-0 bg-transparent cursor-pointer"
              />
              <span className="font-mono text-xs text-slate-300">{settings.customGradient.peak}</span>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
