import React, { useState, useRef } from 'react';
import { Mic, Square, FileText, Loader2, Play, Upload, CheckCircle2, AlertCircle } from 'lucide-react';
import { AudioEngineState } from '../types';

interface TranscriptionPanelProps {
  mediaStreamDestinationRef: React.RefObject<MediaStreamAudioDestinationNode | null>;
  engineState: AudioEngineState;
  loadedFile: File | null;
}

export const TranscriptionPanel: React.FC<TranscriptionPanelProps> = ({
  mediaStreamDestinationRef,
  engineState,
  loadedFile,
}) => {
  const [isRecording, setIsRecording] = useState(false);
  const [isTranscribing, setIsTranscribing] = useState(false);
  const [transcription, setTranscription] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  const mediaRecorderRef = useRef<MediaRecorder | null>(null);
  const audioChunksRef = useRef<Blob[]>([]);

  const startRecording = () => {
    if (!mediaStreamDestinationRef.current) {
      setError('Audio pipeline not ready. Please play some audio first.');
      return;
    }

    try {
      const stream = mediaStreamDestinationRef.current.stream;
      const mediaRecorder = new MediaRecorder(stream, { mimeType: 'audio/webm' });
      mediaRecorderRef.current = mediaRecorder;
      audioChunksRef.current = [];

      mediaRecorder.ondataavailable = (event) => {
        if (event.data.size > 0) {
          audioChunksRef.current.push(event.data);
        }
      };

      mediaRecorder.onstop = async () => {
        const audioBlob = new Blob(audioChunksRef.current, { type: 'audio/webm' });
        await handleTranscription(audioBlob);
      };

      mediaRecorder.start(250);
      setIsRecording(true);
      setError(null);
      setTranscription(null);
    } catch (err) {
      console.error('Failed to start recording', err);
      setError('Failed to start recording. Your browser may not support this feature.');
    }
  };

  const stopRecording = () => {
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

        const response = await fetch('/api/transcribe-audio', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            audioBase64: base64data,
            mimeType: blobOrFile.type,
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
    } catch (err: any) {
      console.error('Transcription error:', err);
      setError(err.message || 'An error occurred during transcription.');
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

  return (
    <div className="bg-slate-900/90 border border-slate-800/80 rounded-2xl p-5 shadow-xl backdrop-blur-md flex flex-col gap-4">
      {/* Header */}
      <div className="flex items-center justify-between border-b border-slate-800 pb-3">
        <div className="flex items-center gap-2.5">
          <div className="p-2 rounded-xl bg-gradient-to-tr from-emerald-500/20 to-teal-500/20 border border-emerald-500/30 text-emerald-300">
            <FileText className="w-5 h-5" />
          </div>
          <div>
            <h3 className="text-sm font-semibold text-white tracking-wide flex items-center gap-2">
              AI Audio Transcription
              <span className="px-2 py-0.5 rounded-full text-[10px] font-bold bg-emerald-500/20 border border-emerald-500/40 text-emerald-300">
                Gemini 3.6 Flash
              </span>
            </h3>
            <p className="text-xs text-slate-400">
              Transcribe any active playbacks, mic recordings, or uploaded audio files directly
            </p>
          </div>
        </div>

        {isRecording && (
          <div className="flex items-center gap-2">
            <span className="relative flex h-2.5 w-2.5">
              <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-rose-400 opacity-75"></span>
              <span className="relative inline-flex rounded-full h-2.5 w-2.5 bg-rose-500"></span>
            </span>
            <span className="text-xs font-bold text-rose-400 uppercase tracking-wider">Recording...</span>
          </div>
        )}
      </div>

      {/* Options Panel Grid */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        {/* Stream Recorder Column */}
        <div className="bg-slate-950 p-4 rounded-xl border border-slate-800/85 flex flex-col justify-between gap-3">
          <div>
            <h4 className="text-xs font-bold text-slate-200 flex items-center gap-1.5 mb-1">
              <Mic className="w-3.5 h-3.5 text-emerald-400" />
              Live / Playback Snippet
            </h4>
            <p className="text-[11px] text-slate-400">
              Record a custom snippet of the currently playing preset, live mic stream, or any active playback, then transcribe it.
            </p>
          </div>

          <div>
            {!isRecording ? (
              <button
                onClick={startRecording}
                disabled={isTranscribing || (!engineState.isPlaying && engineState.sourceType !== 'mic')}
                id="btn-start-transcription-recording"
                className="w-full py-2 px-3 rounded-lg bg-emerald-500/10 hover:bg-emerald-500/25 border border-emerald-500/30 text-emerald-300 font-semibold text-xs flex items-center justify-center gap-1.5 transition-all disabled:opacity-40 disabled:cursor-not-allowed cursor-pointer"
              >
                <Mic className="w-3.5 h-3.5" />
                Record Snippet to Transcribe
              </button>
            ) : (
              <button
                onClick={stopRecording}
                id="btn-stop-transcription-recording"
                className="w-full py-2 px-3 rounded-lg bg-rose-500/20 border border-rose-500/50 text-rose-300 font-semibold text-xs flex items-center justify-center gap-1.5 hover:bg-rose-500/35 transition-all shadow-[0_0_15px_rgba(244,63,94,0.25)] cursor-pointer"
              >
                <Square className="w-3.5 h-3.5" />
                Stop & Transcribe Now
              </button>
            )}
          </div>
        </div>

        {/* Direct Uploaded File Column */}
        <div className="bg-slate-950 p-4 rounded-xl border border-slate-800/85 flex flex-col justify-between gap-3">
          <div>
            <h4 className="text-xs font-bold text-slate-200 flex items-center gap-1.5 mb-1">
              <Upload className="w-3.5 h-3.5 text-cyan-400" />
              Direct File Transcription
            </h4>
            {loadedFile ? (
              <p className="text-[11px] text-emerald-400 flex items-center gap-1">
                <CheckCircle2 className="w-3 h-3" />
                File Ready: <span className="font-semibold truncate max-w-[150px]">{loadedFile.name}</span>
              </p>
            ) : (
              <p className="text-[11px] text-slate-400">
                Upload an audio file in the "Audio Sources" section to transcribe the entire file instantly without manual recording.
              </p>
            )}
          </div>

          <button
            onClick={handleDirectFileTranscription}
            disabled={isTranscribing || isRecording || !loadedFile}
            id="btn-transcribe-file-direct"
            className="w-full py-2 px-3 rounded-lg bg-cyan-500/10 hover:bg-cyan-500/25 border border-cyan-500/30 text-cyan-300 font-semibold text-xs flex items-center justify-center gap-1.5 transition-all disabled:opacity-40 disabled:cursor-not-allowed cursor-pointer"
            title={loadedFile ? "Transcribe uploaded file directly" : "Please upload an audio file first"}
          >
            <Upload className="w-3.5 h-3.5" />
            Transcribe Uploaded File
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
      <div className="flex flex-col gap-1.5">
        <label className="text-xs text-slate-400 font-medium">Transcription Output</label>
        <div className="bg-slate-950 border border-slate-800/90 rounded-xl p-4 min-h-[120px] flex flex-col relative overflow-hidden shadow-inner">
          {isTranscribing ? (
            <div className="absolute inset-0 flex flex-col items-center justify-center gap-3 bg-slate-950/80 backdrop-blur-xs z-10">
              <Loader2 className="w-7 h-7 text-emerald-400 animate-spin" />
              <span className="text-xs text-emerald-300 font-semibold animate-pulse tracking-wide">
                Gemini AI transcribing audio...
              </span>
            </div>
          ) : transcription ? (
            <div className="text-xs sm:text-sm text-slate-100 leading-relaxed whitespace-pre-wrap font-sans">
              {transcription}
            </div>
          ) : (
            <div className="m-auto text-xs text-slate-500 flex flex-col items-center gap-2 text-center py-4">
              <FileText className="w-7 h-7 text-slate-600" />
              <span>
                Transcription text will display here once recording is complete or file is processed.
              </span>
            </div>
          )}
        </div>
      </div>
    </div>
  );
};
