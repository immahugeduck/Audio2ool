import React, { useState, useEffect, useRef, useCallback } from 'react';
import {
  Sparkles,
  Mic,
  RefreshCw,
  History,
  AlertCircle,
  Cpu,
  Zap,
  Radio,
  CheckCircle2,
  Volume2,
  Sliders,
  ShieldCheck,
  Activity,
} from 'lucide-react';
import { AudioEngineState, AudioMetrics, AiNoiseDetectionResult, NoiseBaselineProfile } from '../types';

interface AiNoiseDetectorProps {
  engineState: AudioEngineState;
  metrics: AudioMetrics;
  profile?: NoiseBaselineProfile;
  enableMicrophone: () => void;
  getMicStream?: () => MediaStream | null;
  getMasterStream?: () => MediaStream | null;
  onDetectResult?: (result: AiNoiseDetectionResult) => void;
}

export const AiNoiseDetector: React.FC<AiNoiseDetectorProps> = ({
  engineState,
  metrics,
  profile,
  enableMicrophone,
  getMicStream,
  getMasterStream,
  onDetectResult,
}) => {
  const [isRecording, setIsRecording] = useState(false);
  const [isAnalyzing, setIsAnalyzing] = useState(false);
  const [autoMode, setAutoMode] = useState(false);
  const [captureSource, setCaptureSource] = useState<'mic' | 'master'>('mic');
  const [latestResult, setLatestResult] = useState<AiNoiseDetectionResult | null>(null);
  const [history, setHistory] = useState<AiNoiseDetectionResult[]>([]);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);
  const [recordProgress, setRecordProgress] = useState(0);

  const mediaRecorderRef = useRef<MediaRecorder | null>(null);
  const audioChunksRef = useRef<Blob[]>([]);
  const autoIntervalRef = useRef<NodeJS.Timeout | null>(null);
  const isBusyRef = useRef(false);

  const metricsRef = useRef(metrics);
  metricsRef.current = metrics;

  const profileRef = useRef(profile);
  profileRef.current = profile;

  // Auto-switch to master if mic is not active and master is playing
  useEffect(() => {
    if (!engineState.micActive && engineState.isPlaying && captureSource === 'mic') {
      setCaptureSource('master');
    }
  }, [engineState.micActive, engineState.isPlaying]);

  // Helper to map sound category/title to an appropriate emoji icon
  const getSoundEmoji = (soundName: string, category: string): string => {
    const s = soundName.toLowerCase();
    const c = category.toLowerCase();

    if (s.includes('clap') || s.includes('applaus')) return '👏';
    if (s.includes('type') || s.includes('keyb') || s.includes('click')) return '⌨️';
    if (s.includes('whistl')) return '😗';
    if (s.includes('snap')) return '🫰';
    if (s.includes('speech') || s.includes('talk') || s.includes('voic') || s.includes('convers')) return '🗣️';
    if (s.includes('sing') || s.includes('hum')) return '🎙️';
    if (s.includes('laugh') || s.includes('giggle')) return '😄';
    if (s.includes('cough') || s.includes('sneeze')) return '🤧';
    if (s.includes('fan') || s.includes('hvac') || s.includes('wind') || s.includes('blow')) return '🌬️';
    if (s.includes('music') || s.includes('song') || s.includes('instrument') || s.includes('piano') || s.includes('guitar') || s.includes('synth')) return '🎵';
    if (s.includes('silenc') || s.includes('quiet') || s.includes('static') || s.includes('background')) return '🤫';
    if (s.includes('tap') || s.includes('drum') || s.includes('knock') || s.includes('percuss')) return '🥁';
    if (c.includes('human')) return '👤';
    if (c.includes('mechanical') || c.includes('ambient')) return '🔊';
    return '🎧';
  };

  // Convert Blob to Base64
  const blobToBase64 = (blob: Blob): Promise<string> => {
    return new Promise((resolve, reject) => {
      const reader = new FileReader();
      reader.onloadend = () => {
        if (typeof reader.result === 'string') {
          const base64 = reader.result.split(',')[1];
          resolve(base64);
        } else {
          reject(new Error('Failed to encode audio stream to base64'));
        }
      };
      reader.onerror = reject;
      reader.readAsDataURL(blob);
    });
  };

  // Capture a 2.2-second live audio snippet and classify via Gemini 3.8 Flash
  const captureAndClassify = useCallback(async () => {
    if (isBusyRef.current) return;
    isBusyRef.current = true;
    setErrorMsg(null);

    let activeStream: MediaStream | null = null;
    let localStreamCreated = false;

    try {
      // 1. Resolve source stream
      if (captureSource === 'master' && getMasterStream) {
        activeStream = getMasterStream();
      } else if (captureSource === 'mic' && getMicStream) {
        activeStream = getMicStream();
      }

      // If active stream not ready, attempt fallback
      if (!activeStream || activeStream.getAudioTracks().length === 0) {
        if (captureSource === 'mic') {
          try {
            activeStream = await navigator.mediaDevices.getUserMedia({ audio: true });
            localStreamCreated = true;
          } catch (micErr) {
            // If mic fails, try master output if available
            if (getMasterStream && getMasterStream()) {
              activeStream = getMasterStream();
              setCaptureSource('master');
            } else {
              throw new Error('Microphone access is unavailable. Please click "Enable Mic" or play audio first.');
            }
          }
        } else if (getMasterStream && getMasterStream()) {
          activeStream = getMasterStream();
        } else {
          throw new Error('No audio source active. Please play a track or enable microphone.');
        }
      }

      if (!activeStream || activeStream.getAudioTracks().length === 0) {
        throw new Error('No audio stream track available for recording.');
      }

      audioChunksRef.current = [];

      let mimeType = 'audio/webm';
      if (MediaRecorder.isTypeSupported('audio/webm;codecs=opus')) {
        mimeType = 'audio/webm;codecs=opus';
      } else if (MediaRecorder.isTypeSupported('audio/mp4')) {
        mimeType = 'audio/mp4';
      } else if (MediaRecorder.isTypeSupported('audio/ogg')) {
        mimeType = 'audio/ogg';
      }

      const mediaRecorder = new MediaRecorder(activeStream, { mimeType });
      mediaRecorderRef.current = mediaRecorder;

      mediaRecorder.ondataavailable = (e) => {
        if (e.data.size > 0) {
          audioChunksRef.current.push(e.data);
        }
      };

      setIsRecording(true);
      setRecordProgress(0);

      // Start recording
      mediaRecorder.start(100);

      // Animate progress over 2.2 seconds
      const startTime = Date.now();
      const recordDurationMs = 2200;

      const progressInterval = setInterval(() => {
        const elapsed = Date.now() - startTime;
        const pct = Math.min(100, Math.round((elapsed / recordDurationMs) * 100));
        setRecordProgress(pct);
        if (elapsed >= recordDurationMs) {
          clearInterval(progressInterval);
        }
      }, 50);

      await new Promise((resolve) => setTimeout(resolve, recordDurationMs));

      if (mediaRecorder.state !== 'inactive') {
        mediaRecorder.stop();
      }

      if (localStreamCreated && activeStream) {
        activeStream.getTracks().forEach((track) => track.stop());
      }

      setIsRecording(false);
      setIsAnalyzing(true);

      const audioBlob = new Blob(audioChunksRef.current, { type: mimeType });
      const base64Audio = await blobToBase64(audioBlob);

      const currentMetrics = metricsRef.current;
      const currentProfile = profileRef.current;

      // Call upgraded Gemini 3.8 Flash endpoint with full telemetry
      const response = await fetch('/api/classify-audio', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          audioBase64: base64Audio,
          mimeType,
          spectralMetrics: {
            peakHz: currentMetrics.peakFrequencyHz,
            peakNote: currentMetrics.peakNoteName,
            prominenceDb: currentMetrics.prominenceDb,
            rmsDb: currentMetrics.rmsDb,
            weighting: currentMetrics.weighting,
            crestFactorDb: currentMetrics.crestFactorDb,
            spectralCentroidHz: currentMetrics.spectralCentroidHz,
            thdPercent: currentMetrics.distortion?.thdPercent,
            subBass: currentMetrics.subBass,
            bass: currentMetrics.bass,
            mid: currentMetrics.mid,
            treble: currentMetrics.treble,
            noiseFloorDb: currentProfile?.noiseFloorDb,
            snrDb: currentProfile?.snrDb,
            transientCount: currentProfile?.transientCount,
          },
        }),
      });

      if (!response.ok) {
        const errJson = await response.json().catch(() => ({}));
        throw new Error(errJson.error || `Server responded with status ${response.status}`);
      }

      const data = await response.json();
      if (data.success && data.detection) {
        const result: AiNoiseDetectionResult = {
          ...data.detection,
          timestamp: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit', second: '2-digit' }),
        };
        setLatestResult(result);
        setHistory((prev) => [result, ...prev.slice(0, 9)]);
        if (onDetectResult) {
          onDetectResult(result);
        }
      } else {
        throw new Error('Invalid detection payload format from server');
      }
    } catch (err: unknown) {
      console.warn('AI Noise Classifier Notice:', err);
      setErrorMsg((err as Error)?.message || 'Could not analyze audio stream');
    } finally {
      setIsRecording(false);
      setIsAnalyzing(false);
      isBusyRef.current = false;
    }
  }, [captureSource, getMasterStream, getMicStream, onDetectResult]);

  // Handle Auto Mode polling loop
  useEffect(() => {
    if (autoMode) {
      captureAndClassify();
      autoIntervalRef.current = setInterval(() => {
        captureAndClassify();
      }, 7000);
    } else {
      if (autoIntervalRef.current) {
        clearInterval(autoIntervalRef.current);
        autoIntervalRef.current = null;
      }
    }

    return () => {
      if (autoIntervalRef.current) {
        clearInterval(autoIntervalRef.current);
      }
    };
  }, [autoMode, captureAndClassify]);

  const isSourceActive =
    captureSource === 'mic'
      ? engineState.micActive
      : engineState.isPlaying || (getMasterStream && getMasterStream() !== null);

  return (
    <div className="bg-slate-900 border border-slate-800 rounded-2xl p-5 shadow-xl flex flex-col gap-4">
      {/* Header */}
      <div className="flex items-center justify-between border-b border-slate-800 pb-3 flex-wrap gap-2">
        <div className="flex items-center gap-2.5">
          <div className="p-2 rounded-xl bg-gradient-to-tr from-cyan-500/20 to-purple-500/20 border border-cyan-500/30 text-cyan-300">
            <Cpu className="w-5 h-5" />
          </div>
          <div>
            <div className="flex items-center gap-2">
              <h3 className="text-sm font-bold text-white tracking-wide">
                AI Acoustic Sound Classifier
              </h3>
              <span className="px-2 py-0.5 rounded text-[10px] font-bold bg-cyan-500/20 border border-cyan-500/40 text-cyan-300">
                Gemini 3.8 Flash
              </span>
            </div>
            <p className="text-xs text-slate-400">
              Multimodal audio classification, harmonic fingerprinting &amp; psychoacoustics
            </p>
          </div>
        </div>

        {/* Source Selector & Auto Toggle */}
        <div className="flex items-center gap-2">
          {/* Source Toggle */}
          <div className="inline-flex rounded-lg bg-slate-950 p-0.5 border border-slate-800 text-xs">
            <button
              onClick={() => setCaptureSource('mic')}
              className={`px-2.5 py-1 rounded-md font-semibold transition-all cursor-pointer flex items-center gap-1.5 ${
                captureSource === 'mic'
                  ? 'bg-cyan-500/20 text-cyan-300 border border-cyan-500/40'
                  : 'text-slate-400 hover:text-slate-200'
              }`}
            >
              <Mic className="w-3 h-3" />
              <span>Mic</span>
            </button>
            <button
              onClick={() => setCaptureSource('master')}
              className={`px-2.5 py-1 rounded-md font-semibold transition-all cursor-pointer flex items-center gap-1.5 ${
                captureSource === 'master'
                  ? 'bg-cyan-500/20 text-cyan-300 border border-cyan-500/40'
                  : 'text-slate-400 hover:text-slate-200'
              }`}
            >
              <Volume2 className="w-3 h-3" />
              <span>Master Output</span>
            </button>
          </div>

          {/* Auto Guessing Toggle */}
          <button
            onClick={() => setAutoMode(!autoMode)}
            id="btn-toggle-auto-noise-ai"
            className={`px-3 py-1.5 rounded-lg text-xs font-semibold border flex items-center gap-1.5 transition-all cursor-pointer ${
              autoMode
                ? 'bg-cyan-500/20 border-cyan-500 text-cyan-300 shadow-md shadow-cyan-500/10'
                : 'bg-slate-950 border-slate-800 text-slate-400 hover:text-white hover:border-slate-700'
            }`}
          >
            <Radio className={`w-3.5 h-3.5 ${autoMode ? 'animate-pulse text-cyan-400' : ''}`} />
            <span>{autoMode ? 'Auto: ON' : 'Auto: OFF'}</span>
          </button>
        </div>
      </div>

      {/* Source Prompt if Selected Source is Inactive */}
      {!isSourceActive && captureSource === 'mic' && (
        <div className="bg-slate-950 border border-slate-800 rounded-xl p-3.5 text-xs text-slate-300 flex items-center justify-between gap-3 flex-wrap">
          <div className="flex items-center gap-2">
            <Mic className="w-4 h-4 text-cyan-400 shrink-0" />
            <span>
              Microphone is standby. Enable mic to classify ambient room noises, or switch to <strong className="text-white">Master Output</strong> to analyze synth presets/files.
            </span>
          </div>
          <div className="flex items-center gap-2">
            <button
              onClick={enableMicrophone}
              className="px-3 py-1 rounded-lg bg-cyan-500/20 hover:bg-cyan-500/30 text-cyan-300 font-bold border border-cyan-500/40 cursor-pointer transition-colors"
            >
              Enable Mic
            </button>
            <button
              onClick={() => setCaptureSource('master')}
              className="px-3 py-1 rounded-lg bg-slate-900 hover:bg-slate-800 text-slate-300 font-semibold border border-slate-700 cursor-pointer transition-colors"
            >
              Use Master Audio
            </button>
          </div>
        </div>
      )}

      {/* Main Trigger & Progress */}
      <div className="flex flex-col gap-3">
        <div className="flex items-center justify-between gap-3">
          <button
            onClick={captureAndClassify}
            disabled={isRecording || isAnalyzing}
            id="btn-guess-mic-noise-now"
            className={`flex-1 py-2.5 px-4 rounded-xl text-xs font-bold transition-all flex items-center justify-center gap-2 shadow-lg cursor-pointer ${
              isRecording
                ? 'bg-rose-500/20 border border-rose-500 text-rose-300 shadow-rose-500/10 animate-pulse'
                : isAnalyzing
                ? 'bg-purple-500/20 border border-purple-500 text-purple-300 shadow-purple-500/10'
                : 'bg-gradient-to-r from-cyan-500 via-blue-600 to-indigo-600 hover:from-cyan-400 hover:to-indigo-500 text-white shadow-cyan-500/20'
            }`}
          >
            {isRecording ? (
              <>
                <Activity className="w-4 h-4 animate-spin" />
                <span>Capturing {captureSource === 'mic' ? 'Microphone' : 'Master Audio'}... ({recordProgress}%)</span>
              </>
            ) : isAnalyzing ? (
              <>
                <Sparkles className="w-4 h-4 animate-spin text-purple-300" />
                <span>Gemini 3.8 Flash Analyzing Acoustic Signatures...</span>
              </>
            ) : (
              <>
                <Sparkles className="w-4 h-4 text-cyan-200" />
                <span>Classify {captureSource === 'mic' ? 'Live Mic Noise' : 'Master Audio Sound'} Now</span>
              </>
            )}
          </button>

          <button
            onClick={() => {
              setLatestResult(null);
              setHistory([]);
              setErrorMsg(null);
            }}
            id="btn-clear-ai-history"
            className="p-2.5 rounded-xl bg-slate-950 border border-slate-800 text-slate-400 hover:text-white hover:border-slate-700 cursor-pointer transition-all"
            title="Clear Detection Results"
          >
            <RefreshCw className="w-4 h-4" />
          </button>
        </div>

        {/* Recording Progress Bar */}
        {isRecording && (
          <div className="w-full bg-slate-950 rounded-full h-1.5 border border-slate-800 overflow-hidden">
            <div
              className="bg-gradient-to-r from-cyan-500 via-purple-500 to-rose-500 h-full transition-all duration-75"
              style={{ width: `${recordProgress}%` }}
            />
          </div>
        )}

        {/* Error Banner */}
        {errorMsg && (
          <div className="bg-rose-500/10 border border-rose-500/30 rounded-xl p-3 flex items-start gap-2.5 text-xs text-rose-300">
            <AlertCircle className="w-4 h-4 text-rose-400 shrink-0 mt-0.5" />
            <div>
              <span className="font-semibold">Classification Notice: </span>
              {errorMsg}
            </div>
          </div>
        )}

        {/* Active Guessed Noise Display Card */}
        {latestResult && (
          <div className="bg-slate-950 border border-cyan-500/30 rounded-xl p-4 shadow-inner flex flex-col gap-3">
            <div className="flex items-start justify-between gap-3 border-b border-slate-800 pb-3">
              <div className="flex items-center gap-3">
                <span className="text-3xl p-2.5 bg-slate-900 border border-slate-800 rounded-xl shadow-sm">
                  {getSoundEmoji(latestResult.primarySound, latestResult.category)}
                </span>
                <div>
                  <div className="text-xs font-medium text-slate-400 flex items-center gap-1.5">
                    <span>Acoustic Classification</span>
                    <span className="text-[10px] px-2 py-0.5 rounded bg-slate-900 border border-slate-700 text-cyan-300 font-semibold uppercase">
                      {latestResult.category}
                    </span>
                  </div>
                  <h4 className="text-lg font-bold text-white capitalize tracking-wide mt-0.5">
                    {latestResult.primarySound}
                  </h4>
                </div>
              </div>

              {/* Confidence Meter */}
              <div className="text-right shrink-0">
                <div className="text-xs font-mono font-bold text-cyan-400">
                  {latestResult.confidence}% Match
                </div>
                <div className="w-24 bg-slate-900 rounded-full h-2 border border-slate-800 mt-1 overflow-hidden">
                  <div
                    className="bg-gradient-to-r from-cyan-500 to-purple-500 h-full rounded-full transition-all duration-300"
                    style={{ width: `${Math.min(100, Math.max(5, latestResult.confidence))}%` }}
                  />
                </div>
              </div>
            </div>

            {/* Description */}
            <p className="text-xs text-slate-200 leading-relaxed font-normal">
              {latestResult.description}
            </p>

            {latestResult.acousticCharacteristics && (
              <div className="text-[11px] text-slate-300 bg-slate-900/90 border border-slate-800 rounded-lg p-2.5 flex items-start gap-2">
                <Zap className="w-3.5 h-3.5 text-cyan-400 shrink-0 mt-0.5" />
                <div>
                  <strong className="text-cyan-300">Acoustic Signature: </strong>
                  {latestResult.acousticCharacteristics}
                </div>
              </div>
            )}

            {/* Psychoacoustic Metric Ratings */}
            {latestResult.psychoacoustics && (
              <div className="bg-slate-900/70 border border-slate-800 rounded-xl p-3 flex flex-col gap-2">
                <div className="flex items-center justify-between text-[11px] font-semibold text-slate-300 border-b border-slate-800/80 pb-1.5">
                  <div className="flex items-center gap-1.5">
                    <Sliders className="w-3.5 h-3.5 text-cyan-400" />
                    <span>Psychoacoustic Profile</span>
                  </div>
                  <span className="text-cyan-400 font-mono text-[10px] px-2 py-0.5 rounded bg-cyan-500/10 border border-cyan-500/20">
                    {latestResult.psychoacoustics.soundPurity} ({latestResult.psychoacoustics.perceivedLoudnessLufs} LUFS)
                  </span>
                </div>

                <div className="grid grid-cols-2 sm:grid-cols-4 gap-2 text-[10px]">
                  <div>
                    <div className="flex justify-between text-slate-400 mb-0.5">
                      <span>Sharpness</span>
                      <span className="text-slate-200 font-mono">{latestResult.psychoacoustics.sharpnessScore}%</span>
                    </div>
                    <div className="w-full bg-slate-950 h-1.5 rounded-full overflow-hidden border border-slate-800">
                      <div className="bg-cyan-400 h-full" style={{ width: `${latestResult.psychoacoustics.sharpnessScore}%` }} />
                    </div>
                  </div>

                  <div>
                    <div className="flex justify-between text-slate-400 mb-0.5">
                      <span>Brightness</span>
                      <span className="text-slate-200 font-mono">{latestResult.psychoacoustics.brightnessScore}%</span>
                    </div>
                    <div className="w-full bg-slate-950 h-1.5 rounded-full overflow-hidden border border-slate-800">
                      <div className="bg-amber-400 h-full" style={{ width: `${latestResult.psychoacoustics.brightnessScore}%` }} />
                    </div>
                  </div>

                  <div>
                    <div className="flex justify-between text-slate-400 mb-0.5">
                      <span>Warmth</span>
                      <span className="text-slate-200 font-mono">{latestResult.psychoacoustics.warmthScore}%</span>
                    </div>
                    <div className="w-full bg-slate-950 h-1.5 rounded-full overflow-hidden border border-slate-800">
                      <div className="bg-purple-400 h-full" style={{ width: `${latestResult.psychoacoustics.warmthScore}%` }} />
                    </div>
                  </div>

                  <div>
                    <div className="flex justify-between text-slate-400 mb-0.5">
                      <span>Harshness</span>
                      <span className="text-slate-200 font-mono">{latestResult.psychoacoustics.harshnessScore}%</span>
                    </div>
                    <div className="w-full bg-slate-950 h-1.5 rounded-full overflow-hidden border border-slate-800">
                      <div className="bg-rose-400 h-full" style={{ width: `${latestResult.psychoacoustics.harshnessScore}%` }} />
                    </div>
                  </div>
                </div>
              </div>
            )}

            {/* Recommended Fixes / Acoustic Treatment */}
            {latestResult.recommendedFixes && (
              <div className="bg-cyan-500/5 border border-cyan-500/20 rounded-xl p-3 text-[11px] flex flex-col gap-1.5">
                <div className="font-semibold text-cyan-300 flex items-center gap-1.5">
                  <CheckCircle2 className="w-3.5 h-3.5 text-cyan-400" />
                  <span>Actionable Acoustic Engineering Fixes:</span>
                </div>
                <div className="grid grid-cols-1 md:grid-cols-3 gap-2 mt-1">
                  <div className="bg-slate-900/80 p-2 rounded-lg border border-slate-800">
                    <span className="text-cyan-400 font-semibold block mb-0.5">EQ Filtering:</span>
                    <span className="text-slate-300">{latestResult.recommendedFixes.eqAction}</span>
                  </div>
                  <div className="bg-slate-900/80 p-2 rounded-lg border border-slate-800">
                    <span className="text-purple-400 font-semibold block mb-0.5">Room Treatment:</span>
                    <span className="text-slate-300">{latestResult.recommendedFixes.roomTreatment}</span>
                  </div>
                  <div className="bg-slate-900/80 p-2 rounded-lg border border-slate-800">
                    <span className="text-emerald-400 font-semibold block mb-0.5">Hardware / Isolation:</span>
                    <span className="text-slate-300">{latestResult.recommendedFixes.hardwareFix}</span>
                  </div>
                </div>
              </div>
            )}

            {/* Secondary Candidate Guesses */}
            {latestResult.top2OtherNoises && latestResult.top2OtherNoises.length > 0 && (
              <div className="flex items-center gap-2 text-xs text-slate-400 pt-0.5">
                <span className="font-medium text-slate-500">Other acoustic candidates:</span>
                <div className="flex flex-wrap gap-1.5">
                  {latestResult.top2OtherNoises.map((noise, idx) => (
                    <span
                      key={idx}
                      className="px-2 py-0.5 rounded bg-slate-900 border border-slate-800 text-slate-300 text-[11px]"
                    >
                      {noise}
                    </span>
                  ))}
                </div>
              </div>
            )}
          </div>
        )}

        {/* Quick Sound Testing Prompts */}
        <div className="bg-slate-950/80 border border-slate-800/80 rounded-xl p-3">
          <div className="text-[11px] font-medium text-slate-400 mb-2 flex items-center justify-between">
            <span>Quick Sound Testing Prompts:</span>
            <span className="text-cyan-400 font-semibold text-[10px]">Gemini Acoustic Classifier</span>
          </div>
          <div className="flex flex-wrap gap-1.5">
            {[
              { label: '👏 Clapping', hint: 'Clap hands 2-3 times' },
              { label: '⌨️ Typing', hint: 'Tap keys rapidly on keyboard' },
              { label: '😗 Whistling', hint: 'Whistle a pure tone pitch' },
              { label: '🗣️ Speaking', hint: 'Say a quick sentence into mic' },
              { label: '🫰 Finger Snaps', hint: 'Snap fingers twice' },
              { label: '🌬️ HVAC / Blowing', hint: 'Gentle breath or fan hum' },
              { label: '🎵 Synth / Music', hint: 'Play melody or chords' },
            ].map((item, idx) => (
              <button
                key={idx}
                onClick={() => {
                  if (!isRecording && !isAnalyzing) {
                    captureAndClassify();
                  }
                }}
                id={`btn-test-noise-${idx}`}
                className="px-2.5 py-1 rounded-lg text-[11px] font-medium bg-slate-900 border border-slate-800 text-slate-300 hover:text-cyan-300 hover:border-cyan-500/50 transition-all cursor-pointer"
                title={`Try: ${item.hint}`}
              >
                {item.label}
              </button>
            ))}
          </div>
        </div>

        {/* Sound History Log */}
        {history.length > 1 && (
          <div className="border-t border-slate-800 pt-3">
            <div className="flex items-center gap-1.5 text-xs font-semibold text-slate-400 mb-2">
              <History className="w-3.5 h-3.5 text-cyan-400" />
              <span>Recent Classified Audio Events</span>
            </div>
            <div className="flex flex-col gap-1.5 max-h-40 overflow-y-auto pr-1">
              {history.slice(1).map((item, index) => (
                <div
                  key={index}
                  className="flex items-center justify-between p-2 rounded-lg bg-slate-950 border border-slate-800/80 text-xs"
                >
                  <div className="flex items-center gap-2">
                    <span className="text-base">{getSoundEmoji(item.primarySound, item.category)}</span>
                    <span className="font-semibold text-slate-200 capitalize">{item.primarySound}</span>
                    <span className="text-[10px] text-slate-500 bg-slate-900 px-1.5 py-0.5 rounded">
                      {item.category}
                    </span>
                  </div>
                  <div className="flex items-center gap-2">
                    <span className="text-[11px] font-mono font-semibold text-cyan-400">
                      {item.confidence}%
                    </span>
                    <span className="text-[10px] text-slate-500 font-mono">{item.timestamp}</span>
                  </div>
                </div>
              ))}
            </div>
          </div>
        )}
      </div>
    </div>
  );
};
