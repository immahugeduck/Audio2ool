import React, { useState, useRef, useEffect } from 'react';
import { 
  Disc, 
  Square, 
  Pause, 
  Play, 
  Download, 
  Trash2, 
  Sliders, 
  Sparkles, 
  FileAudio, 
  Check, 
  Clock, 
  AlertCircle,
  Bookmark,
  Flag
} from 'lucide-react';
import { AudioRecordingTake, RecordingFormat, RecordingSource, WavCueMarker } from '../types';
import { encodeWav, normalizePcmSamples } from '../utils/wavEncoder';

interface StudioRecorderProps {
  getMasterStream: () => MediaStream | null;
  getMicStream: () => MediaStream | null;
  getAudioContext: () => AudioContext | null;
  enableMicrophone: () => Promise<boolean>;
  loadAudioFile: (file: File) => Promise<boolean>;
}

export const StudioRecorder: React.FC<StudioRecorderProps> = ({
  getMasterStream,
  getMicStream,
  getAudioContext,
  enableMicrophone,
  loadAudioFile,
}) => {
  // Recorder configuration (Defaults to 32-bit IEEE Float WAV)
  const [sourceType, setSourceType] = useState<RecordingSource>('master');
  const [format, setFormat] = useState<RecordingFormat>('wav-32f');
  const [preAmpDb, setPreAmpDb] = useState<number>(0); // -12dB to +18dB
  const [noiseGateEnabled, setNoiseGateEnabled] = useState<boolean>(false);
  const [gateThresholdDb] = useState<number>(-48); // -60dB to -24dB
  const [preRollEnabled, setPreRollEnabled] = useState<boolean>(false);
  const [autoCueTransients, setAutoCueTransients] = useState<boolean>(true);

  // Recording transport states
  const [isRecording, setIsRecording] = useState<boolean>(false);
  const [isPaused, setIsPaused] = useState<boolean>(false);
  const [preRollCountdown, setPreRollCountdown] = useState<number | null>(null);
  const [recordingSeconds, setRecordingSeconds] = useState<number>(0);
  const [estimatedSizeMb, setEstimatedSizeMb] = useState<number>(0);
  const [peakDb, setPeakDb] = useState<number>(-90);
  const [isClipped, setIsClipped] = useState<boolean>(false);
  const [gateIsOpen, setGateIsOpen] = useState<boolean>(true);
  const [liveCueCount, setLiveCueCount] = useState<number>(0);

  // Takes session collection
  const [takes, setTakes] = useState<AudioRecordingTake[]>([]);
  const [activeAuditionTakeId, setActiveAuditionTakeId] = useState<string | null>(null);
  const [auditionPlaying, setAuditionPlaying] = useState<boolean>(false);
  const [auditionProgress, setAuditionProgress] = useState<number>(0);
  const [statusMessage, setStatusMessage] = useState<string | null>(null);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);

  // Recording Node & Stream Refs
  const mediaRecorderRef = useRef<MediaRecorder | null>(null);
  const recordedChunksRef = useRef<Blob[]>([]);
  const pcmBuffersRef = useRef<{ left: Float32Array[]; right: Float32Array[] }>({ left: [], right: [] });
  const scriptProcessorRef = useRef<ScriptProcessorNode | null>(null);
  const recAudioCtxRef = useRef<AudioContext | null>(null);
  const recAnalyserRef = useRef<AnalyserNode | null>(null);
  const liveCanvasRef = useRef<HTMLCanvasElement | null>(null);
  const preAmpGainRef = useRef<GainNode | null>(null);
  const gateGainRef = useRef<GainNode | null>(null);
  const timerIntervalRef = useRef<number | null>(null);
  const animFrameRef = useRef<number | null>(null);
  const auditionAudioRef = useRef<HTMLAudioElement | null>(null);
  const takePeakDbRef = useRef<number>(-90);

  // Live Transient & User Cue Marker Tracking Refs
  const liveCuesRef = useRef<WavCueMarker[]>([]);
  const totalSamplesCapturedRef = useRef<number>(0);
  const rollingRmsDbRef = useRef<number>(-65);
  const lastCueTimestampRef = useRef<number>(0);

  // Set temporary status toast
  const showStatus = (msg: string) => {
    setErrorMessage(null);
    setStatusMessage(msg);
    setTimeout(() => setStatusMessage(null), 3500);
  };

  const showError = (msg: string) => {
    setErrorMessage(msg);
    setTimeout(() => setErrorMessage(null), 4500);
  };

  // Play pre-roll audio click beep
  const playBeep = (freq: number, duration: number) => {
    try {
      const ctx = getAudioContext() || new (window.AudioContext || (window as unknown as { webkitAudioContext: typeof AudioContext }).webkitAudioContext)();
      const osc = ctx.createOscillator();
      const gain = ctx.createGain();
      osc.type = 'sine';
      osc.frequency.value = freq;
      gain.gain.setValueAtTime(0.3, ctx.currentTime);
      gain.gain.exponentialRampToValueAtTime(0.001, ctx.currentTime + duration);
      osc.connect(gain);
      gain.connect(ctx.destination);
      osc.start();
      osc.stop(ctx.currentTime + duration);
    } catch {}
  };

  // Manually drop a cue marker during active recording
  const handleDropManualCue = () => {
    if (!isRecording) return;
    const sampleRate = recAudioCtxRef.current?.sampleRate || 44100;
    const sampleOffset = totalSamplesCapturedRef.current || Math.floor(recordingSeconds * sampleRate);
    const timeSec = sampleOffset / sampleRate;
    const nextId = liveCuesRef.current.length + 1;

    const newCue: WavCueMarker = {
      id: nextId,
      sampleOffset,
      timeSeconds: Number(timeSec.toFixed(2)),
      label: `User Flag #${nextId} (${peakDb} dBFS)`,
      peakDb,
    };

    liveCuesRef.current.push(newCue);
    setLiveCueCount(liveCuesRef.current.length);
    showStatus(`Cue Marker #${nextId} embedded at ${timeSec.toFixed(2)}s`);
  };

  // Build audio pipeline and start capture
  const initiateCapture = async () => {
    let rawStream: MediaStream | null = null;

    if (sourceType === 'master') {
      rawStream = getMasterStream();
      if (!rawStream) {
        await enableMicrophone();
        rawStream = getMicStream();
      }
    } else {
      await enableMicrophone();
      rawStream = getMicStream();
    }

    if (!rawStream || rawStream.getAudioTracks().length === 0) {
      showError('Could not acquire audio stream. Check microphone permissions or start audio playback first.');
      return;
    }

    // Set up dedicated AudioContext for recording DSP
    const AudioCtx = window.AudioContext || (window as unknown as { webkitAudioContext: typeof AudioContext }).webkitAudioContext;
    const recCtx = new AudioCtx();
    recAudioCtxRef.current = recCtx;

    const sourceNode = recCtx.createMediaStreamSource(rawStream);
    const preAmpGain = recCtx.createGain();
    const linearPreAmp = Math.pow(10, preAmpDb / 20);
    preAmpGain.gain.setValueAtTime(linearPreAmp, recCtx.currentTime);
    preAmpGainRef.current = preAmpGain;

    const gateGain = recCtx.createGain();
    gateGain.gain.setValueAtTime(1.0, recCtx.currentTime);
    gateGainRef.current = gateGain;

    const analyser = recCtx.createAnalyser();
    analyser.fftSize = 512;
    analyser.smoothingTimeConstant = 0.25;
    recAnalyserRef.current = analyser;

    sourceNode.connect(preAmpGain);
    preAmpGain.connect(gateGain);
    gateGain.connect(analyser);

    // Reset capture buffers & telemetry
    recordedChunksRef.current = [];
    pcmBuffersRef.current = { left: [], right: [] };
    liveCuesRef.current = [];
    totalSamplesCapturedRef.current = 0;
    rollingRmsDbRef.current = -60;
    lastCueTimestampRef.current = performance.now();
    takePeakDbRef.current = -90;
    setLiveCueCount(0);
    setIsClipped(false);
    setRecordingSeconds(0);
    setEstimatedSizeMb(0);

    const isWavFormat = format === 'wav-32f' || format === 'wav';

    if (isWavFormat) {
      // Lossless Float32/PCM capture using ScriptProcessorNode
      const bufferSize = 4096;
      const scriptNode = recCtx.createScriptProcessor(bufferSize, 2, 2);
      scriptProcessorRef.current = scriptNode;

      scriptNode.onaudioprocess = (e) => {
        if (isPaused) return;
        const left = e.inputBuffer.getChannelData(0);
        const right = e.inputBuffer.numberOfChannels > 1 ? e.inputBuffer.getChannelData(1) : left;

        // Copy channel data
        pcmBuffersRef.current.left.push(new Float32Array(left));
        pcmBuffersRef.current.right.push(new Float32Array(right));
        totalSamplesCapturedRef.current += left.length;
      };

      gateGain.connect(scriptNode);
      scriptNode.connect(recCtx.destination);
    } else {
      // Compressed WebM Opus recording
      const streamDest = recCtx.createMediaStreamDestination();
      gateGain.connect(streamDest);

      const bitrate = format === 'webm-320' ? 320000 : 128000;
      let mimeType = 'audio/webm;codecs=opus';
      if (!MediaRecorder.isTypeSupported(mimeType)) {
        mimeType = 'audio/webm';
      }

      const recorder = new MediaRecorder(streamDest.stream, {
        mimeType,
        audioBitsPerSecond: bitrate,
      });

      recorder.ondataavailable = (e) => {
        if (e.data && e.data.size > 0) {
          recordedChunksRef.current.push(e.data);
        }
      };

      recorder.start(250);
      mediaRecorderRef.current = recorder;
    }

    setIsRecording(true);
    setIsPaused(false);

    // Timer Interval
    const startTimestamp = performance.now();
    timerIntervalRef.current = window.setInterval(() => {
      const elapsed = (performance.now() - startTimestamp) / 1000;
      setRecordingSeconds(elapsed);

      // Estimate file size
      if (format === 'wav-32f') {
        // 44.1kHz * 2 channels * 4 bytes/sample (32-bit float) = 352.8 KB/sec
        const bytes = elapsed * 44100 * 2 * 4;
        setEstimatedSizeMb(parseFloat((bytes / (1024 * 1024)).toFixed(2)));
      } else if (format === 'wav') {
        // 44.1kHz * 2 channels * 2 bytes/sample (16-bit PCM) = 176.4 KB/sec
        const bytes = elapsed * 44100 * 2 * 2;
        setEstimatedSizeMb(parseFloat((bytes / (1024 * 1024)).toFixed(2)));
      } else {
        const bps = format === 'webm-320' ? 320000 : 128000;
        const bytes = (elapsed * bps) / 8;
        setEstimatedSizeMb(parseFloat((bytes / (1024 * 1024)).toFixed(2)));
      }
    }, 100);

    // Start Real-time VU, Transient Cue Detector & Oscilloscope Canvas loop
    startLiveVisualizerLoop();
  };

  // Start with optional Pre-Roll Countdown
  const handleStartRecording = async () => {
    if (preRollEnabled) {
      setPreRollCountdown(3);
      playBeep(440, 0.1);

      setTimeout(() => {
        setPreRollCountdown(2);
        playBeep(440, 0.1);
      }, 1000);

      setTimeout(() => {
        setPreRollCountdown(1);
        playBeep(440, 0.1);
      }, 2000);

      setTimeout(async () => {
        setPreRollCountdown(null);
        playBeep(880, 0.2);
        await initiateCapture();
      }, 3000);
    } else {
      await initiateCapture();
    }
  };

  // Pause / Resume recording
  const handleTogglePause = () => {
    if (!isRecording) return;
    if (isPaused) {
      if (mediaRecorderRef.current && mediaRecorderRef.current.state === 'paused') {
        mediaRecorderRef.current.resume();
      }
      setIsPaused(false);
    } else {
      if (mediaRecorderRef.current && mediaRecorderRef.current.state === 'recording') {
        mediaRecorderRef.current.pause();
      }
      setIsPaused(true);
    }
  };

  // Stop recording and create new Take with embedded RIFF cue markers
  const handleStopRecording = async () => {
    if (!isRecording) return;

    if (timerIntervalRef.current) {
      clearInterval(timerIntervalRef.current);
      timerIntervalRef.current = null;
    }
    if (animFrameRef.current) {
      cancelAnimationFrame(animFrameRef.current);
      animFrameRef.current = null;
    }

    let finalBlob: Blob;
    let finalDuration = recordingSeconds;
    const isWavFormat = format === 'wav-32f' || format === 'wav';
    const bitsPerSample: 16 | 32 = format === 'wav-32f' ? 32 : 16;
    const sampleRate = recAudioCtxRef.current?.sampleRate || 44100;
    const capturedCues = [...liveCuesRef.current];

    if (isWavFormat) {
      if (scriptProcessorRef.current) {
        scriptProcessorRef.current.disconnect();
        scriptProcessorRef.current = null;
      }

      const leftBuffers = pcmBuffersRef.current.left;
      const rightBuffers = pcmBuffersRef.current.right;

      // Flatten PCM arrays
      const totalLength = leftBuffers.reduce((acc, curr) => acc + curr.length, 0);
      const flatLeft = new Float32Array(totalLength);
      const flatRight = new Float32Array(totalLength);

      let offset = 0;
      for (let i = 0; i < leftBuffers.length; i++) {
        flatLeft.set(leftBuffers[i], offset);
        flatRight.set(rightBuffers[i], offset);
        offset += leftBuffers[i].length;
      }

      finalBlob = encodeWav([flatLeft, flatRight], sampleRate, bitsPerSample, capturedCues);
      finalDuration = totalLength > 0 ? totalLength / sampleRate : recordingSeconds;
    } else {
      if (mediaRecorderRef.current) {
        mediaRecorderRef.current.stop();
        await new Promise((resolve) => setTimeout(resolve, 300));
      }
      finalBlob = new Blob(recordedChunksRef.current, {
        type: format === 'webm-320' ? 'audio/webm;codecs=opus' : 'audio/webm',
      });
    }

    // Clean up recording AudioContext
    if (recAudioCtxRef.current) {
      recAudioCtxRef.current.close().catch(() => {});
      recAudioCtxRef.current = null;
    }

    const takeNumber = takes.length + 1;
    const ext = isWavFormat ? 'wav' : 'webm';
    const formatBadge = format === 'wav-32f' ? '32bit_Float_WAV' : format === 'wav' ? '16bit_PCM_WAV' : 'Opus';
    const filename = `Studio_Take_${takeNumber}_${formatBadge}.${ext}`;
    const audioUrl = URL.createObjectURL(finalBlob);

    const newTakeFile = new File([finalBlob], filename, { type: finalBlob.type });

    const newTake: AudioRecordingTake = {
      id: `take-${Date.now()}`,
      title: `Studio Take #${takeNumber} (${format === 'wav-32f' ? '32-BIT FLOAT WAV' : format === 'wav' ? '16-BIT PCM WAV' : format.toUpperCase()})`,
      timestamp: Date.now(),
      durationSeconds: finalDuration,
      durationSec: finalDuration,
      format,
      bitsPerSample: isWavFormat ? bitsPerSample : undefined,
      source: sourceType,
      sampleRate,
      sizeBytes: finalBlob.size,
      blob: finalBlob,
      url: audioUrl,
      audioUrl,
      file: newTakeFile,
      peakDb: takePeakDbRef.current,
      isClipped,
      cueMarkers: capturedCues,
    };

    setTakes((prev) => [newTake, ...prev]);
    setIsRecording(false);
    setIsPaused(false);
    showStatus(
      `Saved "${newTake.title}" (${(finalBlob.size / (1024 * 1024)).toFixed(2)} MB${
        capturedCues.length > 0 ? ` • ${capturedCues.length} Embedded RIFF Cue Markers` : ''
      })`
    );
  };

  // Live Visualizer (32-bit Float Time-Domain Peak, Transient Auto-Cue & Oscilloscope)
  const startLiveVisualizerLoop = () => {
    const canvas = liveCanvasRef.current;
    if (!canvas || !recAnalyserRef.current) return;

    const analyser = recAnalyserRef.current;
    const floatTimeData = new Float32Array(analyser.fftSize);

    const draw = () => {
      analyser.getFloatTimeDomainData(floatTimeData);

      // Compute true unclipped peak & RMS in dBFS
      let maxAbs = 0;
      let sumSquares = 0;
      for (let i = 0; i < floatTimeData.length; i++) {
        const s = floatTimeData[i];
        const abs = Math.abs(s);
        if (abs > maxAbs) maxAbs = abs;
        sumSquares += s * s;
      }

      const rmsLinear = Math.sqrt(sumSquares / floatTimeData.length);
      const currentRmsDb = rmsLinear > 0.00001 ? 20 * Math.log10(rmsLinear) : -95;
      const currentPeak = maxAbs > 0.00001 ? 20 * Math.log10(maxAbs) : -95;
      const roundedPeak = Math.round(currentPeak * 10) / 10;

      setPeakDb(Math.round(currentPeak));

      if (roundedPeak > takePeakDbRef.current) {
        takePeakDbRef.current = roundedPeak;
      }

      if (currentPeak >= -0.1) {
        setIsClipped(true);
      }

      // Automatic Transient Cue Marker Detection (strict impulse crest + 12 dB jump over rolling baseline)
      const now = performance.now();
      const crestDb = currentPeak - currentRmsDb;
      const deltaOverRolling = currentPeak - rollingRmsDbRef.current;

      if (
        autoCueTransients &&
        currentPeak > -32 &&
        deltaOverRolling >= 12 &&
        crestDb >= 8 &&
        now - lastCueTimestampRef.current > 900 &&
        liveCuesRef.current.length < 64
      ) {
        lastCueTimestampRef.current = now;
        const sr = recAudioCtxRef.current?.sampleRate || 44100;
        const sampleOffset = totalSamplesCapturedRef.current;
        const timeSec = sampleOffset / sr;
        const nextId = liveCuesRef.current.length + 1;

        liveCuesRef.current.push({
          id: nextId,
          sampleOffset,
          timeSeconds: Number(timeSec.toFixed(2)),
          label: `Transient Peak #${nextId} (${roundedPeak} dBFS)`,
          peakDb: roundedPeak,
        });
        setLiveCueCount(liveCuesRef.current.length);
      }

      // Smooth rolling RMS baseline
      rollingRmsDbRef.current = rollingRmsDbRef.current * 0.93 + currentRmsDb * 0.07;

      // Noise Gate logic
      if (noiseGateEnabled && gateGainRef.current && recAudioCtxRef.current) {
        if (currentPeak < gateThresholdDb) {
          gateGainRef.current.gain.setTargetAtTime(0.001, recAudioCtxRef.current.currentTime, 0.05);
          setGateIsOpen(false);
        } else {
          gateGainRef.current.gain.setTargetAtTime(1.0, recAudioCtxRef.current.currentTime, 0.02);
          setGateIsOpen(true);
        }
      }

      // Draw Oscilloscope to canvas
      const ctx = canvas.getContext('2d');
      if (ctx) {
        const width = canvas.width;
        const height = canvas.height;

        ctx.fillStyle = '#090d16';
        ctx.fillRect(0, 0, width, height);

        // Center zero line
        ctx.strokeStyle = '#1e293b';
        ctx.lineWidth = 1;
        ctx.beginPath();
        ctx.moveTo(0, height / 2);
        ctx.lineTo(width, height / 2);
        ctx.stroke();

        // Waveform
        ctx.lineWidth = 2;
        ctx.strokeStyle = isClipped ? '#ef4444' : '#06b6d4';
        ctx.shadowBlur = 8;
        ctx.shadowColor = isClipped ? 'rgba(239,68,68,0.5)' : 'rgba(6,182,212,0.5)';

        ctx.beginPath();
        const sliceWidth = width / floatTimeData.length;
        let x = 0;

        for (let i = 0; i < floatTimeData.length; i++) {
          const sample = Math.max(-1.0, Math.min(1.0, floatTimeData[i]));
          const y = height / 2 - sample * (height * 0.44);
          if (i === 0) {
            ctx.moveTo(x, y);
          } else {
            ctx.lineTo(x, y);
          }
          x += sliceWidth;
        }

        ctx.lineTo(width, height / 2);
        ctx.stroke();
        ctx.shadowBlur = 0;
      }

      animFrameRef.current = requestAnimationFrame(draw);
    };

    animFrameRef.current = requestAnimationFrame(draw);
  };

  // Update Pre-Amp Gain live
  useEffect(() => {
    if (preAmpGainRef.current && recAudioCtxRef.current) {
      const linear = Math.pow(10, preAmpDb / 20);
      preAmpGainRef.current.gain.setTargetAtTime(linear, recAudioCtxRef.current.currentTime, 0.05);
    }
  }, [preAmpDb]);

  // Audition player handlers
  const handlePlayTake = (take: AudioRecordingTake, seekTimeSec?: number) => {
    if (activeAuditionTakeId === take.id && auditionPlaying && seekTimeSec === undefined) {
      auditionAudioRef.current?.pause();
      setAuditionPlaying(false);
    } else {
      if (auditionAudioRef.current) {
        if (auditionAudioRef.current.src !== take.audioUrl) {
          auditionAudioRef.current.src = take.audioUrl;
        }
        if (seekTimeSec !== undefined) {
          auditionAudioRef.current.currentTime = seekTimeSec;
        }
        auditionAudioRef.current.play().catch(() => {});
        setActiveAuditionTakeId(take.id);
        setAuditionPlaying(true);
      }
    }
  };

  // Normalize Take Peak to -0.1 dBFS while preserving bit depth & embedded cue markers
  const handleNormalizeTake = async (take: AudioRecordingTake) => {
    try {
      showStatus(`Normalizing "${take.title}" to -0.1 dBFS...`);
      const AudioCtx = window.AudioContext || (window as unknown as { webkitAudioContext: typeof AudioContext }).webkitAudioContext;
      const ctx = new AudioCtx();
      const arrayBuf = await take.file.arrayBuffer();
      const decoded = await ctx.decodeAudioData(arrayBuf);

      const channelData: Float32Array[] = [];
      for (let ch = 0; ch < decoded.numberOfChannels; ch++) {
        channelData.push(decoded.getChannelData(ch));
      }

      const { normalizedData, gainAppliedDb } = normalizePcmSamples(channelData, -0.1);
      const bits: 16 | 32 = take.bitsPerSample || 32;
      const normalizedBlob = encodeWav(normalizedData, decoded.sampleRate, bits, take.cueMarkers);
      const newUrl = URL.createObjectURL(normalizedBlob);
      const newFile = new File([normalizedBlob], `Normalized_${take.file.name}`, { type: 'audio/wav' });

      setTakes((prev) =>
        prev.map((t) =>
          t.id === take.id
            ? {
                ...t,
                blob: normalizedBlob,
                url: newUrl,
                audioUrl: newUrl,
                file: newFile,
                sizeBytes: normalizedBlob.size,
                peakDb: -0.1,
                isClipped: false,
                isNormalized: true,
                title: `${t.title.replace(/ \[Normalized.*\]/, '')} [Normalized +${gainAppliedDb.toFixed(1)}dB]`,
              }
            : t
        )
      );
      ctx.close();
      showStatus(`Take normalized (+${gainAppliedDb.toFixed(1)} dB boost applied, ${bits}-bit WAV)`);
    } catch {
      showError('Could not normalize audio file in this browser.');
    }
  };

  // Delete take
  const handleDeleteTake = (id: string) => {
    setTakes((prev) => prev.filter((t) => t.id !== id));
    if (activeAuditionTakeId === id) {
      auditionAudioRef.current?.pause();
      setActiveAuditionTakeId(null);
      setAuditionPlaying(false);
    }
  };

  // Format seconds to mm:ss.ms
  const formatTime = (secs: number) => {
    const mins = Math.floor(secs / 60);
    const remainderSecs = Math.floor(secs % 60);
    const ms = Math.floor((secs % 1) * 100);
    return `${mins.toString().padStart(2, '0')}:${remainderSecs.toString().padStart(2, '0')}.${ms.toString().padStart(2, '0')}`;
  };

  return (
    <div className="bg-slate-900/90 rounded-2xl border border-slate-800 p-4 sm:p-6 shadow-xl flex flex-col gap-6">
      {/* Hidden Audio Element for Audition Player */}
      <audio
        ref={auditionAudioRef}
        onEnded={() => {
          setAuditionPlaying(false);
          setAuditionProgress(0);
        }}
        onTimeUpdate={() => {
          if (auditionAudioRef.current && auditionAudioRef.current.duration) {
            setAuditionProgress(
              (auditionAudioRef.current.currentTime / auditionAudioRef.current.duration) * 100
            );
          }
        }}
      />

      {/* Header */}
      <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4 pb-4 border-b border-slate-800">
        <div className="flex items-center gap-3">
          <div className="p-2.5 bg-gradient-to-br from-rose-500/20 to-red-600/20 rounded-xl border border-rose-500/40 text-rose-300 shadow-[0_0_15px_rgba(244,63,94,0.2)]">
            <Disc className={`w-5 h-5 ${isRecording ? 'animate-spin text-rose-400' : ''}`} />
          </div>
          <div>
            <div className="flex items-center gap-2 flex-wrap">
              <h2 className="text-base sm:text-lg font-bold text-white tracking-tight">
                STUDIO AUDIO RECORDER & TAKES VAULT
              </h2>
              <span className="text-[10px] font-mono px-2 py-0.5 rounded-full bg-rose-500/20 text-rose-300 border border-rose-500/40">
                32-BIT FLOAT WAV / RIFF CUE MARKERS
              </span>
            </div>
            <p className="text-xs text-slate-400">
              IEEE 32-Bit Floating-Point WAV Export, Embedded Transient Cue Markers & Instant Spectra Lab Re-Analysis
            </p>
          </div>
        </div>

        {/* Status / Error Toast */}
        {statusMessage && (
          <div className="flex items-center gap-2 px-3 py-1.5 rounded-lg bg-emerald-500/20 border border-emerald-500/40 text-emerald-300 text-xs font-mono animate-fadeIn">
            <Check className="w-3.5 h-3.5" />
            <span>{statusMessage}</span>
          </div>
        )}
        {errorMessage && (
          <div className="flex items-center gap-2 px-3 py-1.5 rounded-lg bg-rose-500/20 border border-rose-500/40 text-rose-300 text-xs font-mono animate-fadeIn">
            <AlertCircle className="w-3.5 h-3.5" />
            <span>{errorMessage}</span>
          </div>
        )}
      </div>

      {/* Recorder Control Console */}
      <div className="bg-slate-950 rounded-xl p-4 sm:p-5 border border-slate-800 flex flex-col gap-4">
        {/* Source, Format & Pre-Amp Config */}
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3 pb-3 border-b border-slate-800/80">
          {/* 1. Source */}
          <div className="flex flex-col gap-1.5">
            <label className="text-xs font-semibold text-slate-300">Recording Source:</label>
            <div className="flex items-center gap-1 bg-slate-900 p-1 rounded-lg border border-slate-800">
              <button
                onClick={() => setSourceType('master')}
                disabled={isRecording}
                id="btn-source-master"
                className={`flex-1 py-1 px-2 rounded text-xs font-medium transition-colors cursor-pointer ${
                  sourceType === 'master' ? 'bg-cyan-500 text-slate-950 font-bold' : 'text-slate-400 hover:text-white'
                }`}
              >
                Master Mix
              </button>
              <button
                onClick={() => setSourceType('mic')}
                disabled={isRecording}
                id="btn-source-mic"
                className={`flex-1 py-1 px-2 rounded text-xs font-medium transition-colors cursor-pointer ${
                  sourceType === 'mic' ? 'bg-cyan-500 text-slate-950 font-bold' : 'text-slate-400 hover:text-white'
                }`}
              >
                Direct Mic
              </button>
            </div>
          </div>

          {/* 2. Format */}
          <div className="flex flex-col gap-1.5">
            <label className="text-xs font-semibold text-slate-300">Capture Format & Bit Depth:</label>
            <select
              value={format}
              onChange={(e) => setFormat(e.target.value as RecordingFormat)}
              disabled={isRecording}
              id="select-recording-format"
              className="w-full bg-slate-900 border border-slate-800 rounded-lg px-2.5 py-1.5 text-xs font-mono text-cyan-300 focus:outline-none focus:border-cyan-400 cursor-pointer"
            >
              <option value="wav-32f">Lossless WAV (32-Bit IEEE Float + Cues)</option>
              <option value="wav">Lossless WAV (16-Bit PCM Linear + Cues)</option>
              <option value="webm-320">WebM Opus (Broadcast 320 kbps)</option>
              <option value="webm-128">WebM Opus (Compact 128 kbps)</option>
            </select>
          </div>

          {/* 3. Input Pre-Amp Gain */}
          <div className="flex flex-col gap-1.5">
            <div className="flex items-center justify-between text-xs">
              <label className="font-semibold text-slate-300">Pre-Amp Gain:</label>
              <span className="font-mono text-cyan-300 font-bold">
                {preAmpDb >= 0 ? `+${preAmpDb}` : preAmpDb} dB
              </span>
            </div>
            <input
              type="range"
              min="-12"
              max="18"
              step="1"
              value={preAmpDb}
              onChange={(e) => setPreAmpDb(parseInt(e.target.value, 10))}
              id="slider-preamp-gain"
              className="w-full accent-cyan-400 h-1.5 bg-slate-800 rounded-lg cursor-pointer"
            />
          </div>

          {/* 4. Pre-Roll, Auto-Cue & Noise Gate Toggles */}
          <div className="flex flex-col justify-between gap-1.5">
            <div className="flex items-center justify-between gap-2">
              <label className="text-[11px] text-slate-300 flex items-center gap-1 cursor-pointer" title="Automatically embed RIFF cue markers whenever a sharp acoustic transient spike occurs">
                <input
                  type="checkbox"
                  checked={autoCueTransients}
                  onChange={(e) => setAutoCueTransients(e.target.checked)}
                  id="checkbox-auto-cue"
                  className="rounded accent-amber-400"
                />
                <span>Auto-Cue Transients</span>
              </label>

              <label className="text-[11px] text-slate-400 flex items-center gap-1 cursor-pointer">
                <input
                  type="checkbox"
                  checked={preRollEnabled}
                  onChange={(e) => setPreRollEnabled(e.target.checked)}
                  disabled={isRecording}
                  id="checkbox-preroll"
                  className="rounded accent-rose-500"
                />
                <span>3s Count-in</span>
              </label>
            </div>

            <div className="flex items-center justify-between bg-slate-900 p-1.5 rounded-lg border border-slate-800">
              <label className="text-[11px] text-slate-300 flex items-center gap-1.5 cursor-pointer">
                <input
                  type="checkbox"
                  checked={noiseGateEnabled}
                  onChange={(e) => setNoiseGateEnabled(e.target.checked)}
                  id="checkbox-noise-gate"
                  className="rounded accent-emerald-400"
                />
                <span>Noise Gate</span>
              </label>

              {noiseGateEnabled && (
                <div className="flex items-center gap-1.5 text-[10px] font-mono">
                  <span className={`w-2 h-2 rounded-full ${gateIsOpen ? 'bg-emerald-400' : 'bg-slate-600'}`} />
                  <span className={gateIsOpen ? 'text-emerald-400' : 'text-slate-500'}>
                    {gateIsOpen ? 'OPEN' : 'MUTED'}
                  </span>
                </div>
              )}
            </div>
          </div>
        </div>

        {/* Live Recording HUD Area */}
        <div className="grid grid-cols-1 lg:grid-cols-12 gap-4 items-center">
          {/* Main Transport Controls */}
          <div className="lg:col-span-4 flex items-center gap-2">
            {!isRecording ? (
              <button
                onClick={handleStartRecording}
                id="btn-start-recording"
                className="flex-1 flex items-center justify-center gap-2 px-6 py-3.5 rounded-xl bg-gradient-to-r from-rose-500 to-red-600 hover:from-rose-600 hover:to-red-700 text-white font-bold text-sm shadow-lg shadow-rose-500/25 transition-all cursor-pointer"
              >
                <Disc className="w-5 h-5 animate-pulse fill-white/20" />
                START RECORDING
              </button>
            ) : (
              <div className="flex-1 flex items-center gap-2">
                <button
                  onClick={handleStopRecording}
                  id="btn-stop-recording"
                  className="flex-1 flex items-center justify-center gap-2 px-3 py-3.5 rounded-xl bg-slate-800 hover:bg-slate-700 text-white font-bold text-xs sm:text-sm border border-slate-700 transition-all cursor-pointer"
                >
                  <Square className="w-4 h-4 fill-current text-rose-500" />
                  FINISH TAKE
                </button>

                <button
                  onClick={handleDropManualCue}
                  id="btn-drop-cue-marker"
                  className="px-3 py-3.5 rounded-xl bg-amber-500/20 hover:bg-amber-500/30 text-amber-300 font-bold text-xs border border-amber-500/40 flex items-center gap-1.5 transition-all cursor-pointer"
                  title="Embed a RIFF Cue Marker at current sample position"
                >
                  <Flag className="w-4 h-4" />
                  <span>+Cue</span>
                </button>

                <button
                  onClick={handleTogglePause}
                  id="btn-pause-recording"
                  className="px-3 py-3.5 rounded-xl bg-slate-800 hover:bg-slate-700 text-slate-300 font-bold text-sm border border-slate-700 transition-all cursor-pointer"
                  title={isPaused ? 'Resume Recording' : 'Pause Recording'}
                >
                  {isPaused ? <Play className="w-4 h-4 fill-current text-emerald-400" /> : <Pause className="w-4 h-4" />}
                </button>
              </div>
            )}
          </div>

          {/* Timer, File Size & Cue Count Readout */}
          <div className="lg:col-span-5 flex items-center justify-between gap-3 bg-slate-900/90 py-2.5 px-4 rounded-xl border border-slate-800">
            <div>
              <div className="text-[10px] font-mono text-slate-400 uppercase tracking-wider flex items-center gap-1">
                <Clock className="w-3 h-3 text-cyan-400" />
                Duration
              </div>
              <div className={`text-xl sm:text-2xl font-black font-mono tracking-tight ${isRecording ? 'text-rose-400' : 'text-white'}`}>
                {formatTime(recordingSeconds)}
              </div>
            </div>

            <div className="border-l border-slate-800 pl-3">
              <div className="text-[10px] font-mono text-slate-400 uppercase tracking-wider">
                Est. Size
              </div>
              <div className="text-sm sm:text-base font-bold font-mono text-cyan-300">
                {estimatedSizeMb.toFixed(2)} MB
              </div>
            </div>

            <div className="border-l border-slate-800 pl-3">
              <div className="text-[10px] font-mono text-slate-400 uppercase tracking-wider">
                Peak dB
              </div>
              <div className={`text-sm sm:text-base font-bold font-mono ${isClipped ? 'text-rose-500' : 'text-emerald-400'}`}>
                {peakDb} dB
              </div>
            </div>

            <div className="border-l border-slate-800 pl-3">
              <div className="text-[10px] font-mono text-slate-400 uppercase tracking-wider flex items-center gap-1">
                <Bookmark className="w-3 h-3 text-amber-400" />
                Cues
              </div>
              <div className="text-sm sm:text-base font-bold font-mono text-amber-300">
                {liveCueCount}
              </div>
            </div>
          </div>

          {/* Live Waveform Canvas & Clip Warning */}
          <div className="lg:col-span-3 relative rounded-xl overflow-hidden border border-slate-800 h-16 bg-slate-900 flex items-center">
            {preRollCountdown !== null ? (
              <div className="absolute inset-0 bg-rose-950/80 backdrop-blur-sm flex items-center justify-center z-20">
                <span className="text-3xl font-black font-mono text-rose-300 animate-ping">
                  {preRollCountdown}
                </span>
              </div>
            ) : null}

            <canvas
              ref={liveCanvasRef}
              width={320}
              height={64}
              className="w-full h-full object-cover"
            />

            {/* Overload Clip LED */}
            {isClipped && (
              <div className="absolute top-2 right-2 px-1.5 py-0.5 rounded bg-rose-500 text-slate-950 text-[9px] font-black font-mono tracking-wider shadow-md animate-pulse">
                {format === 'wav-32f' ? '0dBFS+ (FLOAT SAFE)' : 'CLIP'}
              </div>
            )}
          </div>
        </div>
      </div>

      {/* Recorded Takes Session Vault */}
      <div className="flex flex-col gap-3">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            <h3 className="text-xs sm:text-sm font-bold text-white uppercase tracking-wider">
              Recorded Session Takes ({takes.length})
            </h3>
            <span className="text-[11px] text-slate-400 font-mono">Embedded RIFF cue markers & instant Spectra Lab import</span>
          </div>

          {takes.length > 0 && (
            <button
              onClick={() => setTakes([])}
              id="btn-clear-takes"
              className="text-[11px] text-slate-500 hover:text-rose-400 transition-colors cursor-pointer"
            >
              Clear Session Takes
            </button>
          )}
        </div>

        {takes.length > 0 ? (
          <div className="flex flex-col gap-2.5">
            {takes.map((take) => {
              const isPlayingThis = activeAuditionTakeId === take.id && auditionPlaying;

              return (
                <div
                  key={take.id}
                  className="bg-slate-950 p-3.5 rounded-xl border border-slate-800/80 hover:border-slate-700 flex flex-col gap-3 transition-all"
                >
                  <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3">
                    {/* Left: Play button, title, info */}
                    <div className="flex items-center gap-3 flex-1 min-w-0">
                      <button
                        onClick={() => handlePlayTake(take)}
                        id={`btn-audition-${take.id}`}
                        className={`p-2.5 rounded-xl cursor-pointer transition-colors ${
                          isPlayingThis
                            ? 'bg-rose-500 text-white shadow-lg shadow-rose-500/30'
                            : 'bg-slate-900 hover:bg-slate-800 text-cyan-400 border border-slate-800'
                        }`}
                        title={isPlayingThis ? 'Pause Preview' : 'Audition Take'}
                      >
                        {isPlayingThis ? <Pause className="w-4 h-4" /> : <Play className="w-4 h-4 fill-current" />}
                      </button>

                      <div className="flex flex-col min-w-0 flex-1">
                        <div className="flex items-center gap-2 flex-wrap">
                          <span className="text-xs font-bold text-white truncate">{take.title}</span>
                          <span className="text-[10px] font-mono px-1.5 py-0.2 rounded bg-slate-900 border border-slate-800 text-cyan-300 uppercase">
                            {take.bitsPerSample === 32 ? '32-BIT FLOAT WAV' : take.bitsPerSample === 16 ? '16-BIT PCM WAV' : take.format}
                          </span>
                          {take.cueMarkers && take.cueMarkers.length > 0 && (
                            <span className="text-[10px] font-mono px-1.5 py-0.2 rounded bg-amber-500/15 text-amber-300 border border-amber-500/30 flex items-center gap-1">
                              <Flag className="w-2.5 h-2.5" />
                              {take.cueMarkers.length} RIFF Cues
                            </span>
                          )}
                          {take.isClipped && (
                            <span className="text-[10px] font-mono px-1 py-0.2 rounded bg-rose-500/20 text-rose-300 border border-rose-500/40">
                              {take.bitsPerSample === 32 ? 'Over 0dBFS (Float Preserved)' : 'Clipped'}
                            </span>
                          )}
                        </div>

                        <div className="flex items-center gap-3 text-[11px] font-mono text-slate-400 mt-0.5 flex-wrap">
                          <span>Duration: {formatTime(take.durationSec)}</span>
                          <span>•</span>
                          <span>Size: {(take.sizeBytes / (1024 * 1024)).toFixed(2)} MB</span>
                          <span>•</span>
                          <span>Peak: {take.peakDb} dBFS</span>
                          <span>•</span>
                          <span>{take.sampleRate} Hz</span>
                        </div>

                        {/* Audition progress scrubber if active */}
                        {activeAuditionTakeId === take.id && (
                          <div className="w-full h-1 bg-slate-800 rounded-full mt-2 overflow-hidden">
                            <div
                              className="h-full bg-cyan-400 transition-all duration-75"
                              style={{ width: `${auditionProgress}%` }}
                            />
                          </div>
                        )}
                      </div>
                    </div>

                    {/* Right: Actions */}
                    <div className="flex items-center gap-2 self-end sm:self-auto flex-wrap">
                      {/* Send directly to Visualizer / Spectra Lab */}
                      <button
                        onClick={async () => {
                          showStatus(`Loading "${take.title}" into Spectra Lab...`);
                          await loadAudioFile(take.file);
                          showStatus(`"${take.title}" loaded into active engine!`);
                        }}
                        id={`btn-load-spectra-${take.id}`}
                        className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-cyan-950/80 hover:bg-cyan-900 text-cyan-300 border border-cyan-500/40 text-xs font-bold transition-all cursor-pointer shadow-sm"
                        title="Load this take into the Audio Spectrum Analyzer, Spectrogram, Tuner and RT60"
                      >
                        <Sparkles className="w-3.5 h-3.5" />
                        Analyze in Spectra Lab
                      </button>

                      {/* Normalize Peak button */}
                      <button
                        onClick={() => handleNormalizeTake(take)}
                        id={`btn-normalize-${take.id}`}
                        className="flex items-center gap-1 px-2.5 py-1.5 rounded-lg bg-slate-900 hover:bg-slate-800 text-slate-300 border border-slate-800 text-xs font-mono transition-colors cursor-pointer"
                        title="Normalize audio peak to -0.1 dBFS while preserving embedded RIFF cue markers"
                      >
                        <Sliders className="w-3.5 h-3.5 text-amber-400" />
                        Normalize
                      </button>

                      {/* Download File */}
                      <a
                        href={take.audioUrl}
                        download={take.file.name}
                        id={`link-download-${take.id}`}
                        className="p-1.5 rounded-lg bg-slate-900 hover:bg-slate-800 text-slate-300 hover:text-white border border-slate-800 transition-colors cursor-pointer"
                        title="Download WAV/WebM with Embedded RIFF Cue Markers"
                      >
                        <Download className="w-4 h-4" />
                      </a>

                      {/* Delete */}
                      <button
                        onClick={() => handleDeleteTake(take.id)}
                        id={`btn-delete-${take.id}`}
                        className="p-1.5 rounded-lg bg-slate-900 hover:bg-rose-950 text-slate-400 hover:text-rose-400 border border-slate-800 transition-colors cursor-pointer"
                        title="Delete Take"
                      >
                        <Trash2 className="w-4 h-4" />
                      </button>
                    </div>
                  </div>

                  {/* Embedded Cue Markers Timeline Pills */}
                  {take.cueMarkers && take.cueMarkers.length > 0 && (
                    <div className="pt-2 border-t border-slate-800/70 flex items-center gap-1.5 flex-wrap">
                      <span className="text-[10px] font-mono text-amber-400/90 uppercase tracking-wider mr-1 flex items-center gap-1">
                        <Bookmark className="w-3 h-3" />
                        Embedded WAV Cues:
                      </span>
                      {take.cueMarkers.map((cue) => (
                        <button
                          key={cue.id}
                          onClick={() => handlePlayTake(take, cue.timeSeconds)}
                          className="px-2 py-0.5 rounded bg-slate-900 hover:bg-amber-500/20 text-[10px] font-mono text-slate-300 hover:text-amber-200 border border-slate-800 hover:border-amber-500/40 transition-all cursor-pointer"
                          title={`Jump to ${cue.label} (Sample #${cue.sampleOffset})`}
                        >
                          <span className="text-amber-400 font-bold">@{cue.timeSeconds.toFixed(2)}s</span> {cue.label}
                        </button>
                      ))}
                    </div>
                  )}
                </div>
              );
            })}
          </div>
        ) : (
          <div className="bg-slate-950/60 rounded-xl p-8 border border-dashed border-slate-800 text-center flex flex-col items-center justify-center gap-2">
            <FileAudio className="w-8 h-8 text-slate-600" />
            <span className="text-xs font-medium text-slate-400">No recordings captured in this session yet</span>
            <span className="text-[11px] text-slate-600 max-w-sm">
              Click &quot;Start Recording&quot; above to capture 32-bit IEEE float WAV audio with automatic transient & manual RIFF cue markers.
            </span>
          </div>
        )}
      </div>
    </div>
  );
};
