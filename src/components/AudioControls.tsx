import React from 'react';
import { Play, Pause, Volume2, VolumeX, Mic, Music, Upload, RotateCcw, Radio, Youtube, Headphones, Smartphone, Check } from 'lucide-react';
import { AudioEngineState, AudioSourceType } from '../types';
import { SAMPLE_TRACKS } from '../utils/audioPresets';

interface AudioControlsProps {
  engineState: AudioEngineState;
  play: () => void;
  pause: () => void;
  seek: (seconds: number) => void;
  setVolume: (vol: number) => void;
  toggleMute: () => void;
  loadSampleTrack: (trackId: string) => void;
  loadAudioFile: (file: File) => void;
  enableMicrophone: (targetDeviceId?: string) => void;
  toggleMicMonitoring?: () => void;
}

export const AudioControls: React.FC<AudioControlsProps> = ({
  engineState,
  play,
  pause,
  seek,
  setVolume,
  toggleMute,
  loadSampleTrack,
  loadAudioFile,
  enableMicrophone,
  toggleMicMonitoring,
}) => {
  const formatTime = (seconds: number) => {
    if (!isFinite(seconds) || seconds < 0) return '00:00';
    const mins = Math.floor(seconds / 60);
    const secs = Math.floor(seconds % 60);
    return `${mins.toString().padStart(2, '0')}:${secs.toString().padStart(2, '0')}`;
  };

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    if (e.target.files && e.target.files[0]) {
      loadAudioFile(e.target.files[0]);
    }
  };

  return (
    <div className="bg-slate-900/90 rounded-2xl border border-slate-800 p-4 sm:p-5 shadow-xl flex flex-col gap-4">
      {/* Top Source Switcher Tabs */}
      <div className="flex flex-wrap items-center justify-between gap-3 pb-3 border-b border-slate-800">
        <div className="flex items-center gap-1.5 bg-slate-950 p-1 rounded-xl border border-slate-800">
          <button
            onClick={() => loadSampleTrack(engineState.activeSampleId)}
            id="tab-source-sample"
            className={`flex items-center gap-2 px-3 py-1.5 rounded-lg text-xs font-medium transition-all cursor-pointer ${
              engineState.sourceType === 'sample'
                ? 'bg-cyan-500 text-slate-950 font-semibold shadow-md'
                : 'text-slate-400 hover:text-white hover:bg-slate-800'
            }`}
          >
            <Music className="w-3.5 h-3.5" />
            Presets
          </button>

          <label
            id="tab-source-file"
            className={`flex items-center gap-2 px-3 py-1.5 rounded-lg text-xs font-medium transition-all cursor-pointer ${
              engineState.sourceType === 'file'
                ? 'bg-cyan-500 text-slate-950 font-semibold shadow-md'
                : 'text-slate-400 hover:text-white hover:bg-slate-800'
            }`}
          >
            <Upload className="w-3.5 h-3.5" />
            Audio File
            <input
              type="file"
              accept="audio/*"
              onChange={handleFileChange}
              className="hidden"
            />
          </label>

          <button
            onClick={() => enableMicrophone()}
            id="tab-source-mic"
            className={`flex items-center gap-2 px-3 py-1.5 rounded-lg text-xs font-medium transition-all cursor-pointer ${
              engineState.sourceType === 'mic'
                ? 'bg-rose-500 text-white font-semibold shadow-md'
                : 'text-slate-400 hover:text-white hover:bg-slate-800'
            }`}
          >
            <Mic className="w-3.5 h-3.5" />
            Mic Input
          </button>
        </div>

        {/* Microphone Source Selection (Phone Mic vs Bluetooth) */}
        {engineState.sourceType === 'mic' && (
          <div className="flex items-center gap-2 flex-wrap">
            {/* Quick Switcher Buttons */}
            <div className="flex items-center gap-1 bg-slate-950 p-1 rounded-xl border border-slate-800">
              {/* Phone Mic Button */}
              <button
                onClick={() => {
                  const phoneDevice = engineState.audioInputDevices.find((d) => d.isPhoneMic);
                  enableMicrophone(phoneDevice?.deviceId);
                }}
                id="btn-select-phone-mic"
                className={`flex items-center gap-1.5 px-2.5 py-1 rounded-lg text-xs font-medium transition-all cursor-pointer ${
                  !engineState.audioInputDevices.find((d) => d.deviceId === engineState.selectedDeviceId)?.isBluetooth
                    ? 'bg-emerald-500/20 text-emerald-300 border border-emerald-500/40 font-bold'
                    : 'text-slate-400 hover:text-slate-200'
                }`}
                title="Phone Mic (Built-in) is recommended for superior sensitivity & acoustic measurement accuracy"
              >
                <Smartphone className="w-3.5 h-3.5 text-emerald-400" />
                <span>Phone Mic (Default)</span>
              </button>

              {/* Bluetooth Button */}
              <button
                onClick={() => {
                  const btDevice = engineState.audioInputDevices.find((d) => d.isBluetooth);
                  if (btDevice) {
                    enableMicrophone(btDevice.deviceId);
                  } else {
                    enableMicrophone(); // Refresh and attempt
                  }
                }}
                id="btn-select-bluetooth-mic"
                className={`flex items-center gap-1.5 px-2.5 py-1 rounded-lg text-xs font-medium transition-all cursor-pointer ${
                  engineState.audioInputDevices.find((d) => d.deviceId === engineState.selectedDeviceId)?.isBluetooth
                    ? 'bg-cyan-500/20 text-cyan-300 border border-cyan-500/40 font-bold'
                    : engineState.isBluetoothConnected
                    ? 'text-cyan-400 hover:bg-slate-800'
                    : 'text-slate-500 hover:text-slate-400'
                }`}
                title={
                  engineState.isBluetoothConnected
                    ? `Bluetooth device detected: ${engineState.bluetoothDeviceName}`
                    : 'Connect Bluetooth headphones or headset to switch input'
                }
              >
                <Headphones className={`w-3.5 h-3.5 ${engineState.isBluetoothConnected ? 'text-cyan-400' : 'text-slate-500'}`} />
                <span>
                  Bluetooth
                  {engineState.isBluetoothConnected && (
                    <span className="ml-1 text-[9px] bg-cyan-500/30 text-cyan-300 px-1 rounded-full uppercase font-bold">Connected</span>
                  )}
                </span>
              </button>
            </div>

            {/* Dropdown for All Detected Hardware Devices */}
            {engineState.audioInputDevices.length > 1 && (
              <select
                value={engineState.selectedDeviceId || ''}
                onChange={(e) => enableMicrophone(e.target.value)}
                id="select-audio-input-device"
                className="bg-slate-950 border border-slate-800 text-xs text-slate-200 rounded-lg px-2.5 py-1.5 focus:outline-none focus:border-rose-500 cursor-pointer max-w-[180px] truncate"
              >
                {engineState.audioInputDevices.map((dev) => (
                  <option key={dev.deviceId} value={dev.deviceId}>
                    {dev.label}
                  </option>
                ))}
              </select>
            )}
          </div>
        )}

        {/* Sample Selection Dropdown */}
        {engineState.sourceType === 'sample' && (
          <div className="flex items-center gap-2">
            <span className="text-xs text-slate-400">Track:</span>
            <select
              value={engineState.activeSampleId}
              onChange={(e) => loadSampleTrack(e.target.value)}
              id="select-sample-track"
              className="bg-slate-950 border border-slate-800 text-xs text-slate-200 rounded-lg px-2.5 py-1.5 focus:outline-none focus:border-cyan-500 cursor-pointer"
            >
              {SAMPLE_TRACKS.map((track) => (
                <option key={track.id} value={track.id}>
                  {track.title} ({track.genre})
                </option>
              ))}
            </select>
          </div>
        )}

        {/* Audio File Name Indicator */}
        {engineState.sourceType === 'file' && (
          <div className="text-xs text-cyan-400 font-medium truncate max-w-[200px]">
            📁 {engineState.fileName || 'Uploaded Audio'}
          </div>
        )}

        {/* URL Stream Indicator */}
        {engineState.sourceType === 'url' && (
          <div className="text-xs text-red-400 font-medium truncate max-w-[260px] flex items-center gap-1.5 bg-red-500/10 px-2.5 py-1 rounded-lg border border-red-500/30">
            <Youtube className="w-3.5 h-3.5 shrink-0 text-red-500" />
            <span className="truncate">URL: {engineState.fileName || 'Live Audio Stream'}</span>
          </div>
        )}

        {/* Mic Speaker Output Toggle */}
        {engineState.sourceType === 'mic' && toggleMicMonitoring && (
          <button
            onClick={toggleMicMonitoring}
            id="btn-toggle-mic-monitoring"
            className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-medium border transition-all cursor-pointer ${
              engineState.micMonitoring
                ? 'bg-amber-500/20 border-amber-500 text-amber-300 font-semibold shadow-sm'
                : 'bg-emerald-500/10 border-emerald-500/40 text-emerald-300 hover:border-emerald-500'
            }`}
            title={engineState.micMonitoring ? 'Speaker Output Enabled (Caution: may cause acoustic feedback)' : 'Analyze Only (Speaker Output Muted to Prevent Feedback)'}
          >
            <Radio className="w-3.5 h-3.5" />
            {engineState.micMonitoring ? 'Speaker Replay: ON' : 'Speaker Replay: OFF (Analyze Only)'}
          </button>
        )}

        {/* Mic Error Banner */}
        {engineState.micError && (
          <div className="text-xs text-rose-400 font-medium">
            ⚠️ {engineState.micError}
          </div>
        )}
      </div>

      {/* Main Playback Bar */}
      <div className="flex flex-col sm:flex-row items-center gap-4">
        {/* Play/Pause Main Button */}
        <button
          onClick={engineState.isPlaying ? pause : play}
          id="btn-play-pause"
          className={`p-3.5 rounded-2xl flex items-center justify-center transition-all cursor-pointer shadow-lg active:scale-95 ${
            engineState.isPlaying
              ? 'bg-amber-500 hover:bg-amber-400 text-slate-950'
              : 'bg-cyan-500 hover:bg-cyan-400 text-slate-950'
          }`}
        >
          {engineState.isPlaying ? <Pause className="w-5 h-5 fill-current" /> : <Play className="w-5 h-5 fill-current ml-0.5" />}
        </button>

        {/* Timeline Seekbar */}
        <div className="flex-1 w-full flex items-center gap-3">
          <span className="text-xs font-mono text-slate-400 min-w-[42px]">
            {formatTime(engineState.currentTime)}
          </span>

          <input
            type="range"
            min={0}
            max={engineState.duration || 100}
            step={0.1}
            value={engineState.currentTime}
            disabled={engineState.sourceType === 'mic'}
            onChange={(e) => seek(parseFloat(e.target.value))}
            id="input-seek-bar"
            className="w-full h-2 bg-slate-950 rounded-lg appearance-none cursor-pointer accent-cyan-400 disabled:opacity-40"
          />

          <span className="text-xs font-mono text-slate-400 min-w-[42px]">
            {engineState.sourceType === 'mic' ? 'LIVE' : formatTime(engineState.duration)}
          </span>
        </div>

        {/* Volume & Mute */}
        <div className="flex items-center gap-2 min-w-[140px]">
          <button
            onClick={toggleMute}
            id="btn-toggle-mute"
            className="p-2 text-slate-400 hover:text-white transition-colors cursor-pointer"
          >
            {engineState.isMuted || engineState.volume === 0 ? (
              <VolumeX className="w-4 h-4 text-rose-400" />
            ) : (
              <Volume2 className="w-4 h-4 text-cyan-400" />
            )}
          </button>
          <input
            type="range"
            min={0}
            max={1}
            step={0.01}
            value={engineState.isMuted ? 0 : engineState.volume}
            onChange={(e) => setVolume(parseFloat(e.target.value))}
            id="input-volume-slider"
            className="w-20 h-1.5 bg-slate-950 rounded-lg appearance-none cursor-pointer accent-cyan-400"
          />
        </div>
      </div>
    </div>
  );
};
