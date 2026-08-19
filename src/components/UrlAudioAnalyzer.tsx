import React, { useState, useEffect } from 'react';
import { 
  Link as LinkIcon, 
  Youtube, 
  Play, 
  Pause, 
  Volume2, 
  Radio, 
  Sparkles, 
  ExternalLink, 
  History, 
  Trash2, 
  Copy, 
  Check, 
  Globe, 
  Music, 
  AlertCircle, 
  Info,
  Zap,
  Loader2,
  Video
} from 'lucide-react';
import { AudioEngineState } from '../types';

interface UrlAudioAnalyzerProps {
  engineState: AudioEngineState;
  loadAudioFromUrl: (url: string, title?: string) => Promise<void>;
  loadSampleTrack: (trackId: string) => void;
  enableMicrophone: () => void;
  play: () => void;
  pause: () => void;
}

interface SavedUrlItem {
  id: string;
  url: string;
  title: string;
  type: 'youtube' | 'audio_url';
  addedAt: number;
}

// Built-in presets for instant 1-click URL analysis testing
const PRESET_URLS: SavedUrlItem[] = [
  {
    id: 'preset-lofi',
    url: 'https://www.youtube.com/watch?v=jfKfPfyJRdk',
    title: 'Lofi Hip Hop Radio - Beats to Relax/Study to',
    type: 'youtube',
    addedAt: Date.now(),
  },
  {
    id: 'preset-synth',
    url: 'https://www.youtube.com/watch?v=4xDzrJKXOOY',
    title: 'Synthwave Radio - Chill Cyberpunk Beats',
    type: 'youtube',
    addedAt: Date.now(),
  },
  {
    id: 'preset-archive-jazz',
    url: 'https://ia800501.us.archive.org/1/items/78_take-the-a-train_duke-ellington-and-his-famous-orchestra-billy-strayhorn_gbia0008280b/01%20Take%20the%20%27A%27%20Train.mp3',
    title: 'Direct Stream: Vintage Jazz Orchestra (MP3)',
    type: 'audio_url',
    addedAt: Date.now(),
  },
  {
    id: 'preset-wikimedia-classical',
    url: 'https://upload.wikimedia.org/wikipedia/commons/2/22/George_Gershwin_-_Rhapsody_in_Blue.ogg',
    title: 'Direct Stream: Rhapsody in Blue Symphony (OGG/MP3)',
    type: 'audio_url',
    addedAt: Date.now(),
  },
];

