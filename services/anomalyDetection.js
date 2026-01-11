/**
 * Anomaly Detection Service
 * 
 * AI Component: Unsupervised Anomaly Detection using Statistical Methods
 * 
 * This service implements FREE, LOCAL AI logic without requiring:
 * - Paid APIs (OpenAI, cloud ML services)
 * - External services
 * - Labeled training data
 * 
 * Method: Z-score based anomaly detection with rolling statistics
 * 
 * Why this is AI:
 * - Unsupervised learning: Learns normal patterns from data without labels
 * - Pattern recognition: Identifies deviations from learned patterns
 * - Adaptive: Each unit has its own baseline learned from history
 * 
 * Why no labels needed:
 * - Uses statistical deviation (Z-score) from historical mean
 * - Compares recent behavior to past behavior for same unit
 * - Threshold-based: Flags values beyond 2-3 standard deviations
 * 
 * Why this fits Early Warning (not prediction):
 * - Detects "rapid deterioration" (sudden spikes)
 * - Focuses on change rate, not absolute prediction
 * - Identifies areas needing immediate attention
 * - Complements UCI (which is priority ranking) with anomaly signals
 */

import SignalHuman from '../models/SignalHuman.js';
import SignalPopulation from '../models/SignalPopulation.js';
import { subDays, format, parseISO } from 'date-fns';

/**
 * Compute anomaly score for a unit on a specific date
 * 
 * @param {string} unitId - Unit ID
 * @param {string} date - Target date (YYYY-MM-DD)
 * @param {number} windowWeeks - Window for recent data (default: 4)
 * @param {number} baselineWeeks - Window for baseline/historical data (default: 8)
 * @returns {Object} Anomaly detection result
 */
export async function detectAnomaly(unitId, date, windowWeeks = 4, baselineWeeks = 8) {
  const targetDate = typeof date === 'string' ? parseISO(date) : date;
  const windowDays = windowWeeks * 7;
  const baselineDays = baselineWeeks * 7;
  
  const endDate = format(targetDate, 'yyyy-MM-dd');
  const recentStartDate = format(subDays(targetDate, windowDays), 'yyyy-MM-dd');
  const baselineStartDate = format(subDays(targetDate, baselineDays), 'yyyy-MM-dd');
  const baselineEndDate = format(subDays(targetDate, windowDays), 'yyyy-MM-dd');

  // 1. Extract features from recent period (4 weeks)
  const recentHumanData = await SignalHuman.find({
    unit_id: unitId,
    date: { $gte: recentStartDate, $lte: endDate },
    signal_type: 'total'
  }).sort({ date: 1 });

  const recentPopData = await SignalPopulation.find({
    unit_id: unitId,
    date: { $gte: recentStartDate, $lte: endDate }
  }).sort({ date: 1 });

  // 2. Extract baseline/historical data (8 weeks before recent period)
  const baselineHumanData = await SignalHuman.find({
    unit_id: unitId,
    date: { $gte: baselineStartDate, $lt: recentStartDate },
    signal_type: 'total'
  }).sort({ date: 1 });

  const baselinePopData = await SignalPopulation.find({
    unit_id: unitId,
    date: { $gte: baselineStartDate, $lt: recentStartDate }
  }).sort({ date: 1 });

  // 3. Compute features
  const features = computeFeatures(
    recentHumanData,
    baselineHumanData,
    recentPopData,
    baselinePopData
  );

  // 4. Compute anomaly score using Z-score method
  const { anomaly_score, z_score, rolling_mean, rolling_std, explanation } = 
    computeAnomalyScore(features, baselineHumanData, baselinePopData);

  // 5. Binary flag (threshold: score > 0.7 or z-score > 2.5)
  const anomaly_flag = anomaly_score > 0.7 || Math.abs(z_score) > 2.5;

  return {
    unit_id: unitId,
    date: endDate,
    anomaly_score: Math.min(1.0, Math.max(0.0, anomaly_score)),
    anomaly_flag,
    features,
    stats: {
      z_score,
      rolling_mean,
      rolling_std
    },
    explanation: explanation || (anomaly_flag ? generateExplanation(features, z_score) : null)
  };
}

/**
 * Compute input features for anomaly detection
 */
