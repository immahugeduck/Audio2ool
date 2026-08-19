import { useEffect, useRef, useState, useCallback } from 'react';
import { AudioEngineState, AudioMetrics, VisualizerSettings } from '../types';
import { SAMPLE_TRACKS, generateSampleAudioBuffer, calculateAudioMetrics } from '../utils/audioPresets';

export function useAudioEngine(settings: VisualizerSettings) {
  // Audio state
  const [engineState, setEngineState] = useState<AudioEngineState>({
    sourceType: 'sample',
    isPlaying: false,
    isPaused: false,
    duration: 30,
    currentTime: 0,
    volume: 0.8,
    isMuted: false,
    bassGain: 0,
    midGain: 0,
    trebleGain: 0,
    playbackRate: 1.0,
    pan: 0,
    fileName: null,
    activeSampleId: 'synthwave',
    micActive: false,
    micError: null,
    micMonitoring: false, // Default false: analyze mic audio without replaying to speakers
    audioInputDevices: [],
    selectedDeviceId: null,
    isBluetoothConnected: false,
    bluetoothDeviceName: null,
    phoneMicDeviceName: null,
  });

  const [loadedFile, setLoadedFile] = useState<File | null>(null);

  const [metrics, setMetrics] = useState<AudioMetrics>({
    peakFrequencyHz: 0,
    peakFrequencyFormatted: '0.0 Hz',
    peakNoteName: '---',
    prominenceDb: -100,
    spectralCentroidHz: 0,
    rmsDb: -100,
    peakDb: -100,
    crestFactorDb: 0,
    subBass: 0,
    bass: 0,
    mid: 0,
    treble: 0,
    fps: 60,
  });

  // Web Audio Node Refs
  const engineStateRef = useRef(engineState);
  engineStateRef.current = engineState;

  const settingsRef = useRef(settings);
  settingsRef.current = settings;

  const audioCtxRef = useRef<AudioContext | null>(null);
  const analyserRef = useRef<AnalyserNode | null>(null);
  const masterGainRef = useRef<GainNode | null>(null);
  const bassFilterRef = useRef<BiquadFilterNode | null>(null);
  const midFilterRef = useRef<BiquadFilterNode | null>(null);
  const trebleFilterRef = useRef<BiquadFilterNode | null>(null);
  const pannerRef = useRef<StereoPannerNode | null>(null);
  const mediaStreamDestinationRef = useRef<MediaStreamAudioDestinationNode | null>(null);

  // Buffer and stream refs
  const audioBufferRef = useRef<AudioBuffer | null>(null);
  const bufferSourceRef = useRef<AudioBufferSourceNode | null>(null);
  const mediaStreamRef = useRef<MediaStream | null>(null);
  const micSourceRef = useRef<MediaStreamAudioSourceNode | null>(null);

  // Playback position state tracking
  const startTimeRef = useRef<number>(0);
  const pausedTimeRef = useRef<number>(0);
  const animationFrameRef = useRef<number | null>(null);

  // Data arrays
  const frequencyDataRef = useRef<Uint8Array<ArrayBuffer> | null>(null);
  const timeDataRef = useRef<Uint8Array<ArrayBuffer> | null>(null);

  // Initialize Audio Context and Audio Graph
  const initAudioGraph = useCallback(() => {
    if (!audioCtxRef.current) {
      const AudioContextClass = window.AudioContext || (window as unknown as { webkitAudioContext: typeof AudioContext }).webkitAudioContext;
      const ctx = new AudioContextClass();
      audioCtxRef.current = ctx;

      // Create Analyser Node
      const analyser = ctx.createAnalyser();
      analyser.fftSize = settings.fftSize;
      analyser.smoothingTimeConstant = settings.smoothing;
      analyser.minDecibels = settings.minDecibels;
      analyser.maxDecibels = settings.maxDecibels;
      analyserRef.current = analyser;

      // Equalizer nodes
      const bassFilter = ctx.createBiquadFilter();
      bassFilter.type = 'lowshelf';
      bassFilter.frequency.value = 250;
      bassFilter.gain.value = engineState.bassGain;

      const midFilter = ctx.createBiquadFilter();
      midFilter.type = 'peaking';
      midFilter.frequency.value = 1000;
      midFilter.Q.value = 1.0;
      midFilter.gain.value = engineState.midGain;

      const trebleFilter = ctx.createBiquadFilter();
      trebleFilter.type = 'highshelf';
      trebleFilter.frequency.value = 4000;
      trebleFilter.gain.value = engineState.trebleGain;

      // Panner Node
      const panner = ctx.createStereoPanner ? ctx.createStereoPanner() : null;
      if (panner) panner.pan.value = engineState.pan;

      // Master Gain
      const masterGain = ctx.createGain();
      masterGain.gain.value = engineState.isMuted ? 0 : engineState.volume;

      const mediaStreamDestination = ctx.createMediaStreamDestination();
      masterGain.connect(mediaStreamDestination);

      // Chain: Source -> Bass -> Mid -> Treble -> (Panner) -> Analyser -> Master Gain -> Destination
      bassFilter.connect(midFilter);
      midFilter.connect(trebleFilter);

      let lastNode: AudioNode = trebleFilter;
      if (panner) {
        lastNode.connect(panner);
        lastNode = panner;
      }

      lastNode.connect(analyser);
      analyser.connect(masterGain);
      masterGain.connect(ctx.destination);

      bassFilterRef.current = bassFilter;
      midFilterRef.current = midFilter;
      trebleFilterRef.current = trebleFilter;
      if (panner) pannerRef.current = panner;
      masterGainRef.current = masterGain;
      mediaStreamDestinationRef.current = mediaStreamDestination;

      // Initialize byte arrays
      const bufferLength = analyser.frequencyBinCount;
      frequencyDataRef.current = new Uint8Array(bufferLength);
      timeDataRef.current = new Uint8Array(bufferLength);
    }

    if (audioCtxRef.current.state === 'suspended') {
      audioCtxRef.current.resume();
    }
  }, [settings.fftSize, settings.smoothing, settings.minDecibels, settings.maxDecibels, engineState.bassGain, engineState.midGain, engineState.trebleGain, engineState.pan, engineState.isMuted, engineState.volume]);

  // Sync Analyser Settings
  useEffect(() => {
    if (analyserRef.current) {
      analyserRef.current.fftSize = settings.fftSize;
      analyserRef.current.smoothingTimeConstant = settings.smoothing;
      analyserRef.current.minDecibels = settings.minDecibels;
      analyserRef.current.maxDecibels = settings.maxDecibels;

      const bufferLength = analyserRef.current.frequencyBinCount;
      frequencyDataRef.current = new Uint8Array(bufferLength);
      timeDataRef.current = new Uint8Array(bufferLength);
    }
  }, [settings.fftSize, settings.smoothing, settings.minDecibels, settings.maxDecibels]);

  // Clean up source node
  const stopSourceNode = useCallback(() => {
    if (bufferSourceRef.current) {
      try {
        bufferSourceRef.current.stop();
        bufferSourceRef.current.disconnect();
      } catch {
        // Source might already be stopped
      }
      bufferSourceRef.current = null;
    }

    if (micSourceRef.current) {
      try {
        micSourceRef.current.disconnect();
      } catch {
        // Disconnect if active
      }
      micSourceRef.current = null;
    }

    if (mediaStreamRef.current) {
      mediaStreamRef.current.getTracks().forEach((track) => track.stop());
      mediaStreamRef.current = null;
    }
  }, []);

  // Internal function to play buffer from position
  const playBufferFrom = useCallback(
    (offsetSec: number) => {
      initAudioGraph();
      const ctx = audioCtxRef.current;
      const bassFilter = bassFilterRef.current;
      if (!ctx || !bassFilter || !audioBufferRef.current) return;

      stopSourceNode();

      const source = ctx.createBufferSource();
      source.buffer = audioBufferRef.current;
      source.playbackRate.value = engineState.playbackRate;
      source.connect(bassFilter);

      const duration = audioBufferRef.current.duration;
      const startOffset = Math.max(0, Math.min(offsetSec, duration));

      source.start(0, startOffset);
      bufferSourceRef.current = source;
      startTimeRef.current = ctx.currentTime - startOffset / engineState.playbackRate;

      source.onended = () => {
        // When audio natural ends
        const currentCtx = audioCtxRef.current;
        if (currentCtx && bufferSourceRef.current === source) {
          const played = (currentCtx.currentTime - startTimeRef.current) * engineState.playbackRate;
          if (played >= duration - 0.2) {
            setEngineState((prev) => ({
              ...prev,
              isPlaying: false,
              isPaused: false,
              currentTime: 0,
            }));
            pausedTimeRef.current = 0;
          }
        }
      };

      setEngineState((prev) => ({
        ...prev,
        isPlaying: true,
        isPaused: false,
        duration,
      }));
    },
    [initAudioGraph, stopSourceNode, engineState.playbackRate]
  );

  // Load procedural sample track
  const loadSampleTrack = useCallback(
    async (trackId: string) => {
      initAudioGraph();
      const ctx = audioCtxRef.current;
      if (!ctx) return;

      stopSourceNode();

      const track = SAMPLE_TRACKS.find((t) => t.id === trackId) || SAMPLE_TRACKS[0];
      const buffer = await generateSampleAudioBuffer(ctx, track.generatorType, 30);
      audioBufferRef.current = buffer;
      pausedTimeRef.current = 0;
      setLoadedFile(null);

      setEngineState((prev) => ({
        ...prev,
        sourceType: 'sample',
        activeSampleId: track.id,
        fileName: null,
        duration: buffer.duration,
        currentTime: 0,
        isPlaying: false,
        isPaused: false,
        micActive: false,
      }));
    },
    [initAudioGraph, stopSourceNode]
  );

  // Load uploaded Audio File
  const loadAudioFile = useCallback(
    async (file: File) => {
      initAudioGraph();
      const ctx = audioCtxRef.current;
      if (!ctx) return;

      stopSourceNode();

      try {
        const arrayBuffer = await file.arrayBuffer();
        const decodedBuffer = await ctx.decodeAudioData(arrayBuffer);
        audioBufferRef.current = decodedBuffer;
        pausedTimeRef.current = 0;
        setLoadedFile(file);

        setEngineState((prev) => ({
          ...prev,
          sourceType: 'file',
          fileName: file.name,
          duration: decodedBuffer.duration,
          currentTime: 0,
          isPlaying: false,
          isPaused: false,
          micActive: false,
        }));

        // Auto play on upload
        setTimeout(() => playBufferFrom(0), 100);
      } catch (err) {
        console.error('Failed to decode audio file', err);
      }
    },
    [initAudioGraph, stopSourceNode, playBufferFrom]
  );

  // Load audio from direct URL with CORS proxy fallback
  const loadAudioFromUrl = useCallback(
    async (url: string, title?: string) => {
      initAudioGraph();
      const ctx = audioCtxRef.current;
      if (!ctx) return;

      stopSourceNode();

      setEngineState((prev) => ({
        ...prev,
        sourceType: 'url',
        fileName: title || url,
        activeUrl: url,
        urlLoading: true,
        urlError: null,
      }));

      const tryDecodeAndPlay = async (arrayBuffer: ArrayBuffer, streamTitle: string) => {
        const decodedBuffer = await ctx.decodeAudioData(arrayBuffer);
        audioBufferRef.current = decodedBuffer;
        pausedTimeRef.current = 0;
        setLoadedFile(null);

        setEngineState((prev) => ({
          ...prev,
          sourceType: 'url',
          fileName: streamTitle,
          activeUrl: url,
          duration: decodedBuffer.duration,
          currentTime: 0,
          isPlaying: false,
          isPaused: false,
          micActive: false,
          urlLoading: false,
          urlError: null,
        }));

        setTimeout(() => playBufferFrom(0), 100);
      };

      try {
        // Attempt 1: Direct Fetch
        try {
          const response = await fetch(url);
          if (response.ok) {
            const arrayBuffer = await response.arrayBuffer();
            await tryDecodeAndPlay(arrayBuffer, title || url.split('/').pop()?.split('?')[0] || 'Audio Stream');
            return;
          }
        } catch (directErr) {
          console.warn('Direct fetch failed (CORS restricted), trying CORS Proxy 1...', directErr);
        }

        // Attempt 2: AllOrigins CORS Proxy
        try {
          const proxyUrl = `https://api.allorigins.win/raw?url=${encodeURIComponent(url)}`;
          const response = await fetch(proxyUrl);
          if (response.ok) {
            const arrayBuffer = await response.arrayBuffer();
            await tryDecodeAndPlay(arrayBuffer, (title || 'Audio Stream') + ' (CORS Bypassed)');
            return;
          }
        } catch (proxy1Err) {
          console.warn('CORS Proxy 1 failed, trying CorsProxy.io...', proxy1Err);
        }

        // Attempt 3: CorsProxy.io
        try {
          const proxyUrl2 = `https://corsproxy.io/?${encodeURIComponent(url)}`;
          const response = await fetch(proxyUrl2);
          if (response.ok) {
            const arrayBuffer = await response.arrayBuffer();
            await tryDecodeAndPlay(arrayBuffer, (title || 'Audio Stream') + ' (CORS Bypassed)');
            return;
          }
        } catch (proxy2Err) {
          console.warn('CorsProxy.io failed', proxy2Err);
        }

        throw new Error('CORS Policy: Remote server blocked direct audio array buffer extraction.');
      } catch (err: any) {
        console.error('Failed to load audio from URL:', err);
        setEngineState((prev) => ({
          ...prev,
          urlLoading: false,
          urlError: 'CORS Restriction: The target URL server blocks direct cross-origin browser audio fetching. Try using YouTube links or one of our verified stream presets.',
        }));
      }
    },
    [initAudioGraph, stopSourceNode, playBufferFrom]
  );

  // Enumerate audio input devices and recognize Bluetooth vs Phone Microphone
  const refreshAudioDevices = useCallback(async () => {
    try {
      if (!navigator.mediaDevices || !navigator.mediaDevices.enumerateDevices) return;
      const devices = await navigator.mediaDevices.enumerateDevices();
      const inputDevices = devices.filter((d) => d.kind === 'audioinput');

      const mappedDevices = inputDevices.map((d, index) => {
        const labelLower = (d.label || '').toLowerCase();
        const isBluetooth = 
          labelLower.includes('bluetooth') || 
          labelLower.includes('airpods') || 
          labelLower.includes('headset') || 
          labelLower.includes('hands-free') || 
          labelLower.includes('wireless') ||
          labelLower.includes('buds') ||
          labelLower.includes('headphones');

        const isPhoneMic = !isBluetooth && (
          labelLower.includes('built-in') || 
          labelLower.includes('phone') || 
          labelLower.includes('internal') || 
          labelLower.includes('microphone') ||
          d.deviceId === 'default' ||
          index === 0
        );

        let formattedLabel = d.label || `Microphone ${index + 1}`;
        if (isPhoneMic && !formattedLabel.toLowerCase().includes('built-in')) {
          formattedLabel = `Phone Mic (${formattedLabel})`;
        } else if (isBluetooth && !formattedLabel.toLowerCase().includes('bluetooth')) {
          formattedLabel = `Bluetooth (${formattedLabel})`;
        }

        return {
          deviceId: d.deviceId,
          label: formattedLabel,
          isBluetooth,
          isPhoneMic,
        };
      });

      const bluetoothDevice = mappedDevices.find((d) => d.isBluetooth);
      const phoneMicDevice = mappedDevices.find((d) => d.isPhoneMic) || mappedDevices[0] || null;

      setEngineState((prev) => ({
        ...prev,
        audioInputDevices: mappedDevices,
        isBluetoothConnected: !!bluetoothDevice,
        bluetoothDeviceName: bluetoothDevice ? bluetoothDevice.label : null,
        phoneMicDeviceName: phoneMicDevice ? phoneMicDevice.label : 'Phone Mic (Built-in)',
        selectedDeviceId: prev.selectedDeviceId || (phoneMicDevice ? phoneMicDevice.deviceId : null),
      }));
    } catch (err) {
      console.warn('Failed to enumerate audio devices:', err);
    }
  }, []);

  useEffect(() => {
    refreshAudioDevices();
    if (navigator.mediaDevices && navigator.mediaDevices.addEventListener) {
      navigator.mediaDevices.addEventListener('devicechange', refreshAudioDevices);
      return () => {
        navigator.mediaDevices.removeEventListener('devicechange', refreshAudioDevices);
      };
    }
  }, [refreshAudioDevices]);

  // Enable Microphone Input
  const enableMicrophone = useCallback(async (targetDeviceId?: string) => {
    initAudioGraph();
    const ctx = audioCtxRef.current;
    const bassFilter = bassFilterRef.current;
    if (!ctx || !bassFilter) return;

    stopSourceNode();
    setLoadedFile(null);

    const deviceToUse = targetDeviceId || engineState.selectedDeviceId;

    try {
      let audioConstraints: boolean | MediaTrackConstraints = {
        echoCancellation: false,
        noiseSuppression: false,
        autoGainControl: false,
      };

      if (deviceToUse && deviceToUse !== 'default') {
        audioConstraints = {
          deviceId: { exact: deviceToUse },
          echoCancellation: false,
          noiseSuppression: false,
          autoGainControl: false,
        };
      }

      let stream: MediaStream;
      try {
        stream = await navigator.mediaDevices.getUserMedia({ audio: audioConstraints });
      } catch (exactErr) {
        console.warn('Exact device constraint failed, falling back to general audio request', exactErr);
        stream = await navigator.mediaDevices.getUserMedia({
          audio: {
            echoCancellation: false,
            noiseSuppression: false,
            autoGainControl: false,
          },
        });
      }

      mediaStreamRef.current = stream;
      const micSource = ctx.createMediaStreamSource(stream);
      micSource.connect(bassFilter);
      micSourceRef.current = micSource;

      if (masterGainRef.current) {
        // Mute speaker output if micMonitoring is false to prevent feedback while analyzing
        masterGainRef.current.gain.value = engineState.micMonitoring ? (engineState.isMuted ? 0 : engineState.volume) : 0;
      }

      // Refresh labels after permission grant
      refreshAudioDevices();

      setEngineState((prev) => ({
        ...prev,
        sourceType: 'mic',
        isPlaying: true,
        isPaused: false,
        micActive: true,
        micError: null,
        currentTime: 0,
        duration: 0,
        selectedDeviceId: deviceToUse || prev.selectedDeviceId,
      }));
    } catch (err) {
      console.error('Microphone access denied or error:', err);
      setEngineState((prev) => ({
        ...prev,
        micError: 'Microphone permission denied or unavailable.',
        micActive: false,
      }));
    }
  }, [initAudioGraph, stopSourceNode, engineState.selectedDeviceId, engineState.micMonitoring, engineState.isMuted, engineState.volume, refreshAudioDevices]);

  // Audio Control Methods
  const play = useCallback(() => {
    if (engineState.sourceType === 'mic') {
      enableMicrophone();
      return;
    }

    if (!audioBufferRef.current) {
      loadSampleTrack(engineState.activeSampleId).then(() => {
        playBufferFrom(pausedTimeRef.current);
      });
      return;
    }

    playBufferFrom(pausedTimeRef.current);
  }, [engineState.sourceType, engineState.activeSampleId, enableMicrophone, loadSampleTrack, playBufferFrom]);

  const pause = useCallback(() => {
    if (engineState.sourceType === 'mic') {
      stopSourceNode();
      setEngineState((prev) => ({ ...prev, isPlaying: false, isPaused: true }));
      return;
    }

    if (audioCtxRef.current && engineState.isPlaying) {
      const elapsed = (audioCtxRef.current.currentTime - startTimeRef.current) * engineState.playbackRate;
      pausedTimeRef.current = Math.min(elapsed, engineState.duration);
      stopSourceNode();
      setEngineState((prev) => ({
        ...prev,
        isPlaying: false,
        isPaused: true,
        currentTime: pausedTimeRef.current,
      }));
    }
  }, [engineState.sourceType, engineState.isPlaying, engineState.playbackRate, engineState.duration, stopSourceNode]);

  const seek = useCallback(
    (timeSeconds: number) => {
      if (engineState.sourceType === 'mic') return;

      const clampedTime = Math.max(0, Math.min(timeSeconds, engineState.duration));
      pausedTimeRef.current = clampedTime;

      if (engineState.isPlaying) {
        playBufferFrom(clampedTime);
      } else {
        setEngineState((prev) => ({ ...prev, currentTime: clampedTime }));
      }
    },
    [engineState.sourceType, engineState.duration, engineState.isPlaying, playBufferFrom]
  );

  const setVolume = useCallback((volume: number) => {
    setEngineState((prev) => {
      if (masterGainRef.current) {
        if (prev.sourceType === 'mic' && !prev.micMonitoring) {
          masterGainRef.current.gain.value = 0;
        } else {
          masterGainRef.current.gain.value = prev.isMuted ? 0 : volume;
        }
      }
      return { ...prev, volume };
    });
  }, []);

  const toggleMute = useCallback(() => {
    setEngineState((prev) => {
      const nextMute = !prev.isMuted;
      if (masterGainRef.current) {
        if (prev.sourceType === 'mic' && !prev.micMonitoring) {
          masterGainRef.current.gain.value = 0;
        } else {
          masterGainRef.current.gain.value = nextMute ? 0 : prev.volume;
        }
      }
      return { ...prev, isMuted: nextMute };
    });
  }, []);

  const toggleMicMonitoring = useCallback(() => {
    setEngineState((prev) => {
      const next = !prev.micMonitoring;
      if (masterGainRef.current) {
        if (prev.sourceType === 'mic') {
          masterGainRef.current.gain.value = next ? (prev.isMuted ? 0 : prev.volume) : 0;
        }
      }
      return { ...prev, micMonitoring: next };
    });
  }, []);

  const setEq = useCallback((bassGain: number, midGain: number, trebleGain: number) => {
    setEngineState((prev) => {
      if (bassFilterRef.current) bassFilterRef.current.gain.value = bassGain;
      if (midFilterRef.current) midFilterRef.current.gain.value = midGain;
      if (trebleFilterRef.current) trebleFilterRef.current.gain.value = trebleGain;
      return { ...prev, bassGain, midGain, trebleGain };
    });
  }, []);

  const setPlaybackRate = useCallback(
    (rate: number) => {
      setEngineState((prev) => {
        if (bufferSourceRef.current) {
          bufferSourceRef.current.playbackRate.value = rate;
        }
        return { ...prev, playbackRate: rate };
      });
    },
    []
  );

  const setPan = useCallback((pan: number) => {
    setEngineState((prev) => {
      if (pannerRef.current) {
        pannerRef.current.pan.value = pan;
      }
      return { ...prev, pan };
    });
  }, []);

  // Update real-time metrics and playback playhead position (throttled to ~100ms to prevent React scheduler re-entrancy)
  useEffect(() => {
    let lastTime = performance.now();
    let lastStateUpdateTime = 0;
    let frameCount = 0;

    const updateLoop = () => {
      const now = performance.now();
      frameCount++;

      // FPS calculation every 1 second
      if (now - lastTime >= 1000) {
        const calculatedFps = Math.round((frameCount * 1000) / (now - lastTime));
        lastTime = now;
        frameCount = 0;
        setTimeout(() => {
          setMetrics((prev) => ({ ...prev, fps: calculatedFps }));
        }, 0);
      }

      // Throttle React state updates to every 100ms (10 FPS) to avoid React scheduler thrashing
      if (now - lastStateUpdateTime >= 100) {
        lastStateUpdateTime = now;

        const currentEngine = engineStateRef.current;
        const currentSettings = settingsRef.current;

        // Update current time playhead
        if (currentEngine.isPlaying && currentEngine.sourceType !== 'mic' && audioCtxRef.current) {
          const elapsed = (audioCtxRef.current.currentTime - startTimeRef.current) * currentEngine.playbackRate;
          if (elapsed <= currentEngine.duration) {
            setTimeout(() => {
              setEngineState((prev) => ({ ...prev, currentTime: elapsed }));
            }, 0);
          }
        }

        // Extract Audio metrics for UI text & gauges
        if (analyserRef.current && frequencyDataRef.current) {
          analyserRef.current.getByteFrequencyData(frequencyDataRef.current);
          const sampleRate = audioCtxRef.current ? audioCtxRef.current.sampleRate : 44100;
          const calculated = calculateAudioMetrics(frequencyDataRef.current, sampleRate, currentSettings.fftSize);

          setTimeout(() => {
            setMetrics((prev) => ({
              ...prev,
              peakFrequencyHz: calculated.peakFrequencyHz,
              peakFrequencyFormatted: calculated.peakFrequencyFormatted,
              peakNoteName: calculated.peakNoteName,
              prominenceDb: calculated.prominenceDb,
              spectralCentroidHz: calculated.spectralCentroidHz,
              rmsDb: calculated.rmsDb,
              peakDb: calculated.peakDb,
              crestFactorDb: calculated.crestFactorDb,
              subBass: calculated.subBass,
              bass: calculated.bass,
              mid: calculated.mid,
              treble: calculated.treble,
            }));
          }, 0);
        }
      }

      animationFrameRef.current = requestAnimationFrame(updateLoop);
    };

    animationFrameRef.current = requestAnimationFrame(updateLoop);

    return () => {
      if (animationFrameRef.current) {
        cancelAnimationFrame(animationFrameRef.current);
      }
    };
  }, []);

  // Initial auto load default sample
  useEffect(() => {
    loadSampleTrack('synthwave');
  }, [loadSampleTrack]);

  // Helper getters for canvas
  const getFrequencyData = useCallback(() => {
    if (analyserRef.current && frequencyDataRef.current) {
      analyserRef.current.getByteFrequencyData(frequencyDataRef.current);
      return frequencyDataRef.current;
    }
    return new Uint8Array(0);
  }, []);

  const getTimeDomainData = useCallback(() => {
    if (analyserRef.current && timeDataRef.current) {
      analyserRef.current.getByteTimeDomainData(timeDataRef.current);
      return timeDataRef.current;
    }
    return new Uint8Array(0);
  }, []);

  return {
    engineState,
    metrics,
    play,
    pause,
    seek,
    setVolume,
    toggleMute,
    setEq,
    setPlaybackRate,
    setPan,
    loadSampleTrack,
    loadAudioFile,
    loadAudioFromUrl,
    enableMicrophone,
    toggleMicMonitoring,
    getFrequencyData,
    getTimeDomainData,
    mediaStreamDestinationRef,
    loadedFile,
  };
}