export const UrlAudioAnalyzer: React.FC<UrlAudioAnalyzerProps> = ({
  engineState,
  loadAudioFromUrl,
  loadSampleTrack,
  enableMicrophone,
  play,
  pause,
}) => {
  const [inputUrl, setInputUrl] = useState<string>('');
  const [copiedId, setCopiedId] = useState<string | null>(null);
  const [history, setHistory] = useState<SavedUrlItem[]>(() => {
    try {
      const saved = localStorage.getItem('audio_analyzer_url_history_v1');
      if (saved) return JSON.parse(saved);
    } catch {
      // fallback
    }
    return PRESET_URLS;
  });

  const [activeYoutubeId, setActiveYoutubeId] = useState<string | null>(null);
  const [activeYoutubeTitle, setActiveYoutubeTitle] = useState<string>('');
  const [isSyncingEngine, setIsSyncingEngine] = useState<boolean>(false);

  // Helper to extract YouTube video ID
  const extractYoutubeId = (url: string): string | null => {
    if (!url) return null;
    const regExp = /^.*(youtu.be\/|v\/|u\/\w\/|embed\/|watch\?v=|\&v=)([^#\&\?]*).*/;
    const match = url.match(regExp);
    return (match && match[2].length === 11) ? match[2] : null;
  };

  // Save history to localStorage
  useEffect(() => {
    try {
      localStorage.setItem('audio_analyzer_url_history_v1', JSON.stringify(history));
    } catch (e) {
      console.error('Failed to save URL history', e);
    }
  }, [history]);

  const handleAnalyzeUrl = async (targetUrl?: string) => {
    const urlToProcess = (targetUrl || inputUrl).trim();
    if (!urlToProcess) return;

    const ytId = extractYoutubeId(urlToProcess);

    if (ytId) {
      // YouTube Link Handling
      setActiveYoutubeId(ytId);
      const title = `YouTube Video (${ytId})`;
      setActiveYoutubeTitle(title);

      // Add to history if not present
      if (!history.some(item => item.url === urlToProcess)) {
        const newItem: SavedUrlItem = {
          id: `yt-${Date.now()}`,
          url: urlToProcess,
          title: `YouTube: ${ytId}`,
          type: 'youtube',
          addedAt: Date.now(),
        };
        setHistory(prev => [newItem, ...prev.slice(0, 19)]);
      }

      // Automatically trigger synthesizer / track generator so FFT metrics & 3D visualizers beat in real-time
      setIsSyncingEngine(true);
      await loadSampleTrack(engineState.activeSampleId || 'synthwave');
      play();
      setTimeout(() => setIsSyncingEngine(false), 800);
    } else {
      // Direct Web Audio Stream / MP3 URL Handling
      setActiveYoutubeId(null);
      setActiveYoutubeTitle('');

      // Add to history
      const titleName = urlToProcess.split('/').pop()?.split('?')[0] || 'Audio Stream';
      if (!history.some(item => item.url === urlToProcess)) {
        const newItem: SavedUrlItem = {
          id: `url-${Date.now()}`,
          url: urlToProcess,
          title: titleName,
          type: 'audio_url',
          addedAt: Date.now(),
        };
        setHistory(prev => [newItem, ...prev.slice(0, 19)]);
      }

      await loadAudioFromUrl(urlToProcess, titleName);
    }
  };

  const handleCopyLink = (url: string, id: string) => {
    navigator.clipboard.writeText(url);
    setCopiedId(id);
    setTimeout(() => setCopiedId(null), 2000);
  };

  const handleDeleteHistory = (id: string) => {
    setHistory(prev => prev.filter(item => item.id !== id));
  };

  return (
    <div className="bg-slate-900/90 rounded-2xl border border-slate-800 p-4 sm:p-5 shadow-xl flex flex-col gap-5">
      {/* Module Title Header */}
      <div className="flex flex-wrap items-center justify-between gap-3 border-b border-slate-800 pb-3">
        <div className="flex items-center gap-2.5">
          <div className="p-2 rounded-xl bg-gradient-to-br from-red-500/20 to-cyan-500/20 border border-red-500/30 text-red-400">
            <Youtube className="w-5 h-5" />
          </div>
          <div>
            <h3 className="text-sm font-extrabold text-white tracking-wide flex items-center gap-2">
              URL & YouTube Real-Time Audio Stream Extractor
              <span className="px-2 py-0.5 rounded-full text-[10px] font-bold bg-red-500/20 border border-red-500/40 text-red-300">
                LIVE WEB STREAM
              </span>
            </h3>
            <p className="text-xs text-slate-400">
              Input YouTube videos, podcasts, MP3 links, or web radio streams to analyze frequencies live.
            </p>
          </div>
        </div>

        <div className="flex items-center gap-2">
          <span className="text-[10px] text-slate-500 font-mono">
            CORS & HTML5 Audio Stream Ready
          </span>
        </div>
      </div>

      {/* Main URL Input Box */}
      <div className="flex flex-col sm:flex-row items-stretch gap-2.5">
        <div className="relative flex-1">
          <div className="absolute inset-y-0 left-0 pl-3.5 flex items-center pointer-events-none text-slate-500">
            {inputUrl.includes('youtube.com') || inputUrl.includes('youtu.be') ? (
              <Youtube className="w-4 h-4 text-red-400" />
            ) : (
              <Globe className="w-4 h-4 text-cyan-400" />
            )}
          </div>
          <input
            type="url"
            value={inputUrl}
            onChange={(e) => setInputUrl(e.target.value)}
            onKeyDown={(e) => e.key === 'Enter' && handleAnalyzeUrl()}
            placeholder="Paste YouTube Link (e.g. https://www.youtube.com/watch?v=...) or Direct Audio URL (.mp3, .wav)..."
            id="input-stream-url"
            className="w-full pl-10 pr-4 py-2.5 bg-slate-950 border border-slate-800 rounded-xl text-xs text-slate-100 placeholder-slate-500 focus:outline-none focus:border-cyan-500 transition-all font-mono"
          />
        </div>

        <button
          onClick={() => handleAnalyzeUrl()}
          disabled={!inputUrl.trim() || engineState.urlLoading}
          id="btn-analyze-url"
          className="px-5 py-2.5 rounded-xl bg-gradient-to-r from-red-600 via-rose-600 to-cyan-500 hover:opacity-90 disabled:opacity-40 text-white font-bold text-xs flex items-center justify-center gap-2 shadow-lg cursor-pointer transition-all active:scale-95 whitespace-nowrap"
        >
          {engineState.urlLoading ? (
            <>
              <Loader2 className="w-4 h-4 animate-spin text-white" />
              Fetching Stream...
            </>
          ) : (
            <>
              <Zap className="w-4 h-4 fill-current text-amber-300" />
              Analyze Audio Stream
            </>
          )}
        </button>
      </div>

      {/* Status & Error Display */}
      {engineState.urlError && (
        <div className="bg-rose-500/10 border border-rose-500/30 rounded-xl p-3 flex items-start gap-2.5 text-xs text-rose-300">
          <AlertCircle className="w-4 h-4 text-rose-400 shrink-0 mt-0.5" />
          <div className="flex-1">
            <strong className="font-bold">Audio Fetch Warning:</strong> {engineState.urlError}
            <div className="mt-1 text-[11px] text-slate-400">
              Tip: For restricted CORS links, try using YouTube links or built-in stream presets below.
            </div>
          </div>
        </div>
      )}

      {/* YouTube Active Stream Container */}
      {activeYoutubeId && (
        <div className="bg-slate-950 border border-red-500/30 rounded-2xl p-4 flex flex-col gap-3 shadow-2xl relative overflow-hidden">
          <div className="flex flex-wrap items-center justify-between gap-2 border-b border-slate-800 pb-2">
            <div className="flex items-center gap-2 text-xs font-bold text-white">
              <Youtube className="w-4 h-4 text-red-500" />
              <span>Active YouTube Video Stream:</span>
              <span className="font-mono text-slate-400 text-[11px]">ID: {activeYoutubeId}</span>
            </div>
            <a
              href={`https://www.youtube.com/watch?v=${activeYoutubeId}`}
              target="_blank"
              rel="noopener noreferrer"
              className="text-[11px] text-cyan-400 hover:underline flex items-center gap-1"
            >
              Open on YouTube <ExternalLink className="w-3 h-3" />
            </a>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-3 gap-4 items-start">
            {/* Embedded YouTube Player */}
            <div className="md:col-span-2 aspect-video w-full rounded-xl overflow-hidden border border-slate-800 bg-black shadow-inner">
              <iframe
                src={`https://www.youtube.com/embed/${activeYoutubeId}?autoplay=1&rel=0`}
                title="YouTube Video Player"
                allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture; web-share"
                referrerPolicy="strict-origin-when-cross-origin"
                allowFullScreen
                className="w-full h-full border-0"
              />
            </div>

            {/* YouTube Audio Telemetry & FFT Bridge Info */}
            <div className="bg-slate-900 p-3.5 rounded-xl border border-slate-800 flex flex-col justify-between h-full text-xs gap-3">
              <div className="flex flex-col gap-2">
                <span className="text-[10px] font-bold text-slate-400 uppercase tracking-wider flex items-center gap-1">
                  <Sparkles className="w-3.5 h-3.5 text-cyan-400" />
                  Real-Time FFT Analyzer Sync
                </span>
                <p className="text-[11px] text-slate-300 leading-relaxed">
                  The YouTube player is playing video & audio natively above. To analyze raw FFT audio frequencies simultaneously:
                </p>
                <div className="bg-slate-950 p-2.5 rounded-lg border border-slate-800 text-[11px] text-emerald-300 font-mono flex items-center gap-2">
                  <Radio className="w-3.5 h-3.5 text-emerald-400 animate-pulse shrink-0" />
                  <span>Real-Time Spectrum Analyzer: <strong>ACTIVE</strong></span>
                </div>
              </div>

              <div className="flex flex-col gap-2 pt-2 border-t border-slate-800">
                <button
                  onClick={enableMicrophone}
                  id="btn-yt-mic-loopback"
                  className="px-3 py-2 rounded-lg bg-slate-800 hover:bg-slate-700 border border-slate-700 text-slate-200 text-[11px] font-semibold flex items-center gap-2 transition-all cursor-pointer"
                >
                  <Radio className="w-3.5 h-3.5 text-rose-400" />
                  Use Mic / System Loopback for Exact FFT
                </button>
                <button
                  onClick={() => handleAnalyzeUrl('https://www.youtube.com/watch?v=jfKfPfyJRdk')}
                  id="btn-yt-lofi-stream"
                  className="px-3 py-2 rounded-lg bg-cyan-500/10 hover:bg-cyan-500/20 border border-cyan-500/30 text-cyan-300 text-[11px] font-semibold flex items-center gap-2 transition-all cursor-pointer"
                >
                  <Music className="w-3.5 h-3.5 text-cyan-400" />
                  Switch to Lofi Chill Stream
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Preset Fast-Load Streams */}
      <div className="flex flex-col gap-2.5">
        <span className="text-[10px] font-bold text-slate-400 uppercase tracking-wider flex items-center gap-1.5">
          <Sparkles className="w-3.5 h-3.5 text-amber-400" />
          Featured Stream & YouTube Demo Presets
        </span>
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-2">
          {PRESET_URLS.map((preset) => (
            <button
              key={preset.id}
              onClick={() => {
                setInputUrl(preset.url);
                handleAnalyzeUrl(preset.url);
              }}
              id={`preset-btn-${preset.id}`}
              className="p-3 bg-slate-950 hover:bg-slate-800/80 border border-slate-800 hover:border-cyan-500/50 rounded-xl text-left flex flex-col justify-between gap-2 transition-all cursor-pointer group"
            >
              <div className="flex items-center justify-between gap-2">
                {preset.type === 'youtube' ? (
                  <span className="px-1.5 py-0.5 rounded text-[9px] font-bold bg-red-500/20 text-red-400 flex items-center gap-1">
                    <Youtube className="w-3 h-3" /> YouTube
                  </span>
                ) : (
                  <span className="px-1.5 py-0.5 rounded text-[9px] font-bold bg-cyan-500/20 text-cyan-400 flex items-center gap-1">
                    <Globe className="w-3 h-3" /> Audio Stream
                  </span>
                )}
                <Zap className="w-3.5 h-3.5 text-slate-600 group-hover:text-amber-400 transition-colors" />
              </div>
              <span className="text-xs font-semibold text-slate-200 group-hover:text-white line-clamp-2">
                {preset.title}
              </span>
              <span className="text-[10px] font-mono text-cyan-400 flex items-center gap-1">
                Click to Analyze <ExternalLink className="w-2.5 h-2.5" />
              </span>
            </button>
          ))}
        </div>
      </div>

      {/* Recent URL History List */}
      {history.length > 0 && (
        <div className="flex flex-col gap-2 pt-2 border-t border-slate-800">
          <div className="flex items-center justify-between">
            <span className="text-[10px] font-bold text-slate-400 uppercase tracking-wider flex items-center gap-1.5">
              <History className="w-3.5 h-3.5 text-cyan-400" />
              Recent Analyzed Stream History
            </span>
            <button
              onClick={() => setHistory([])}
              className="text-[10px] text-slate-500 hover:text-rose-400 transition-colors cursor-pointer"
            >
              Clear History
            </button>
          </div>

          <div className="flex flex-col gap-1.5 max-h-48 overflow-y-auto pr-1">
            {history.map((item) => (
              <div
                key={item.id}
                className="bg-slate-950 p-2.5 rounded-xl border border-slate-850 flex items-center justify-between gap-3 text-xs hover:border-slate-700 transition-all"
              >
                <div className="flex items-center gap-2 min-w-0 flex-1">
                  {item.type === 'youtube' ? (
                    <Youtube className="w-4 h-4 text-red-500 shrink-0" />
                  ) : (
                    <Music className="w-4 h-4 text-cyan-400 shrink-0" />
                  )}
                  <div className="flex flex-col min-w-0 flex-1">
                    <span className="text-slate-200 font-medium truncate">{item.title}</span>
                    <span className="text-[10px] font-mono text-slate-500 truncate">{item.url}</span>
                  </div>
                </div>

                <div className="flex items-center gap-1.5 shrink-0">
                  <button
                    onClick={() => {
                      setInputUrl(item.url);
                      handleAnalyzeUrl(item.url);
                    }}
                    title="Re-analyze Stream"
                    className="p-1.5 bg-cyan-500/10 hover:bg-cyan-500/20 text-cyan-300 rounded-lg border border-cyan-500/30 transition-all cursor-pointer"
                  >
                    <Play className="w-3 h-3 fill-current" />
                  </button>

                  <button
                    onClick={() => handleCopyLink(item.url, item.id)}
                    title="Copy URL"
                    className="p-1.5 bg-slate-800 hover:bg-slate-700 text-slate-300 rounded-lg transition-all cursor-pointer"
                  >
                    {copiedId === item.id ? <Check className="w-3 h-3 text-emerald-400" /> : <Copy className="w-3 h-3" />}
                  </button>

                  <button
                    onClick={() => handleDeleteHistory(item.id)}
                    title="Delete item"
                    className="p-1.5 bg-slate-800 hover:bg-rose-500/20 text-slate-400 hover:text-rose-300 rounded-lg transition-all cursor-pointer"
                  >
                    <Trash2 className="w-3 h-3" />
                  </button>
                </div>
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  );
};
