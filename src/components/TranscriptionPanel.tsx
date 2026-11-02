import React, { useState, useRef } from 'react';
import {
  Mic,
  Square,
  FileText,
  Loader2,
  Upload,
  CheckCircle2,
  AlertCircle,
  Copy,
  Check,
  Download,
  Trash2,
  Volume2,
} from 'lucide-react';
import { AudioEngineState } from '../types';

interface TranscriptionPanelProps {
  engineState: AudioEngineState;
  loadedFile: File | null;
  getMicStream?: () => MediaStream | null;
  getMasterStream?: () => MediaStream | null;
  enableMicrophone?: () => void;
}

export const TranscriptionPanel: React.FC<TranscriptionPanelProps> = ({
  engineState,
  loadedFile,
  getMicStream,
  getMasterStream,
  enableMicrophone,
}) => {
  const [isRecording, setIsRecording] = useState(false);
  const [isTranscribing, setIsTranscribing] = useState(false);
  const [transcription, setTranscription] = useState<string | null>(null);
  const [sourceType, setSourceType] = useState<'mic' | 'master'>('master');
  const [error, setError] = useState<string | null>(null);
  const [copied, setCopied] = useState(false);
  const [recordSeconds, setRecordSeconds] = useState(0);

  const mediaRecorderRef = useRef<MediaRecorder | null>(null);
  const audioChunksRef = useRef<Blob[]>([]);
  const timerRef = useRef<NodeJS.Timeout | null>(null);

  const startRecording = async () => {
    setError(null);
    setTranscription(null);

    let stream: MediaStream | null = null;
    let localStreamCreated = false;

    try {
      if (sourceType === 'master' && getMasterStream) {
        stream = getMasterStream();
      } else if (sourceType === 'mic' && getMicStream) {
        stream = getMicStream();
      }

      if (!stream || stream.getAudioTracks().length === 0) {
        if (sourceType === 'mic') {
          try {
            stream = await navigator.mediaDevices.getUserMedia({ audio: true });
            localStreamCreated = true;
          } catch {
            if (getMasterStream && getMasterStream()) {
              stream = getMasterStream();
              setSourceType('master');
            } else {
              throw new Error('Microphone stream is unavailable. Please click "Enable Mic" or play audio.');
            }
          }
        } else if (getMasterStream && getMasterStream()) {
          stream = getMasterStream();
        } else {
          throw new Error('No active audio playback found to record. Start playback or switch to Mic.');
        }
      }

      if (!stream || stream.getAudioTracks().length === 0) {
        throw new Error('No active audio tracks found in stream.');
      }

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
      audioChunksRef.current = [];

      mediaRecorder.ondataavailable = (event) => {
        if (event.data.size > 0) {
          audioChunksRef.current.push(event.data);
        }
      };

      mediaRecorder.onstop = async () => {
        if (localStreamCreated && stream) {
          stream.getTracks().forEach((t) => t.stop());
        }
        if (timerRef.current) {
          clearInterval(timerRef.current);
          timerRef.current = null;
        }
        const audioBlob = new Blob(audioChunksRef.current, { type: mimeType });
        await handleTranscription(audioBlob);
      };

      mediaRecorder.start(200);
      setIsRecording(true);
      setRecordSeconds(0);

      timerRef.current = setInterval(() => {
        setRecordSeconds((sec) => sec + 1);
      }, 1000);
    } catch (err: any) {
      console.warn('Media recording notice:', err);
      setError(err.message || 'Recording is unavailable in this environment.');
      setIsRecording(false);
    }
  };

  const stopRecording = () => {
    if (timerRef.current) {
      clearInterval(timerRef.current);
      timerRef.current = null;
    }
    if (mediaRecorderRef.current && isRecording) {
      mediaRecorderRef.current.stop();
      setIsRecording(false);
    }
  };

  const handleTranscription = async (blobOrFile: Blob | File) => {
    setIsTranscribing(true);
    setError(null);

    try {
      const reader = new FileReader();
      reader.readAsDataURL(blobOrFile);
      reader.onloadend = async () => {
        const base64data = reader.result?.toString().split(',')[1];
        if (!base64data) throw new Error('Failed to encode audio data');

        const cleanMime = (blobOrFile.type || 'audio/webm').split(';')[0].trim();

        const response = await fetch('/api/transcribe-audio', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            audioBase64: base64data,
            mimeType: cleanMime,
          }),
        });

        if (!response.ok) {
          const errJson = await response.json().catch(() => ({}));
          throw new Error(errJson.error || `Server responded with status ${response.status}`);
        }

        const data = await response.json();
        if (data.success) {
          setTranscription(data.transcription);
        } else {
          setError(data.error || 'Failed to transcribe audio.');
        }
        setIsTranscribing(false);
      };
    } catch (err: unknown) {
      console.warn('Transcription notice:', err);
      setError((err as Error)?.message || 'An error occurred during transcription.');
      setIsTranscribing(false);
    }
  };

  const handleDirectFileTranscription = async () => {
    if (!loadedFile) {
      setError('No audio file is currently uploaded. Please upload a file first.');
      return;
    }
    setTranscription(null);
    await handleTranscription(loadedFile);
  };

  const copyTranscription = () => {
    if (!transcription) return;
    navigator.clipboard.writeText(transcription);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  const downloadTranscription = () => {
    if (!transcription) return;
    const blob = new Blob([transcription], { type: 'text/plain;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    link.setAttribute('download', `Audio_Transcript_${Date.now()}.txt`);
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  };

  return (
    <div className="bg-slate-900 border border-slate-800 rounded-2xl p-5 shadow-xl flex flex-col gap-4">
      {/* Header */}
      <div className="flex items-center justify-between border-b border-slate-800 pb-3 flex-wrap gap-2">
        <div className="flex items-center gap-2.5">
          <div className="p-2 rounded-xl bg-gradient-to-tr from-emerald-500/20 to-teal-500/20 border border-emerald-500/30 text-emerald-300">
            <FileText className="w-5 h-5" />
          </div>
          <div>
            <div className="flex items-center gap-2">
              <h3 className="text-sm font-bold text-white tracking-wide">
                AI Audio Transcription &amp; Speech Analyzer
              </h3>
              <span className="px-2 py-0.5 rounded text-[10px] font-bold bg-emerald-500/20 border border-emerald-500/40 text-emerald-300">
                Gemini 3.5 Transcribe
              </span>
            </div>
            <p className="text-xs text-slate-400">
              High-accuracy speech-to-text, acoustic event tagging &amp; audio file transcript extraction
            </p>
          </div>
        </div>

        {isRecording && (
          <div className="flex items-center gap-2 bg-rose-500/10 border border-rose-500/30 px-3 py-1 rounded-lg">
            <span className="relative flex h-2.5 w-2.5">
              <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-rose-400 opacity-75"></span>
              <span className="relative inline-flex rounded-full h-2.5 w-2.5 bg-rose-500"></span>
            </span>
            <span className="text-xs font-mono font-bold text-rose-300">
              Recording {recordSeconds}s
            </span>
          </div>
        )}
      </div>

      {/* Options Panel Grid */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        {/* Stream Recorder Column */}
        <div className="bg-slate-950 p-4 rounded-xl border border-slate-800 flex flex-col justify-between gap-3">
          <div>
            <div className="flex items-center justify-between mb-1.5">
              <h4 className="text-xs font-bold text-slate-200 flex items-center gap-1.5">
                <Mic className="w-3.5 h-3.5 text-emerald-400" />
                <span>Live Audio Stream Capture</span>
              </h4>

              {/* Source Toggle */}
              <div className="inline-flex rounded-md bg-slate-900 p-0.5 border border-slate-800 text-[11px]">
                <button
                  onClick={() => setSourceType('mic')}
                  disabled={isRecording}
                  className={`px-2 py-0.5 rounded font-semibold transition-all cursor-pointer ${
                    sourceType === 'mic' ? 'bg-emerald-500/20 text-emerald-300' : 'text-slate-400'
                  }`}
                >
                  Mic
                </button>
                <button
                  onClick={() => setSourceType('master')}
                  disabled={isRecording}
                  className={`px-2 py-0.5 rounded font-semibold transition-all cursor-pointer ${
                    sourceType === 'master' ? 'bg-emerald-500/20 text-emerald-300' : 'text-slate-400'
                  }`}
                >
                  Master Playback
                </button>
              </div>
            </div>

            <p className="text-[11px] text-slate-400 leading-relaxed">
              Capture speech from {sourceType === 'mic' ? 'your live microphone' : 'the currently active master audio output'} and generate an exact transcript with timestamps.
            </p>
          </div>

          <div>
            {!isRecording ? (
              <button
                onClick={startRecording}
                disabled={isTranscribing}
                id="btn-start-transcription-recording"
                className="w-full py-2 px-3 rounded-lg bg-emerald-500/15 hover:bg-emerald-500/25 border border-emerald-500/40 text-emerald-300 font-semibold text-xs flex items-center justify-center gap-1.5 transition-all disabled:opacity-40 disabled:cursor-not-allowed cursor-pointer"
              >
                <Mic className="w-3.5 h-3.5" />
                <span>Start Audio Capture to Transcribe</span>
              </button>
            ) : (
              <button
                onClick={stopRecording}
                id="btn-stop-transcription-recording"
                className="w-full py-2 px-3 rounded-lg bg-rose-500/20 border border-rose-500/60 text-rose-300 font-semibold text-xs flex items-center justify-center gap-1.5 hover:bg-rose-500/35 transition-all shadow-[0_0_15px_rgba(244,63,94,0.25)] cursor-pointer"
              >
                <Square className="w-3.5 h-3.5 fill-rose-300" />
                <span>Stop &amp; Transcribe ({recordSeconds}s)</span>
              </button>
            )}
          </div>
        </div>

        {/* Direct Uploaded File Column */}
        <div className="bg-slate-950 p-4 rounded-xl border border-slate-800 flex flex-col justify-between gap-3">
          <div>
            <h4 className="text-xs font-bold text-slate-200 flex items-center gap-1.5 mb-1.5">
              <Upload className="w-3.5 h-3.5 text-cyan-400" />
              <span>Direct Audio File Transcription</span>
            </h4>
            {loadedFile ? (
              <div className="text-[11px] text-emerald-400 flex items-center gap-1.5 bg-emerald-500/10 p-2 rounded-lg border border-emerald-500/20">
                <CheckCircle2 className="w-3.5 h-3.5 shrink-0" />
                <span className="font-semibold truncate">{loadedFile.name}</span>
                <span className="text-[10px] text-slate-400 shrink-0 font-mono">
                  ({(loadedFile.size / 1024 / 1024).toFixed(2)} MB)
                </span>
              </div>
            ) : (
              <p className="text-[11px] text-slate-400 leading-relaxed">
                Upload any audio file (WAV, MP3, WebM, OGG, M4A) via the Media Analyzer or drag &amp; drop to transcribe the entire file.
              </p>
            )}
          </div>

          <button
            onClick={handleDirectFileTranscription}
            disabled={isTranscribing || isRecording || !loadedFile}
            id="btn-transcribe-file-direct"
            className="w-full py-2 px-3 rounded-lg bg-cyan-500/15 hover:bg-cyan-500/25 border border-cyan-500/40 text-cyan-300 font-semibold text-xs flex items-center justify-center gap-1.5 transition-all disabled:opacity-40 disabled:cursor-not-allowed cursor-pointer"
            title={loadedFile ? 'Transcribe loaded file directly' : 'Please upload an audio file first'}
          >
            <Upload className="w-3.5 h-3.5" />
            <span>Transcribe Loaded Audio File</span>
          </button>
        </div>
      </div>

      {/* Error Alert banner */}
      {error && (
        <div className="bg-rose-500/10 border border-rose-500/30 rounded-xl p-3 flex items-start gap-2 text-xs text-rose-300">
          <AlertCircle className="w-4 h-4 text-rose-400 shrink-0 mt-0.5" />
          <div>{error}</div>
        </div>
      )}

      {/* Output Panel */}
      <div className="flex flex-col gap-2">
        <div className="flex items-center justify-between">
          <label className="text-xs text-slate-300 font-semibold flex items-center gap-1.5">
            <FileText className="w-3.5 h-3.5 text-emerald-400" />
            <span>Transcription Output</span>
          </label>

          {transcription && (
            <div className="flex items-center gap-2">
              <button
                onClick={copyTranscription}
                id="btn-copy-transcription"
                className="px-2.5 py-1 rounded-md bg-slate-950 hover:bg-slate-800 border border-slate-800 text-[11px] font-medium text-slate-300 flex items-center gap-1 cursor-pointer transition-colors"
              >
                {copied ? <Check className="w-3 h-3 text-emerald-400" /> : <Copy className="w-3 h-3" />}
                <span>{copied ? 'Copied' : 'Copy'}</span>
              </button>

              <button
                onClick={downloadTranscription}
                id="btn-download-transcription"
                className="px-2.5 py-1 rounded-md bg-slate-950 hover:bg-slate-800 border border-slate-800 text-[11px] font-medium text-cyan-300 flex items-center gap-1 cursor-pointer transition-colors"
              >
                <Download className="w-3 h-3" />
                <span>Save .TXT</span>
              </button>

              <button
                onClick={() => setTranscription(null)}
                id="btn-clear-transcription"
                className="p-1 rounded-md bg-slate-950 hover:bg-slate-800 border border-slate-800 text-slate-400 hover:text-rose-400 cursor-pointer transition-colors"
                title="Clear"
              >
                <Trash2 className="w-3.5 h-3.5" />
              </button>
            </div>
          )}
        </div>

        <div className="bg-slate-950 border border-slate-800 rounded-xl p-4 min-h-[140px] flex flex-col relative overflow-hidden shadow-inner">
          {isTranscribing ? (
            <div className="absolute inset-0 flex flex-col items-center justify-center gap-3 bg-slate-950/85 backdrop-blur-xs z-10">
              <Loader2 className="w-7 h-7 text-emerald-400 animate-spin" />
              <div className="text-center">
                <span className="text-xs text-emerald-300 font-semibold tracking-wide block">
                  Gemini 3.5 Transcribe processing audio stream...
                </span>
                <span className="text-[11px] text-slate-400 mt-0.5 block">
                  Detecting speech clarity, timestamps &amp; audio events
                </span>
              </div>
            </div>
          ) : transcription ? (
            <div className="text-xs sm:text-sm text-slate-100 leading-relaxed whitespace-pre-wrap font-sans">
              {transcription}
            </div>
          ) : (
            <div className="m-auto text-xs text-slate-500 flex flex-col items-center gap-2 text-center py-6">
              <FileText className="w-8 h-8 text-slate-700" />
              <span>
                Record a live audio snippet or select an uploaded file above to generate high-fidelity speech transcription.
              </span>
            </div>
          )}
        </div>
      </div>
    </div>
  );
};