function computeFeatures(recentHuman, baselineHuman, recentPop, baselinePop) {
  // Feature 1: 4-week change in total complaints
  const recentTotal = recentHuman.reduce((sum, d) => sum + (d.value || 0), 0);
  const baselineTotal = baselineHuman.reduce((sum, d) => sum + (d.value || 0), 0);
  const complaint_change_4w = baselineTotal > 0 
    ? (recentTotal - baselineTotal) / baselineTotal 
    : (recentTotal > 0 ? 1.0 : 0.0);

  // Feature 2: Complaint growth rate (normalized)
  const recentAvg = recentHuman.length > 0 ? recentTotal / recentHuman.length : 0;
  const baselineAvg = baselineHuman.length > 0 ? baselineTotal / baselineHuman.length : 0;
  const complaint_growth_rate = baselineAvg > 0 
    ? (recentAvg - baselineAvg) / baselineAvg 
    : (recentAvg > 0 ? 1.0 : 0.0);

  // Feature 3: Night ratio change
  const recentNightData = recentHuman.filter(d => d.signal_type === 'night_ratio');
  const baselineNightData = baselineHuman.filter(d => d.signal_type === 'night_ratio');
  const recentNightRatio = recentNightData.length > 0 
    ? recentNightData.reduce((sum, d) => sum + (d.value || 0), 0) / recentNightData.length 
    : 0;
  const baselineNightRatio = baselineNightData.length > 0 
    ? baselineNightData.reduce((sum, d) => sum + (d.value || 0), 0) / baselineNightData.length 
    : 0;
  const night_ratio_change = baselineNightRatio > 0 
    ? (recentNightRatio - baselineNightRatio) / baselineNightRatio 
    : 0;

  // Feature 4: Population change rate
  const recentPopTotal = recentPop.reduce((sum, d) => sum + (d.pop_total || 0), 0);
  const baselinePopTotal = baselinePop.reduce((sum, d) => sum + (d.pop_total || 0), 0);
  const population_change_rate = baselinePopTotal > 0 
    ? (recentPopTotal - baselinePopTotal) / baselinePopTotal 
    : 0;

  return {
    complaint_change_4w,
    complaint_growth_rate,
    night_ratio_change,
    population_change_rate
  };
}

/**
 * Compute anomaly score using Z-score method
 * 
 * Algorithm:
 * 1. Combine features into a single composite score
 * 2. Compute rolling mean and std from baseline period
 * 3. Calculate Z-score: (current - mean) / std
 * 4. Convert Z-score to anomaly score (0-1)
 */
function computeAnomalyScore(features, baselineHuman, baselinePop) {
  // Combine features into composite score
  // Weight: complaint_change (40%), growth_rate (30%), night_ratio (20%), pop_change (10%)
  const compositeScore = 
    features.complaint_change_4w * 0.4 +
    features.complaint_growth_rate * 0.3 +
    Math.abs(features.night_ratio_change) * 0.2 +
    Math.abs(features.population_change_rate) * 0.1;

  // Compute rolling statistics from baseline
  // For simplicity, use historical composite scores
  const baselineScores = [];
  if (baselineHuman.length > 0 && baselinePop.length > 0) {
    // Use weekly aggregates
    const weeklyGroups = {};
    baselineHuman.forEach(d => {
      const week = d.date.substring(0, 7); // YYYY-MM
      if (!weeklyGroups[week]) weeklyGroups[week] = { human: [], pop: [] };
      weeklyGroups[week].human.push(d);
    });
    baselinePop.forEach(d => {
      const week = d.date.substring(0, 7);
      if (!weeklyGroups[week]) weeklyGroups[week] = { human: [], pop: [] };
      weeklyGroups[week].pop.push(d);
    });

    Object.values(weeklyGroups).forEach(group => {
      const humanTotal = group.human.reduce((sum, d) => sum + (d.value || 0), 0);
      const popTotal = group.pop.reduce((sum, d) => sum + (d.pop_total || 0), 0);
      const humanAvg = group.human.length > 0 ? humanTotal / group.human.length : 0;
      const popAvg = group.pop.length > 0 ? popTotal / group.pop.length : 0;
      
      // Simplified composite for baseline
      const score = humanAvg * 0.7 + (popAvg > 0 ? 0.3 : 0);
      baselineScores.push(score);
    });
  }

  // Compute mean and std
  const rolling_mean = baselineScores.length > 0
    ? baselineScores.reduce((sum, s) => sum + s, 0) / baselineScores.length
    : 0;
  
  const variance = baselineScores.length > 1
    ? baselineScores.reduce((sum, s) => sum + Math.pow(s - rolling_mean, 2), 0) / (baselineScores.length - 1)
    : 1.0;
  const rolling_std = Math.sqrt(variance) || 1.0;

  // Compute Z-score
  const z_score = rolling_std > 0 
    ? (compositeScore - rolling_mean) / rolling_std 
    : 0;

  // Convert Z-score to anomaly score (0-1)
  // Z-score > 2.5 -> score ~1.0
  // Z-score 0 -> score ~0.5
  // Z-score < -2.5 -> score ~0.0
  const anomaly_score = Math.min(1.0, Math.max(0.0, 0.5 + (z_score / 5.0)));

  return {
    anomaly_score,
    z_score,
    rolling_mean,
    rolling_std
  };
}

/**
 * Generate human-readable explanation for anomaly
 */
function generateExplanation(features, z_score) {
  const parts = [];
  
  if (features.complaint_change_4w > 0.3) {
    parts.push(`최근 4주 민원이 ${Math.round(features.complaint_change_4w * 100)}% 증가`);
  }
  if (features.complaint_growth_rate > 0.2) {
    parts.push(`민원 증가율이 과거 대비 ${Math.round(features.complaint_growth_rate * 100)}% 높음`);
  }
  if (Math.abs(features.night_ratio_change) > 0.15) {
    parts.push(`야간 민원 비율이 ${features.night_ratio_change > 0 ? '증가' : '감소'}함`);
  }
  if (Math.abs(z_score) > 2.5) {
    parts.push(`통계적 이상치 감지 (Z-score: ${z_score.toFixed(2)})`);
  }

  return parts.length > 0 
    ? parts.join(', ') + ' - 급격한 악화 신호'
    : '통계적 이상 패턴 감지';
}

