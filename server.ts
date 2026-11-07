import express from 'express';
import path from 'path';
import { fileURLToPath } from 'url';
import { createServer as createViteServer } from 'vite';
import { GoogleGenAI, Type } from '@google/genai';

// Safe resolution of filename and dirname across ESM and CommonJS environments
const filename = typeof __filename !== 'undefined'
  ? __filename
  : (typeof import.meta !== 'undefined' && import.meta.url ? fileURLToPath(import.meta.url) : '');

const dirname = typeof __dirname !== 'undefined'
  ? __dirname
  : (filename ? path.dirname(filename) : process.cwd());

async function startServer() {
  const app = express();
  const PORT = 3000;

  // Middleware
  app.use(express.json({ limit: '20mb' }));

  // Initialize Gemini Client
  const getGeminiAi = () => {
    const apiKey = process.env.GEMINI_API_KEY;
    if (!apiKey) {
      throw new Error('GEMINI_API_KEY is not configured');
    }
    return new GoogleGenAI({
      apiKey,
      httpOptions: {
        headers: {
          'User-Agent': 'aistudio-build',
        },
      },
    });
  };

  // API Route: Live Audio Noise Detection & Classification
  app.post('/api/classify-audio', async (req, res) => {
    try {
      const { audioBase64, mimeType = 'audio/webm', spectralMetrics } = req.body;

      if (!audioBase64) {
        res.status(400).json({ error: 'Missing audioBase64 payload' });
        return;
      }

      // Sanitize mimeType (remove codecs parameters if present, e.g. audio/webm;codecs=opus -> audio/webm)
      const cleanMimeType = (mimeType || 'audio/webm').split(';')[0].trim();

      const ai = getGeminiAi();

      const metricsContext = spectralMetrics
        ? `\nMeasured Acoustic Telemetry:
- Peak Prominent Frequency: ${spectralMetrics.peakHz || 'N/A'} Hz (${spectralMetrics.peakNote || 'N/A'})
- Peak Prominence Level: ${spectralMetrics.prominenceDb || 'N/A'} dBFS
- RMS Sound Pressure Level: ${spectralMetrics.rmsDb || 'N/A'} dBFS (Weighting: ${spectralMetrics.weighting || 'Z'})
- Dynamic Crest Factor (Peak-to-Average): +${spectralMetrics.crestFactorDb || 'N/A'} dB
- Spectral Centroid: ${spectralMetrics.spectralCentroidHz || 'N/A'} Hz
- Harmonic Distortion (THD): ${spectralMetrics.thdPercent !== undefined ? `${spectralMetrics.thdPercent}%` : 'N/A'}
- Energy Distribution: Sub-Bass: ${spectralMetrics.subBass || 0}%, Bass: ${spectralMetrics.bass || 0}%, Midrange: ${spectralMetrics.mid || 0}%, Treble: ${spectralMetrics.treble || 0}%
- Room Noise Floor: ${spectralMetrics.noiseFloorDb || 'N/A'} dBFS (SNR: +${spectralMetrics.snrDb || 'N/A'} dB)
- Impulsive Transient Rate: ${spectralMetrics.transientCount || 0} spikes`
        : '';

      const promptText = `
You are analyzing a live audio capture from a precision acoustic spectrum analyzer.
${metricsContext}

Perform acoustic signature classification of the audio event(s) in this clip:
1. Identify the primary sound event (e.g. Clapping, Mechanical Keyboard Typing, Whistling, Vocal Speech, Fan/HVAC Airflow, Guitar/Instrument Chords, Object Tap, Static Background, Pure Sine Tone).
2. Quantify confidence percentage (0-100%).
3. Classify into category (Human, Percussive, Mechanical, Musical, Ambient, Transient, Electronic, Silence).
4. Provide a professional acoustic description including harmonic structure, transient sharpness, and timbre.
5. Provide psychoacoustic ratings (sharpness, brightness, warmth, harshness, perceived LUFS, sound purity).
6. Give actionable audio engineering remediation (corrective EQ filter, room treatment advice, gate/hardware setting).
      `.trim();

      const response = await ai.models.generateContent({
        model: 'gemini-3.8-flash',
        contents: [
          {
            inlineData: {
              mimeType: cleanMimeType,
              data: audioBase64,
            },
          },
          {
            text: promptText,
          },
        ],
        config: {
          systemInstruction: 'You are a Senior Audio Engineer and Psychoacoustics Specialist. Deliver precise acoustic classification grounded in audio physics and spectral analysis.',
          responseMimeType: 'application/json',
          responseSchema: {
            type: Type.OBJECT,
            properties: {
              primarySound: {
                type: Type.STRING,
                description: 'The primary identified sound or noise event (e.g. Clapping, Typing, Whistling, Vocal Speech, Fan Noise, Silence, Piano Chords)',
              },
              confidence: {
                type: Type.INTEGER,
                description: 'Confidence percentage from 0 to 100',
              },
              category: {
                type: Type.STRING,
                description: 'Category: Human, Percussive, Mechanical, Musical, Ambient, Transient, Electronic, Silence',
              },
              description: {
                type: Type.STRING,
                description: 'A concise 1-2 sentence acoustic engineering description of what was detected',
              },
              top2OtherNoises: {
                type: Type.ARRAY,
                items: { type: Type.STRING },
                description: '1 or 2 secondary candidate sound guesses',
              },
              acousticCharacteristics: {
                type: Type.STRING,
                description: 'Notable acoustic traits observed (e.g. Sharp transients, steady 60Hz hum, overtone series)',
              },
              psychoacoustics: {
                type: Type.OBJECT,
                properties: {
                  sharpnessScore: { type: Type.INTEGER, description: 'Sharpness score from 0 to 100' },
                  brightnessScore: { type: Type.INTEGER, description: 'Brightness score from 0 to 100' },
                  warmthScore: { type: Type.INTEGER, description: 'Warmth score from 0 to 100' },
                  harshnessScore: { type: Type.INTEGER, description: 'Harshness score from 0 to 100' },
                  perceivedLoudnessLufs: { type: Type.INTEGER, description: 'Estimated perceived LUFS (-60 to 0)' },
                  soundPurity: { type: Type.STRING, description: 'One of: Pure Tone, Harmonic, Noise / Broadband, Impulsive / Transient' },
                },
                required: ['sharpnessScore', 'brightnessScore', 'warmthScore', 'harshnessScore', 'perceivedLoudnessLufs', 'soundPurity'],
              },
              recommendedFixes: {
                type: Type.OBJECT,
                properties: {
                  eqAction: { type: Type.STRING, description: 'Actionable EQ recommendation to isolate or clean sound' },
                  roomTreatment: { type: Type.STRING, description: 'Acoustic room treatment or mic positioning advice' },
                  hardwareFix: { type: Type.STRING, description: 'Hardware or filter recommendation (e.g., High-pass at 80Hz, Noise Gate, Ground Isolator)' },
                },
                required: ['eqAction', 'roomTreatment', 'hardwareFix'],
              },
            },
            required: ['primarySound', 'confidence', 'category', 'description'],
          },
        },
      });

      const responseText = response.text;
      if (!responseText) {
        throw new Error('No response text received from Gemini AI model');
      }

      const parsedData = JSON.parse(responseText);
      res.json({
        success: true,
        detection: parsedData,
        timestamp: new Date().toISOString(),
      });
    } catch (err: any) {
      console.error('Error classifying live audio:', err);
      const isAuthError = err.message?.includes('API_KEY') || err.message?.includes('403') || err.message?.includes('401');
      res.status(500).json({
        error: isAuthError
          ? 'Gemini API authentication issue. Please check the GEMINI_API_KEY in the Secrets panel.'
          : (err.message || 'Failed to analyze live audio'),
      });
    }
  });

  // API Route: Transcribe Audio using official gemini-3.5-transcribe model
  app.post('/api/transcribe-audio', async (req, res) => {
    try {
      const { audioBase64, mimeType = 'audio/webm' } = req.body;

      if (!audioBase64) {
        res.status(400).json({ error: 'Missing audioBase64 payload' });
        return;
      }

      const cleanMimeType = (mimeType || 'audio/webm').split(';')[0].trim();
      const ai = getGeminiAi();

      const response = await ai.models.generateContent({
        model: 'gemini-3.5-transcribe',
        contents: [
          {
            inlineData: {
              mimeType: cleanMimeType,
              data: audioBase64,
            },
          },
          {
            text: 'Transcribe this audio recording accurately. Include speaker markers and timestamp markers (e.g. [00:01]) when speech is detected. If non-verbal acoustic sounds occur (e.g. [Clapping], [Keyboard Typing], [Laughter], [Humming], [Instrumental Synth]), note them in brackets. Provide clean formatting.',
          },
        ],
      });

      const transcription = response.text;

      res.json({
        success: true,
        transcription: transcription?.trim() || '(No speech detected in audio clip)',
      });
    } catch (err: any) {
      console.error('Error transcribing audio:', err);
      const isAuthError = err.message?.includes('API_KEY') || err.message?.includes('403') || err.message?.includes('401');
      res.status(500).json({
        error: isAuthError
          ? 'Gemini API authentication issue. Please check the GEMINI_API_KEY in the Secrets panel.'
          : (err.message || 'Failed to transcribe audio clip'),
      });
    }
  });

  // API Route: Comprehensive Acoustic Audit & Room Diagnostics Consultation
  app.post('/api/diagnose-acoustics', async (req, res) => {
    try {
      const { reportMarkdown, telemetry } = req.body;

      if (!reportMarkdown && !telemetry) {
        res.status(400).json({ error: 'Missing reportMarkdown or telemetry payload' });
        return;
      }

      const ai = getGeminiAi();

      const promptText = `
You are evaluating a comprehensive acoustic telemetry snapshot from an audio analyzer suite:

${reportMarkdown || JSON.stringify(telemetry, null, 2)}

Provide a Senior Acoustic Engineering Consultation:
1. Assess room resonance modes, standing waves, and prominent frequency peaks.
2. Evaluate background noise floor, dynamic crest factor, and transient impulses.
3. Determine whether the acoustic environment qualifies as Optimal Studio, Good Acoustic Space, Moderate Noise Leaks, or Severe Acoustic Issues.
4. Prescribe a concrete Corrective EQ Blueprint with exact suggested filter types, center frequencies (Hz), Q-factors, and gain adjustments (dB).
5. Provide actionable room acoustic treatment remediation steps (e.g. bass trap placement, absorption at first reflection points, decoupling, noise gate threshold).
      `.trim();

      const response = await ai.models.generateContent({
        model: 'gemini-3.8-flash',
        contents: promptText,
        config: {
          systemInstruction: 'You are an expert Acoustic Consultant and Sound Systems Engineer. Deliver rigorous, mathematically sound acoustic evaluations and practical audio engineering solutions.',
          responseMimeType: 'application/json',
          responseSchema: {
            type: Type.OBJECT,
            properties: {
              overallRating: {
                type: Type.STRING,
                description: 'One of: Optimal Studio, Good Acoustic Space, Moderate Noise Leaks, Severe Acoustic Issues',
              },
              summary: {
                type: Type.STRING,
                description: 'Executive acoustic diagnostic summary of the space or audio pipeline',
              },
              roomModesAnalysis: {
                type: Type.OBJECT,
                properties: {
                  resonantPeakFrequencies: {
                    type: Type.ARRAY,
                    items: { type: Type.STRING },
                    description: 'Identified resonant peaks or problem frequencies',
                  },
                  roomProblemSummary: {
                    type: Type.STRING,
                    description: 'Analysis of room reflections, modes, or frequency buildup',
                  },
                  bassTrappingAdvice: {
                    type: Type.STRING,
                    description: 'Specific low-frequency absorption and corner bass trapping advice',
                  },
                },
                required: ['resonantPeakFrequencies', 'roomProblemSummary', 'bassTrappingAdvice'],
              },
              noiseFloorAndDynamicRange: {
                type: Type.OBJECT,
                properties: {
                  noiseFloorAssessment: { type: Type.STRING, description: 'Evaluation of the measured ambient noise floor' },
                  snrQuality: { type: Type.STRING, description: 'Evaluation of Signal-to-Noise Ratio and dynamic headroom' },
                  impulsiveSpikesAssessment: { type: Type.STRING, description: 'Evaluation of transient spikes and impulsive noise rate' },
                },
                required: ['noiseFloorAssessment', 'snrQuality', 'impulsiveSpikesAssessment'],
              },
              correctiveEqBlueprint: {
                type: Type.OBJECT,
                properties: {
                  suggestedFilters: {
                    type: Type.ARRAY,
                    items: {
                      type: Type.OBJECT,
                      properties: {
                        type: { type: Type.STRING, description: 'One of: highpass, notch, bell, lowpass' },
                        frequencyHz: { type: Type.NUMBER, description: 'Center or cutoff frequency in Hz' },
                        q: { type: Type.NUMBER, description: 'Q factor bandwidth (e.g. 1.4 to 10.0)' },
                        gainDb: { type: Type.NUMBER, description: 'Gain cut or boost in dB (e.g. -6.0)' },
                        reason: { type: Type.STRING, description: 'Engineering rationale for this filter' },
                      },
                      required: ['type', 'frequencyHz', 'q', 'gainDb', 'reason'],
                    },
                  },
                },
                required: ['suggestedFilters'],
              },
              actionableRemediationSteps: {
                type: Type.ARRAY,
                items: { type: Type.STRING },
                description: 'Top 4-5 prioritized actionable acoustic remediation steps',
              },
            },
            required: ['overallRating', 'summary', 'roomModesAnalysis', 'noiseFloorAndDynamicRange', 'correctiveEqBlueprint', 'actionableRemediationSteps'],
          },
        },
      });

      const responseText = response.text;
      if (!responseText) {
        throw new Error('No diagnostic output returned by Gemini model');
      }

      const parsedData = JSON.parse(responseText);
      res.json({
        success: true,
        report: parsedData,
        timestamp: new Date().toISOString(),
      });
    } catch (err: any) {
      console.error('Error generating acoustic diagnosis:', err);
      const isAuthError = err.message?.includes('API_KEY') || err.message?.includes('403') || err.message?.includes('401');
      res.status(500).json({
        error: isAuthError
          ? 'Gemini API authentication issue. Please check the GEMINI_API_KEY in the Secrets panel.'
          : (err.message || 'Failed to generate acoustic diagnostic consultation'),
      });
    }
  });

  // Health check endpoint
  app.get('/api/health', (req, res) => {
    res.json({ status: 'ok', uptime: process.uptime(), timestamp: new Date().toISOString() });
  });

  // Vite middleware for development vs static serve for production
  if (process.env.NODE_ENV !== 'production') {
    const vite = await createViteServer({
      server: {
        middlewareMode: true,
        hmr: false,
      },
      appType: 'spa',
    });
    app.use(vite.middlewares);
  } else {
    const distPath = path.join(process.cwd(), 'dist');
    app.use(express.static(distPath));
    app.get('*', (req, res) => {
      res.sendFile(path.join(distPath, 'index.html'));
    });
  }

  app.listen(PORT, '0.0.0.0', () => {
    console.log(`Audio Spectrum Server listening on http://0.0.0.0:${PORT}`);
  });
}

process.on('uncaughtException', (err) => {
  console.error('[Server] Uncaught Exception:', err);
});

process.on('unhandledRejection', (reason) => {
  console.error('[Server] Unhandled Rejection:', reason);
});

startServer().catch((err) => {
  console.error('[Server] Fatal error starting server:', err);
  process.exit(1);
});
