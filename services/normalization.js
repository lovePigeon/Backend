// 정규화 유틸리티 함수들

export function winsorize(values, percentile = 0.05) {
  if (!values || values.length === 0) return values;

  const sorted = [...values].sort((a, b) => a - b);
  const lowerIndex = Math.floor(values.length * percentile);
  const upperIndex = Math.ceil(values.length * (1 - percentile));

  const lower = sorted[lowerIndex] || sorted[0];
  const upper = sorted[upperIndex] || sorted[sorted.length - 1];

  return values.map(v => Math.max(lower, Math.min(upper, v)));
}

export function minMaxNormalize(values, minVal = null, maxVal = null) {
  if (!values || values.length === 0) return values;

  const min = minVal !== null ? minVal : Math.min(...values);
  const max = maxVal !== null ? maxVal : Math.max(...values);

  if (max === min) return values.map(() => 0.5);

  return values.map(v => Math.max(0, Math.min(1, (v - min) / (max - min))));
}

export function normalizeSignal(values, method = 'min_max', winsorizePercentile = 0.05) {
  if (!values || values.length === 0) return [];

  let processed = values;
  if (winsorizePercentile > 0) {
    processed = winsorize(values, winsorizePercentile);
  }

  if (method === 'min_max') {
    return minMaxNormalize(processed);
  }

  return processed;
}

