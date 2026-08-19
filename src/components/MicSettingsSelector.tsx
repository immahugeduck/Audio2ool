import React from 'react';
import { Mic, Bluetooth, Laptop, Volume2, VolumeX, RefreshCw, AlertCircle } from 'lucide-react';
import { AudioEngineState, AudioMetrics } from '../types';

interface MicSettingsSelectorProps {
  engineState: AudioEngineState;
  enableMicrophone: (deviceId?: string) => Promise<void>;
  toggleMicMonitoring: () => void;
  metrics: AudioMetrics;
}

export const MicSettingsSelector: React.FC<MicSettingsSelectorProps> = ({
  engineState,
  enableMicrophone,
  toggleMicMonitoring,
  metrics,
}) => {
  const {
    audioInputDevices,
    selectedDeviceId,
    micActive,
    micError,
    micMonitoring,
    isBluetoothConnected,
    bluetoothDeviceName,
    phoneMicDeviceName,
  } = engineState;

  // Handle device change from select dropdown
  const handleDeviceChange = (e: React.ChangeEvent<HTMLSelectElement>) => {
    const deviceId = e.target.value;
    enableMicrophone(deviceId);
  };

  // Find active device info
  const activeDevice = audioInputDevices.find((d) => d.deviceId === selectedDeviceId);
  const isBluetoothActive = activeDevice?.isBluetooth || false;

  // Calculate volume bar heights/colors (rmsDb ranges from -100 to 0)
  const rmsPercentage = Math.min(100, Math.max(0, (metrics.rmsDb + 90) * (100 / 90)));

  return (
    <div className="bg-slate-900/90 border border-slate-800 rounded-2xl p-4 sm:p-5 shadow-xl backdrop-blur-md">
      <div className="flex flex-col md:flex-row items-start md:items-center justify-between gap-4 mb-4">
        <div>
          <div className="flex items-center gap-2">
            <div className="p-2 bg-rose-500/10 border border-rose-500/20 text-rose-400 rounded-xl">
              <Mic className="w-5 h-5" />
            </div>
            <div>
              <h3 className="text-sm font-black tracking-wide text-white uppercase">
                Microphone & Input Settings
              </h3>
              <p className="text-xs text-slate-400">
                Choose live input sources, Bluetooth wearables, or system audio feeds
              </p>
            </div>
          </div>
        </div>

        {/* Action Status Badges */}
        <div className="flex items-center gap-2 flex-wrap">
          {isBluetoothConnected && (
            <span className="px-2.5 py-1 rounded-lg text-[10px] font-bold font-mono bg-cyan-500/10 border border-cyan-500/30 text-cyan-300 flex items-center gap-1">
              <Bluetooth className="w-3.5 h-3.5 text-cyan-400" />
              BT READY: {bluetoothDeviceName ? bluetoothDeviceName.split('(')[0].trim() : 'Wireless'}
            </span>
          )}
          {micActive ? (
            <span className="px-2.5 py-1 rounded-lg text-[10px] font-bold font-mono bg-emerald-500/10 border border-emerald-500/30 text-emerald-400 flex items-center gap-1.5 shadow-[0_0_12px_rgba(16,185,129,0.15)] animate-pulse">
              <span className="w-1.5 h-1.5 rounded-full bg-emerald-400" />
              LIVE STREAMING
            </span>
          ) : (
            <span className="px-2.5 py-1 rounded-lg text-[10px] font-bold font-mono bg-slate-850 border border-slate-800 text-slate-500">
              STANDBY
            </span>
          )}
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-12 gap-4 items-center">
        {/* Device Selection Dropdown (6 Cols) */}
        <div className="lg:col-span-6 flex flex-col gap-1.5">
          <label className="text-[10px] font-bold text-slate-400 uppercase tracking-wider block">
            Select Active Device
          </label>
          <div className="relative">
            <select
              value={selectedDeviceId || 'default'}
              onChange={handleDeviceChange}
              className="w-full bg-slate-950 border border-slate-800 focus:border-cyan-500 text-slate-200 text-xs rounded-xl py-2.5 pl-9 pr-8 outline-none cursor-pointer appearance-none transition-all font-semibold"
            >
              {audioInputDevices.length === 0 ? (
                <option value="default">Default Input Device</option>
              ) : (
                audioInputDevices.map((device) => (
                  <option key={device.deviceId} value={device.deviceId}>
                    {device.label}
                  </option>
                ))
              )}
            </select>
            <div className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400 pointer-events-none">
              {isBluetoothActive ? (
                <Bluetooth className="w-4 h-4 text-cyan-400" />
              ) : (
                <Laptop className="w-4 h-4 text-rose-400" />
              )}
            </div>
            <div className="absolute right-3 top-1/2 -translate-y-1/2 pointer-events-none text-slate-500">
              <RefreshCw className="w-3.5 h-3.5" />
            </div>
          </div>
        </div>

        {/* Monitoring Mode (3 Cols) */}
        <div className="lg:col-span-3 flex flex-col gap-1.5">
          <label className="text-[10px] font-bold text-slate-400 uppercase tracking-wider block">
            Audio Playback Feedback
          </label>
          <button
            onClick={toggleMicMonitoring}
            className={`w-full py-2 px-3 rounded-xl text-xs font-bold border transition-all flex items-center justify-between gap-2 cursor-pointer ${
              micMonitoring
                ? 'bg-amber-500/10 border-amber-500/40 text-amber-300 shadow-[0_0_12px_rgba(245,158,11,0.1)]'
                : 'bg-slate-950 border-slate-800 text-slate-400 hover:text-slate-300'
            }`}
            title="Warning: Feedback may occur if using speakers without headphones!"
          >
            <div className="flex items-center gap-1.5">
              {micMonitoring ? <Volume2 className="w-4 h-4 text-amber-400" /> : <VolumeX className="w-4 h-4 text-slate-400" />}
              <span>{micMonitoring ? 'Feedback Monitor ON' : 'Feedback Monitor OFF'}</span>
            </div>
            <span className={`w-1.5 h-1.5 rounded-full ${micMonitoring ? 'bg-amber-400 animate-ping' : 'bg-slate-600'}`} />
          </button>
        </div>

        {/* Real-time Level VU Indicator (3 Cols) */}
        <div className="lg:col-span-3 flex flex-col gap-1.5">
          <label className="text-[10px] font-bold text-slate-400 uppercase tracking-wider block">
            Mic Input Level Meter
          </label>
          <div className="bg-slate-950 border border-slate-850 p-2 rounded-xl flex items-center gap-3">
            <span className="text-[10px] font-mono font-bold text-slate-400 tracking-tight shrink-0 min-w-[42px] text-right">
              {micActive && metrics.rmsDb > -90 ? `${Math.round(metrics.rmsDb)} dB` : '-INF dB'}
            </span>
            <div className="flex-1 h-3 bg-slate-900 rounded-full overflow-hidden relative border border-slate-850">
              <div
                className={`h-full rounded-full transition-all duration-75 ${
                  rmsPercentage > 85
                    ? 'bg-gradient-to-r from-emerald-500 via-amber-400 to-rose-500'
                    : rmsPercentage > 60
                    ? 'bg-gradient-to-r from-emerald-500 to-amber-400'
                    : 'bg-emerald-500'
                }`}
                style={{ width: micActive ? `${rmsPercentage}%` : '0%' }}
              />
            </div>
          </div>
        </div>
      </div>

      {/* Error alert wrapper */}
      {micError && (
        <div className="mt-3.5 p-3 rounded-xl bg-rose-500/10 border border-rose-500/20 text-rose-300 flex items-center gap-2 text-xs">
          <AlertCircle className="w-4 h-4 text-rose-400 shrink-0" />
          <span className="font-semibold">{micError}</span>
        </div>
      )}

      {/* Mic Status and tips footer */}
      <div className="mt-4 pt-3.5 border-t border-slate-800/50 flex flex-col sm:flex-row items-center justify-between gap-2 text-[11px] text-slate-400">
        <div className="flex items-center gap-1.5 flex-wrap">
          <span className="font-semibold text-slate-300">Active device config:</span>
          <span>{activeDevice ? activeDevice.label : 'None Selected'}</span>
          <span>&bull;</span>
          <span className="text-slate-400">
            {isBluetoothActive ? 'Bluetooth Latency compensated' : 'Direct acoustic path'}
          </span>
        </div>
        {!micActive && (
          <button
            onClick={() => enableMicrophone()}
            className="text-xs text-rose-400 hover:text-rose-300 font-bold underline transition-all bg-transparent border-none cursor-pointer"
          >
            Start Mic Streaming &rarr;
          </button>
        )}
      </div>
    </div>
  );
};
