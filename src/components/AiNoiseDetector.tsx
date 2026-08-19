import React, { useState, useEffect, useRef, useCallback } from 'react';
import { Sparkles, Mic, MicOff, RefreshCw, Volume2, History, AlertCircle, Cpu, Zap, Radio, CheckCircle2 } from 'lucide-react';
import { AudioEngineState, AudioMetrics, AiNoiseDetectionResult } from '../types';

interface AiNoiseDetectorProps {
  engineState: AudioEngineState;
  metrics: AudioMetrics;
  enableMicrophone: () => void;
  onDetectResult?: (result: AiNoiseDetectionResult) => void;
}

export const AiNoiseDetector: React.FC<AiNoiseDetectorProps> = ({
  engineState,
  metrics,
  enableMicrophone,
  onDetectResult,
}) => {
  const [isRecording, setIsRecording] = useState(false);
  const [isAnalyzing, setIsAnalyzing] = useState(false);
  const [autoMode, setAutoMode] = useState(false);
  const [latestResult, setLatestResult] = useState<AiNoiseDetectionResult | null>(null);
  const [history, setHistory] = useState<AiNoiseDetectionResult[]>([]);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);
  const [recordProgress, setRecordProgress] = useState(0);

  const mediaRecorderRef = useRef<MediaRecorder | null>(null);
  const audioChunksRef = useRef<Blob[]>([]);
  const autoIntervalRef = useRef<NodeJS.Timeout | null>(null);
  const recordingTimerRef = useRef<NodeJS.Timeout | null>(null);
  const isBusyRef = useRef(false);

  const metricsRef = useRef(metrics);
  metricsRef.current = metrics;

  // Helper to map sound category/title to an appropriate icon or emoji
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
    if (s.includes('music') || s.includes('song') || s.includes('instrument') || s.includes('piano') || s.includes('guitar')) return '🎵';
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
          // Remove Data URL prefix (e.g. data:audio/webm;base64,)
          const base64 = reader.result.split(',')[1];
          resolve(base64);
        } else {
          reject(new Error('Failed to convert blob to base64 string'));
        }
      };
      reader.onerror = reject;
      reader.readAsDataURL(blob);
    });
  };

  // Capture a 2.5-second live mic audio snippet and classify via Gemini AI
  const captureAndClassify = useCallback(async () => {
    if (isBusyRef.current) return;
    isBusyRef.current = true;
    setErrorMsg(null);

    try {
      // Obtain user media stream
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
      audioChunksRef.current = [];

      let mimeType = 'audio/webm';
      if (MediaRecorder.isTypeSupported('audio/webm;codecs=opus')) {
        mimeType = 'audio/webm;codecs=opus';
      } else if (MediaRecorder.isTypeSupported('audio/mp4')) {
        mimeType = 'audio/mp4';
      } else if (MediaRecorder.isTypeSupported('audio/ogg')) {
        mimeType = 'audio/ogg';
      }

      const mediaRecorder = new MediaRecorder(stream, { mimeType });
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

      // Stop recording after duration
      await new Promise((resolve) => setTimeout(resolve, recordDurationMs));

      if (mediaRecorder.state !== 'inactive') {
        mediaRecorder.stop();
      }

      // Stop stream tracks so mic icon isn't locked if not needed
      stream.getTracks().forEach((track) => track.stop());

      setIsRecording(false);
      setIsAnalyzing(true);

      const audioBlob = new Blob(audioChunksRef.current, { type: mimeType });
      const base64Audio = await blobToBase64(audioBlob);

      // Send to server API endpoint
      const response = await fetch('/api/classify-audio', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          audioBase64: base64Audio,
          mimeType,
          spectralMetrics: {
            peakHz: metricsRef.current.peakFrequencyHz,
            rmsDb: metricsRef.current.rmsDb,
            bass: metricsRef.current.bass,
            treble: metricsRef.current.treble,
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
        setHistory((prev) => [result, ...prev.slice(0, 7)]);
        if (onDetectResult) {
          onDetectResult(result);
        }
      } else {
        throw new Error('Invalid detection payload format from server');
      }
    } catch (err: any) {
      console.error('Error guessing mic noise:', err);
      setErrorMsg(err.message || 'Could not analyze microphone sound');
    } finally {
      setIsRecording(false);
      setIsAnalyzing(false);
      isBusyRef.current = false;
    }
  }, [onDetectResult]);

  // Handle Auto Mode polling loop
  useEffect(() => {
    if (autoMode && engineState.sourceType === 'mic') {
      // Run once immediately, then poll every 6 seconds
      captureAndClassify();
      autoIntervalRef.current = setInterval(() => {
        captureAndClassify();
      }, 6500);
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
  }, [autoMode, engineState.sourceType, captureAndClassify]);

  return (
    <div className="bg-slate-900/90 border border-slate-800/80 rounded-2xl p-5 shadow-xl backdrop-blur-md flex flex-col gap-4">
      {/* Header */}
      <div className="flex items-center justify-between border-b border-slate-800 pb-3">
        <div className="flex items-center gap-2.5">
          <div className="p-2 rounded-xl bg-gradient-to-tr from-cyan-500/20 to-purple-500/20 border border-cyan-500/30 text-cyan-300">
            <Cpu className="w-5 h-5" />
          </div>
          <div>
            <h3 className="text-sm font-semibold text-white tracking-wide flex items-center gap-2">
              AI Live Noise Detector
              <span className="px-2 py-0.5 rounded-full text-[10px] font-bold bg-cyan-500/20 border border-cyan-500/40 text-cyan-300">
                Gemini 3.6 Flash
              </span>
            </h3>
            <p className="text-xs text-slate-400">
              Live microphone audio classification & sound guessing
            </p>
          </div>
        </div>

        {/* Auto Guessing Toggle */}
        <button
          onClick={() => {
            if (engineState.sourceType !== 'mic') {
              enableMicrophone();
            }
            setAutoMode(!autoMode);
          }}
          id="btn-toggle-auto-noise-ai"
          className={`px-3 py-1.5 rounded-xl text-xs font-semibold border flex items-center gap-1.5 transition-all cursor-pointer ${
            autoMode
              ? 'bg-cyan-500/20 border-cyan-500 text-cyan-300 shadow-md shadow-cyan-500/10'
              : 'bg-slate-950 border-slate-800 text-slate-400 hover:text-white hover:border-slate-700'
          }`}
        >
          <Radio className={`w-3.5 h-3.5 ${autoMode ? 'animate-pulse text-cyan-400' : ''}`} />
          {autoMode ? 'Auto-Guessing: ON' : 'Auto-Guessing: OFF'}
        </button>
      </div>

      {/* Mic Inactive State Prompt */}
      {engineState.sourceType !== 'mic' && (
        <div className="bg-slate-950/80 border border-slate-800/70 rounded-xl p-4 text-center flex flex-col items-center gap-3">
          <div className="p-3 rounded-full bg-cyan-500/10 border border-cyan-500/20 text-cyan-400">
            <Mic className="w-6 h-6" />
          </div>
          <div>
            <h4 className="text-sm font-medium text-slate-200">Microphone Input Needed</h4>
            <p className="text-xs text-slate-400 max-w-md mt-0.5">
              Switch to live microphone input so the Gemini AI engine can listen to and identify noises in your room (clapping, typing, whistling, speech, background fan, etc.).
            </p>
          </div>
          <button
            onClick={enableMicrophone}
            id="btn-enable-mic-for-ai"
            className="px-4 py-2 rounded-xl text-xs font-bold bg-gradient-to-r from-cyan-500 to-blue-600 hover:from-cyan-400 hover:to-blue-500 text-white shadow-lg shadow-cyan-500/20 flex items-center gap-2 cursor-pointer transition-all"
          >
            <Mic className="w-4 h-4" />
            Enable Microphone Input
          </button>
        </div>
      )}

      {/* Mic Active Controls & Live Trigger */}
      {engineState.sourceType === 'mic' && (
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
                  <Mic className="w-4 h-4 animate-spin" />
                  Listening to Live Mic... ({recordProgress}%)
                </>
              ) : isAnalyzing ? (
                <>
                  <Sparkles className="w-4 h-4 animate-spin text-purple-300" />
                  Analyzing Acoustic Fingerprint...
                </>
              ) : (
                <>
                  <Sparkles className="w-4 h-4 text-cyan-200" />
                  Guess Live Noise Now
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
                className="bg-gradient-to-r from-cyan-500 to-rose-500 h-full transition-all duration-75"
                style={{ width: `${recordProgress}%` }}
              />
            </div>
          )}

          {/* Error Banner */}
          {errorMsg && (
            <div className="bg-rose-500/10 border border-rose-500/30 rounded-xl p-3 flex items-start gap-2.5 text-xs text-rose-300">
              <AlertCircle className="w-4 h-4 text-rose-400 shrink-0 mt-0.5" />
              <div>
                <span className="font-semibold">Detection Error: </span>
                {errorMsg}
              </div>
            </div>
          )}

          {/* Active Guessed Noise Display Card */}
          {latestResult && (
            <div className="bg-gradient-to-br from-slate-950 via-slate-900 to-slate-950 border border-cyan-500/30 rounded-xl p-4 shadow-inner flex flex-col gap-3">
              <div className="flex items-start justify-between gap-3 border-b border-slate-800/80 pb-3">
                <div className="flex items-center gap-3">
                  <span className="text-3xl p-2 bg-slate-900 border border-slate-800 rounded-xl shadow-sm">
                    {getSoundEmoji(latestResult.primarySound, latestResult.category)}
                  </span>
                  <div>
                    <div className="text-xs font-medium text-slate-400 flex items-center gap-1.5">
                      Primary AI Guess
                      <span className="text-[10px] px-2 py-0.5 rounded-full bg-slate-800 border border-slate-700 text-slate-300 font-semibold">
                        {latestResult.category}
                      </span>
                    </div>
                    <h4 className="text-lg font-bold text-white capitalize tracking-wide mt-0.5">
                      {latestResult.primarySound}
                    </h4>
                  </div>
                </div>

                {/* Confidence Badge */}
                <div className="text-right shrink-0">
                  <div className="text-xs font-semibold text-cyan-400">
                    {latestResult.confidence}% Match
                  </div>
                  <div className="w-20 bg-slate-950 rounded-full h-2 border border-slate-800 mt-1 overflow-hidden">
                    <div
                      className="bg-gradient-to-r from-cyan-500 to-purple-500 h-full rounded-full"
                      style={{ width: `${Math.min(100, latestResult.confidence)}%` }}
                    />
                  </div>
                </div>
              </div>

              {/* Description & Characteristics */}
              <p className="text-xs text-slate-300 leading-relaxed font-normal">
                {latestResult.description}
              </p>

              {latestResult.acousticCharacteristics && (
                <div className="text-[11px] text-slate-400 bg-slate-900/80 border border-slate-800/80 rounded-lg p-2.5 flex items-start gap-2">
                  <Zap className="w-3.5 h-3.5 text-cyan-400 shrink-0 mt-0.5" />
                  <div>
                    <span className="text-slate-300 font-semibold">Acoustic Signature: </span>
                    {latestResult.acousticCharacteristics}
                  </div>
                </div>
              )}

              {/* Psychoacoustic Metric Ratings */}
              {latestResult.psychoacoustics && (
                <div className="bg-slate-950/90 border border-slate-800/90 rounded-xl p-3 flex flex-col gap-2">
                  <div className="flex items-center justify-between text-[11px] font-semibold text-slate-300 border-b border-slate-800 pb-1.5">
                    <span>Psychoacoustic Profile</span>
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
                      <div className="w-full bg-slate-900 h-1.5 rounded-full overflow-hidden">
                        <div className="bg-cyan-400 h-full" style={{ width: `${latestResult.psychoacoustics.sharpnessScore}%` }} />
                      </div>
                    </div>

                    <div>
                      <div className="flex justify-between text-slate-400 mb-0.5">
                        <span>Brightness</span>
                        <span className="text-slate-200 font-mono">{latestResult.psychoacoustics.brightnessScore}%</span>
                      </div>
                      <div className="w-full bg-slate-900 h-1.5 rounded-full overflow-hidden">
                        <div className="bg-amber-400 h-full" style={{ width: `${latestResult.psychoacoustics.brightnessScore}%` }} />
                      </div>
                    </div>

                    <div>
                      <div className="flex justify-between text-slate-400 mb-0.5">
                        <span>Warmth</span>
                        <span className="text-slate-200 font-mono">{latestResult.psychoacoustics.warmthScore}%</span>
                      </div>
                      <div className="w-full bg-slate-900 h-1.5 rounded-full overflow-hidden">
                        <div className="bg-purple-400 h-full" style={{ width: `${latestResult.psychoacoustics.warmthScore}%` }} />
                      </div>
                    </div>

                    <div>
                      <div className="flex justify-between text-slate-400 mb-0.5">
                        <span>Harshness</span>
                        <span className="text-slate-200 font-mono">{latestResult.psychoacoustics.harshnessScore}%</span>
                      </div>
                      <div className="w-full bg-slate-900 h-1.5 rounded-full overflow-hidden">
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
                    Recommended Acoustic Fixes:
                  </div>
                  <ul className="list-disc list-inside space-y-1 text-slate-300 pl-1 text-[11px]">
                    <li><strong className="text-slate-200">EQ Filtering:</strong> {latestResult.recommendedFixes.eqAction}</li>
                    <li><strong className="text-slate-200">Room Treatment:</strong> {latestResult.recommendedFixes.roomTreatment}</li>
                    <li><strong className="text-slate-200">Hardware / Gate:</strong> {latestResult.recommendedFixes.hardwareFix}</li>
                  </ul>
                </div>
              )}

              {/* Secondary Candidate Guesses */}
              {latestResult.top2OtherNoises && latestResult.top2OtherNoises.length > 0 && (
                <div className="flex items-center gap-2 text-xs text-slate-400 pt-1">
                  <span className="font-medium text-slate-500">Other possibilities:</span>
                  <div className="flex flex-wrap gap-1.5">
                    {latestResult.top2OtherNoises.map((noise, idx) => (
                      <span
                        key={idx}
                        className="px-2 py-0.5 rounded-md bg-slate-900 border border-slate-800 text-slate-300 text-[11px]"
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
          <div className="bg-slate-950/60 border border-slate-800/60 rounded-xl p-3">
            <div className="text-[11px] font-medium text-slate-400 mb-2 flex items-center justify-between">
              <span>Try making these noises into your mic:</span>
              <span className="text-cyan-400 font-semibold text-[10px]">Live Audio AI</span>
            </div>
            <div className="flex flex-wrap gap-1.5">
              {[
                { label: '👏 Clap Hands', hint: 'Clap 2-3 times' },
                { label: '⌨️ Type Keyboard', hint: 'Tap keys rapidly' },
                { label: '😗 Whistle', hint: 'Whistle a pitch' },
                { label: '🗣️ Speak / Talk', hint: 'Say a short sentence' },
                { label: '🫰 Snap Fingers', hint: 'Snap 2 times' },
                { label: '🌬️ Blow / Fan', hint: 'Blow into mic soft' },
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
                  title={`Test tip: ${item.hint}`}
                >
                  {item.label}
                </button>
              ))}
            </div>
          </div>

          {/* Sound History Log */}
          {history.length > 1 && (
            <div className="border-t border-slate-800/80 pt-3">
              <div className="flex items-center gap-1.5 text-xs font-semibold text-slate-400 mb-2">
                <History className="w-3.5 h-3.5 text-cyan-400" />
                Recent Guessed Noises
              </div>
              <div className="flex flex-col gap-1.5 max-h-36 overflow-y-auto pr-1">
                {history.slice(1).map((item, index) => (
                  <div
                    key={index}
                    className="flex items-center justify-between p-2 rounded-lg bg-slate-950/80 border border-slate-800/60 text-xs"
                  >
                    <div className="flex items-center gap-2">
                      <span className="text-base">
                        {getSoundEmoji(item.primarySound, item.category)}
                      </span>
                      <span className="font-semibold text-slate-200 capitalize">
                        {item.primarySound}
                      </span>
                      <span className="text-[10px] text-slate-500 bg-slate-900 px-1.5 py-0.5 rounded">
                        {item.category}
                      </span>
                    </div>
                    <div className="flex items-center gap-2">
                      <span className="text-[11px] font-medium text-cyan-400">
                        {item.confidence}%
                      </span>
                      <span className="text-[10px] text-slate-500">{item.timestamp}</span>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          )}
        </div>
      )}
    </div>
  );
};
