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
        ? `\nSpectral Metrics Context: Peak frequency: ${spectralMetrics.peakHz || 'N/A'} Hz, RMS Volume: ${spectralMetrics.rmsDb || 'N/A'} dB, Bass ratio: ${spectralMetrics.bass || 'N/A'}, Treble ratio: ${spectralMetrics.treble || 'N/A'}.`
        : '';

      const promptText = `
Analyze this short live microphone audio clip captured from an audio spectrum analyzer app.${metricsContext}
Identify and guess the noises or sound events occurring in the audio clip.
Consider possibilities such as:
- Human Sounds: Speech/Talking, Whistling, Clapping, Snapping Fingers, Coughing, Laughter, Humming, Breathing
- Environmental/Mechanical: Keyboard Typing, Mouse Clicks, Chair Creak, Fan/HVAC Noise, Room Reverb, Object Tapping, Rustling Paper
- Musical / Tonal: Singing, Whistling, Instrument Sounds, Synth / Pure Tones
- Silence / Ambient: Quiet Background, Soft Static, Low White Noise

Return a JSON object with your classification and assessment.
      `.trim();

      const response = await ai.models.generateContent({
        model: 'gemini-3.6-flash',
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
          responseMimeType: 'application/json',
          responseSchema: {
            type: Type.OBJECT,
            properties: {
              primarySound: {
                type: Type.STRING,
                description: 'The primary identified sound or noise (e.g. Clapping, Typing, Whistling, Speech, Fan Noise, Silence)',
              },
              confidence: {
                type: Type.INTEGER,
                description: 'Confidence percentage from 0 to 100',
              },
              category: {
                type: Type.STRING,
                description: 'Category: Human, Percussive, Mechanical, Musical, Ambient, Silence',
              },
              description: {
                type: Type.STRING,
                description: 'A concise 1-sentence acoustic description of what was detected',
              },
              top2OtherNoises: {
                type: Type.ARRAY,
                items: { type: Type.STRING },
                description: '1 or 2 secondary candidate sound guesses',
              },
              acousticCharacteristics: {
                type: Type.STRING,
                description: 'Notable acoustic traits observed (e.g. Sharp transients, steady low hum, harmonic overtones)',
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
                  hardwareFix: { type: Type.STRING, description: 'Hardware or filter recommendation (e.g., High-pass, Noise Gate, Ground Isolator)' },
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
      res.status(500).json({
        error: err.message || 'Failed to analyze live microphone noise',
      });
    }
  });

  // API Route: Transcribe Audio
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
        model: 'gemini-3.6-flash',
        contents: [
          {
            inlineData: {
              mimeType: cleanMimeType,
              data: audioBase64,
            },
          },
          {
            text: 'Please transcribe the following audio clip carefully. Return only the transcription.',
          },
        ],
      });

      const transcription = response.text;
      
      res.json({
        success: true,
        transcription: transcription?.trim(),
      });
    } catch (err: any) {
      console.error('Error transcribing audio:', err);
      res.status(500).json({
        error: err.message || 'Failed to transcribe audio',
      });
    }
  });

  // Vite middleware for development vs static serve for production
  if (process.env.NODE_ENV !== 'production') {
    const vite = await createViteServer({
      server: { middlewareMode: true },
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

startServer();
