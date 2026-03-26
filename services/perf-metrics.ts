type Sample = {
  durationMs: number;
  cacheHit: boolean;
};

type MetricBucket = {
  calls: number;
  cacheHits: number;
  samples: Sample[];
};

const MAX_SAMPLES = 200;
const metricBuckets = new Map<string, MetricBucket>();

function getOrCreateBucket(metric: string): MetricBucket {
  const existing = metricBuckets.get(metric);
  if (existing) return existing;
  const next: MetricBucket = {
    calls: 0,
    cacheHits: 0,
    samples: [],
  };
  metricBuckets.set(metric, next);
  return next;
}

function percentile(values: number[], ratio: number) {
  if (!values.length) return 0;
  const index = Math.min(
    values.length - 1,
    Math.max(0, Math.floor((values.length - 1) * ratio)),
  );
  return values[index] || 0;
}

export function recordPerfMetric(
  metric: string,
  input: { durationMs: number; cacheHit?: boolean },
) {
  const bucket = getOrCreateBucket(metric);
  const durationMs = Math.max(0, Number(input.durationMs || 0));
  const cacheHit = Boolean(input.cacheHit);

  bucket.calls += 1;
  if (cacheHit) bucket.cacheHits += 1;
  bucket.samples.push({ durationMs, cacheHit });
  if (bucket.samples.length > MAX_SAMPLES) {
    bucket.samples.splice(0, bucket.samples.length - MAX_SAMPLES);
  }
}

export type PerfMetricSnapshot = {
  metric: string;
  calls: number;
  cacheHitRatio: number;
  p50Ms: number;
  p95Ms: number;
};

export function getPerfMetricSnapshot(metric: string): PerfMetricSnapshot {
  const bucket = metricBuckets.get(metric);
  if (!bucket) {
    return {
      metric,
      calls: 0,
      cacheHitRatio: 0,
      p50Ms: 0,
      p95Ms: 0,
    };
  }

  const sortedDurations = bucket.samples
    .map((sample) => sample.durationMs)
    .sort((left, right) => left - right);

  return {
    metric,
    calls: bucket.calls,
    cacheHitRatio: bucket.calls > 0 ? bucket.cacheHits / bucket.calls : 0,
    p50Ms: percentile(sortedDurations, 0.5),
    p95Ms: percentile(sortedDurations, 0.95),
  };
}

export function resetPerfMetric(metric?: string) {
  if (!metric) {
    metricBuckets.clear();
    return;
  }
  metricBuckets.delete(metric);
}

