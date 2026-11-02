import React, { useState } from 'react';
import {
  Download,
  FileText,
  Copy,
  Check,
  FileCode,
  Sparkles,
  X,
  Loader2,
  ShieldAlert,
  ShieldCheck,
  Sliders,
  CheckCircle2,
  Volume2,
} from 'lucide-react';
import {
  AudioMetrics,
  NoiseBaselineProfile,
  AiNoiseDetectionResult,
  AcousticDiagnosticReport,
} from '../types';

interface ReportExporterProps {
  metrics: AudioMetrics;
  profile: NoiseBaselineProfile;
  latestAiResult: AiNoiseDetectionResult | null;
  isOpen: boolean;
  onClose: () => void;
}

export const ReportExporter: React.FC<ReportExporterProps> = ({
  metrics,
  profile,
  latestAiResult,
  isOpen,
  onClose,
}) => {
  const [copied, setCopied] = useState(false);
  const [copiedPrompt, setCopiedPrompt] = useState(false);
  const [aiReport, setAiReport] = useState<AcousticDiagnosticReport | null>(null);
  const [isGeneratingAi, setIsGeneratingAi] = useState(false);
  const [aiError, setAiError] = useState<string | null>(null);

  if (!isOpen) return null;

  const timestamp = new Date().toLocaleString();

  // Build markdown report content
  const buildReportMarkdown = () => {
    let md = `
# PROFESSIONAL ACOUSTIC SOUND AUDIT REPORT
**Generated:** ${timestamp}
**Application:** Professional Audio Analysis Suite

---

## 1. SPECTRAL & AUDIO TELEMETRY METRICS
- **Peak Prominent Frequency:** ${metrics.peakFrequencyFormatted || `${metrics.peakFrequencyHz} Hz`} (${metrics.peakNoteName})
- **Peak Prominence Level:** ${metrics.prominenceDb || metrics.peakDb} dBFS
- **Spectral Centroid (Brightness Center):** ${metrics.spectralCentroidHz || 'N/A'} Hz
- **RMS Volume Level:** ${metrics.rmsDb} dBFS (Weighting: ${metrics.weighting || 'Z'})
- **Instantaneous Peak Level:** ${metrics.peakDb} dBFS
- **Crest Factor (Dynamic Peak-to-Average):** +${metrics.crestFactorDb} dB
- **Sub-Bass Energy (20-60 Hz):** ${metrics.subBass} %
- **Bass Energy (60-250 Hz):** ${metrics.bass} %
- **Midrange Energy (250-2 kHz):** ${metrics.mid} %
- **Treble Energy (2k-20 kHz):** ${metrics.treble} %
- **Harmonic Distortion (THD):** ${metrics.distortion?.isToneDetected ? `${metrics.distortion.thdPercent}% (${metrics.distortion.thdDb} dB)` : 'Broadband / Inharmonic'}
- **Analyzer Frame Rate:** ${metrics.fps} FPS

---

## 2. LONG-TERM BACKGROUND NOISE BASELINE & TRANSIENT AUDIT
- **Calibrated Baseline Status:** ${profile.isCalibrated ? `Calibrated (${profile.lastCalibratedTime || 'Active'})` : 'Uncalibrated (Real-Time Ambient Estimate)'}
- **Measured Ambient Noise Floor:** ${profile.noiseFloorDb} dBFS
- **Signal-to-Noise Ratio (SNR):** +${profile.snrDb} dB
- **Room Acoustic Noise Criteria (NC):** ${profile.noiseCriteriaRating}
- **Dominant Ambient Noise Band:** ${profile.dominantNoiseBand}
- **Impulsive Transient Spikes Detected:** ${profile.transientCount} ${profile.transientsPerMin ? `(Rate: ${profile.transientsPerMin} events/min)` : ''}
- **Transient Acoustic Nature:** Sudden impulsive attacks (e.g. claps, taps, clicks, mic pops with $\\ge 12\\text{ dB}$ rapid energy onset or $\\ge 16\\text{ dB}$ crest factor)

---

## 3. AI LIVE NOISE CLASSIFICATION & SOUND DIAGNOSTIC
${
  latestAiResult
    ? `
- **Primary AI Sound Guess:** ${latestAiResult.primarySound}
- **Category:** ${latestAiResult.category}
- **Match Confidence:** ${latestAiResult.confidence}%
- **Acoustic Description:** ${latestAiResult.description}
${latestAiResult.acousticCharacteristics ? `- **Acoustic Signature:** ${latestAiResult.acousticCharacteristics}` : ''}

### Psychoacoustic Characteristics
${
  latestAiResult.psychoacoustics
    ? `- **Sound Purity:** ${latestAiResult.psychoacoustics.soundPurity}
- **Estimated Perceived Loudness:** ${latestAiResult.psychoacoustics.perceivedLoudnessLufs} LUFS
- **Sharpness Score:** ${latestAiResult.psychoacoustics.sharpnessScore}%
- **Brightness Score:** ${latestAiResult.psychoacoustics.brightnessScore}%
- **Warmth Score:** ${latestAiResult.psychoacoustics.warmthScore}%
- **Harshness Score:** ${latestAiResult.psychoacoustics.harshnessScore}%`
    : 'N/A'
}

### Recommended Acoustic Fixes & Room Treatment
${
  latestAiResult.recommendedFixes
    ? `- **EQ Filter Action:** ${latestAiResult.recommendedFixes.eqAction}
- **Room Treatment Advice:** ${latestAiResult.recommendedFixes.roomTreatment}
- **Hardware / Noise Gate:** ${latestAiResult.recommendedFixes.hardwareFix}`
    : 'N/A'
}
`
    : '*No AI Sound Detection run during this session. Enable mic and click "Guess Live Noise Now".*'
}
`;

    if (aiReport) {
      md += `
---

## 4. IN-APP GEMINI 3.8 FLASH ACOUSTIC CONSULTANT DIAGNOSIS
- **Overall Acoustic Space Rating:** ${aiReport.overallRating}
- **Executive Summary:** ${aiReport.summary}

### Room Resonance & Modes
- **Resonant Problem Frequencies:** ${aiReport.roomModesAnalysis.resonantPeakFrequencies.join(', ')}
- **Room Analysis:** ${aiReport.roomModesAnalysis.roomProblemSummary}
- **Bass Trapping Advice:** ${aiReport.roomModesAnalysis.bassTrappingAdvice}

### Background Noise & Dynamic Headroom
- **Noise Floor Evaluation:** ${aiReport.noiseFloorAndDynamicRange.noiseFloorAssessment}
- **SNR Quality:** ${aiReport.noiseFloorAndDynamicRange.snrQuality}
- **Impulse Rate Diagnostic:** ${aiReport.noiseFloorAndDynamicRange.impulsiveSpikesAssessment}

### Corrective EQ Blueprint
| Type | Frequency (Hz) | Q Factor | Gain (dB) | Purpose |
|------|----------------|----------|-----------|---------|
${aiReport.correctiveEqBlueprint.suggestedFilters
  .map(
    (f) =>
      `| ${f.type.toUpperCase()} | ${f.frequencyHz} Hz | ${f.q} | ${f.gainDb > 0 ? `+${f.gainDb}` : f.gainDb} dB | ${f.reason} |`
  )
  .join('\n')}

### Prioritized Remediation Action Plan
${aiReport.actionableRemediationSteps.map((step, idx) => `${idx + 1}. ${step}`).join('\n')}
`;
    }

    md += `
---
*Report generated automatically by Professional Audio Analysis Suite.*
`;
    return md.trim();
  };

  const reportText = buildReportMarkdown();

  // Prompt formatted for consultation
  const buildGeminiPrompt = () => {
    return `Please analyze this Acoustic Sound Audit Report generated by my audio analyzer suite:

TASKS:
1. Provide a professional acoustic evaluation of dominant frequency (${metrics.peakFrequencyFormatted || `${metrics.peakFrequencyHz} Hz`}), RMS levels, and noise floor (${profile.noiseFloorDb} dBFS).
2. Interpret the room Noise Criteria (${profile.noiseCriteriaRating}), SNR (+${profile.snrDb} dB), and impulsive transient count (${profile.transientCount} events).
3. Diagnose room resonances, HVAC hum, flutter echoes, microphone gain staging, or background noise leaks.
4. Prescribe concrete room acoustic treatment and corrective EQ filters.

--- ACOUSTIC SOUND AUDIT REPORT ---
${reportText}`;
  };

  // Run in-app Gemini AI Diagnostic Consultation
  const handleGenerateAiConsultation = async () => {
    setIsGeneratingAi(true);
    setAiError(null);

    try {
      const response = await fetch('/api/diagnose-acoustics', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          reportMarkdown: reportText,
          telemetry: {
            metrics,
            profile,
            latestAiResult,
          },
        }),
      });

      if (!response.ok) {
        const errJson = await response.json().catch(() => ({}));
        throw new Error(errJson.error || `Server responded with status ${response.status}`);
      }

      const data = await response.json();
      if (data.success && data.report) {
        setAiReport(data.report);
      } else {
        throw new Error('Failed to parse acoustic diagnostic report from Gemini model');
      }
    } catch (err: any) {
      console.warn('Acoustic diagnosis notice:', err);
      setAiError(err.message || 'Could not generate AI acoustic diagnosis');
    } finally {
      setIsGeneratingAi(false);
    }
  };

  const handleCopyPrompt = () => {
    const prompt = buildGeminiPrompt();
    navigator.clipboard.writeText(prompt);
    setCopiedPrompt(true);
    setTimeout(() => setCopiedPrompt(false), 2500);
  };

  const downloadMarkdown = () => {
    const blob = new Blob([reportText], { type: 'text/markdown;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    link.setAttribute('download', `Acoustic_Sound_Audit_${Date.now()}.md`);
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  };

  const downloadJson = () => {
    const data = {
      reportType: 'ACOUSTIC_SOUND_AUDIT',
      timestamp,
      metrics,
      profile,
      aiNoiseResult: latestAiResult,
      geminiConsultation: aiReport,
    };
    const blob = new Blob([JSON.stringify(data, null, 2)], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    link.setAttribute('download', `Acoustic_Sound_Audit_${Date.now()}.json`);
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  };

  const handleCopy = () => {
    navigator.clipboard.writeText(reportText);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  return (
    <div className="fixed inset-0 z-50 bg-slate-950/80 backdrop-blur-md flex items-center justify-center p-4 overflow-y-auto">
      <div className="bg-slate-900 border border-slate-800 rounded-2xl max-w-4xl w-full shadow-2xl flex flex-col max-h-[90vh] overflow-hidden">
        {/* Header */}
        <div className="p-5 border-b border-slate-800 flex items-center justify-between bg-slate-950/80">
          <div className="flex items-center gap-3">
            <div className="p-2.5 rounded-xl bg-emerald-500/10 border border-emerald-500/30 text-emerald-400">
              <FileText className="w-5 h-5" />
            </div>
            <div>
              <h3 className="text-base font-bold text-white tracking-wide">
                Export Acoustic Sound Audit &amp; AI Diagnostic Report
              </h3>
              <p className="text-xs text-slate-400">
                Precision spectral telemetry, room noise criteria &amp; in-app Gemini 3.8 Flash acoustic consultation
              </p>
            </div>
          </div>
          <button
            onClick={onClose}
            id="btn-close-report-modal"
            className="p-2 rounded-xl bg-slate-900 border border-slate-800 text-slate-400 hover:text-white hover:border-slate-700 cursor-pointer transition-all"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Gemini AI Consultation Action Bar */}
        <div className="bg-gradient-to-r from-blue-950/40 via-indigo-950/40 to-purple-950/40 border-b border-indigo-500/20 px-5 py-3.5 flex items-center justify-between gap-3 flex-wrap">
          <div className="flex items-center gap-2.5 text-xs">
            <div className="p-1.5 rounded-lg bg-indigo-500/20 border border-indigo-500/30 text-indigo-300">
              <Sparkles className="w-4 h-4" />
            </div>
            <div>
              <span className="font-semibold text-white block">
                In-App Gemini 3.8 Flash Acoustic Consultation
              </span>
              <span className="text-slate-400 text-[11px]">
                Run full acoustic room mode analysis, dynamic SNR audit &amp; prescriptive EQ filters
              </span>
            </div>
          </div>

          <div className="flex items-center gap-2">
            <button
              onClick={handleGenerateAiConsultation}
              disabled={isGeneratingAi}
              id="btn-run-gemini-consultation"
              className="px-4 py-2 rounded-xl text-xs font-bold bg-gradient-to-r from-blue-600 via-indigo-600 to-purple-600 hover:from-blue-500 hover:via-indigo-500 hover:to-purple-500 text-white flex items-center gap-2 cursor-pointer transition-all shadow-md shadow-indigo-600/20 disabled:opacity-50"
            >
              {isGeneratingAi ? (
                <>
                  <Loader2 className="w-4 h-4 animate-spin text-white" />
                  <span>Evaluating Acoustics...</span>
                </>
              ) : (
                <>
                  <Sparkles className="w-4 h-4 text-indigo-200" />
                  <span>{aiReport ? 'Re-Run AI Consultation' : 'Generate AI Consultation'}</span>
                </>
              )}
            </button>

            <button
              onClick={handleCopyPrompt}
              className="px-3 py-2 rounded-xl text-xs font-semibold bg-slate-950 hover:bg-slate-800 border border-slate-700 text-slate-300 flex items-center gap-1.5 cursor-pointer transition-colors"
              title="Copy prompt for external consultation"
            >
              {copiedPrompt ? <Check className="w-3.5 h-3.5 text-emerald-400" /> : <Copy className="w-3.5 h-3.5 text-slate-400" />}
              <span>{copiedPrompt ? 'Prompt Copied' : 'Copy Prompt'}</span>
            </button>
          </div>
        </div>

        {/* AI Error Alert */}
        {aiError && (
          <div className="m-4 bg-rose-500/10 border border-rose-500/30 rounded-xl p-3 text-xs text-rose-300 flex items-start gap-2">
            <ShieldAlert className="w-4 h-4 text-rose-400 shrink-0 mt-0.5" />
            <div>
              <strong className="block">Consultation Error:</strong>
              {aiError}
            </div>
          </div>
        )}

        {/* In-App AI Report Display Card (if generated) */}
        {aiReport && (
          <div className="m-4 bg-slate-950 border border-indigo-500/30 rounded-xl p-4 flex flex-col gap-3.5 max-h-72 overflow-y-auto">
            <div className="flex items-center justify-between border-b border-slate-800 pb-2.5">
              <div className="flex items-center gap-2">
                <ShieldCheck className="w-4 h-4 text-emerald-400" />
                <span className="text-xs font-bold text-white">AI Acoustic Space Evaluation</span>
              </div>
              <span
                className={`px-2.5 py-1 rounded-md text-xs font-bold border ${
                  aiReport.overallRating.includes('Optimal')
                    ? 'bg-emerald-500/20 border-emerald-500/40 text-emerald-300'
                    : aiReport.overallRating.includes('Good')
                    ? 'bg-cyan-500/20 border-cyan-500/40 text-cyan-300'
                    : 'bg-amber-500/20 border-amber-500/40 text-amber-300'
                }`}
              >
                {aiReport.overallRating}
              </span>
            </div>

            <p className="text-xs text-slate-200 leading-relaxed font-normal">
              {aiReport.summary}
            </p>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-3 text-xs">
              <div className="bg-slate-900/80 p-3 rounded-lg border border-slate-800">
                <span className="font-bold text-cyan-300 block mb-1">Room Modes &amp; Resonance:</span>
                <p className="text-slate-300 text-[11px] leading-relaxed mb-2">
                  {aiReport.roomModesAnalysis.roomProblemSummary}
                </p>
                <div className="flex flex-wrap gap-1">
                  {aiReport.roomModesAnalysis.resonantPeakFrequencies.map((freq, idx) => (
                    <span key={idx} className="px-1.5 py-0.5 rounded bg-slate-950 border border-slate-800 text-cyan-400 font-mono text-[10px]">
                      {freq}
                    </span>
                  ))}
                </div>
              </div>

              <div className="bg-slate-900/80 p-3 rounded-lg border border-slate-800">
                <span className="font-bold text-purple-300 block mb-1">Noise Floor &amp; Headroom:</span>
                <p className="text-slate-300 text-[11px] leading-relaxed mb-1">
                  {aiReport.noiseFloorAndDynamicRange.noiseFloorAssessment}
                </p>
                <p className="text-slate-400 text-[10px] leading-relaxed">
                  SNR: {aiReport.noiseFloorAndDynamicRange.snrQuality}
                </p>
              </div>
            </div>

            {/* Suggested EQ Blueprint */}
            {aiReport.correctiveEqBlueprint.suggestedFilters.length > 0 && (
              <div className="bg-slate-900/90 p-3 rounded-lg border border-slate-800 text-xs">
                <div className="flex items-center gap-1.5 font-bold text-amber-300 mb-2">
                  <Sliders className="w-3.5 h-3.5" />
                  <span>Corrective EQ Blueprint:</span>
                </div>
                <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-2">
                  {aiReport.correctiveEqBlueprint.suggestedFilters.map((f, idx) => (
                    <div key={idx} className="bg-slate-950 p-2 rounded border border-slate-800 text-[11px]">
                      <div className="flex justify-between font-mono font-bold text-slate-200">
                        <span className="uppercase text-amber-400">{f.type}</span>
                        <span>{f.frequencyHz} Hz</span>
                        <span className={f.gainDb < 0 ? 'text-cyan-400' : 'text-emerald-400'}>
                          {f.gainDb > 0 ? `+${f.gainDb}` : f.gainDb} dB
                        </span>
                      </div>
                      <span className="text-[10px] text-slate-400 block mt-1 leading-snug">
                        {f.reason} (Q: {f.q})
                      </span>
                    </div>
                  ))}
                </div>
              </div>
            )}

            {/* Actionable Steps */}
            {aiReport.actionableRemediationSteps.length > 0 && (
              <div className="text-[11px] text-slate-300 bg-slate-900/70 p-3 rounded-lg border border-slate-800">
                <span className="font-bold text-emerald-400 block mb-1.5">Actionable Remediation Blueprint:</span>
                <ul className="space-y-1">
                  {aiReport.actionableRemediationSteps.map((step, idx) => (
                    <li key={idx} className="flex items-start gap-1.5">
                      <CheckCircle2 className="w-3.5 h-3.5 text-emerald-400 shrink-0 mt-0.5" />
                      <span>{step}</span>
                    </li>
                  ))}
                </ul>
              </div>
            )}
          </div>
        )}

        {/* Report Preview */}
        <div className="p-5 overflow-y-auto flex-1 bg-slate-950/90 font-mono text-[11px] text-slate-300 whitespace-pre-wrap leading-relaxed border-b border-slate-800">
          {reportText}
        </div>

        {/* Action Buttons */}
        <div className="p-4 bg-slate-950 flex items-center justify-between gap-3 flex-wrap">
          <div className="flex items-center gap-2">
            <button
              onClick={handleCopy}
              id="btn-copy-report"
              className="px-3.5 py-2 rounded-xl text-xs font-semibold bg-slate-900 border border-slate-800 hover:border-slate-700 text-slate-200 flex items-center gap-2 cursor-pointer transition-all"
            >
              {copied ? <Check className="w-4 h-4 text-emerald-400" /> : <Copy className="w-4 h-4 text-slate-400" />}
              <span>{copied ? 'Copied Full Report!' : 'Copy Full Report'}</span>
            </button>
          </div>

          <div className="flex items-center gap-2">
            <button
              onClick={downloadJson}
              id="btn-download-report-json"
              className="px-3.5 py-2 rounded-xl text-xs font-semibold bg-slate-900 border border-slate-800 hover:border-slate-700 text-cyan-300 flex items-center gap-2 cursor-pointer transition-all"
            >
              <FileCode className="w-4 h-4 text-cyan-400" />
              <span>JSON Export</span>
            </button>

            <button
              onClick={downloadMarkdown}
              id="btn-download-report-md"
              className="px-4 py-2 rounded-xl text-xs font-bold bg-gradient-to-r from-emerald-500 to-cyan-600 hover:from-emerald-400 hover:to-cyan-500 text-slate-950 flex items-center gap-2 cursor-pointer transition-all shadow-lg shadow-emerald-500/20"
            >
              <Download className="w-4 h-4 text-slate-950" />
              <span>Download Markdown (.md)</span>
            </button>
          </div>
        </div>
      </div>
    </div>
  );
};
