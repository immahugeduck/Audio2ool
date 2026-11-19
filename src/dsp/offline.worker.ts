/// <reference lib="webworker" />
import { analyzeOffline, OfflineAnalysisInput } from './offline';

self.onmessage = (e: MessageEvent<OfflineAnalysisInput & { id: number }>) => {
  const { id, ...input } = e.data;
  try {
    const result = analyzeOffline(input);
    (self as unknown as Worker).postMessage({ id, ok: true, result });
  } catch (err) {
    (self as unknown as Worker).postMessage({ id, ok: false, error: (err as Error)?.message || String(err) });
  }
};
