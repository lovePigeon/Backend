/**
 * Data Augmentation Service
 * 
 * 데이터 보강 및 생성 서비스
 * - 결측치 보간 (Interpolation)
 * - 데이터 스무딩 (Smoothing)
 * - 통계적 데이터 생성 (베이스라인 기반)
 * - 외부 데이터 소스 통합 준비
 * 
 * 발표 포인트:
 * - 데이터 품질 개선 (결측치 처리)
 * - 데이터 보강 기법
 * - 통계적 방법론 적용
 */

import SignalHuman from '../models/SignalHuman.js';
import SignalPopulation from '../models/SignalPopulation.js';
import ComfortIndex from '../models/ComfortIndex.js';
import BaselineMetric from '../models/BaselineMetric.js';
import { format, parseISO, eachDayOfInterval, isAfter, isBefore } from 'date-fns';

/**
 * 선형 보간 (Linear Interpolation)으로 결측치 채우기
 * @param {Array} data - 시계열 데이터 [{date, value}, ...]
 * @returns {Array} 보간된 데이터
 */
export function interpolateMissingValues(data) {
  if (data.length < 2) return data;

  const sorted = [...data].sort((a, b) => 
    parseISO(a.date).getTime() - parseISO(b.date).getTime()
  );

  const result = [];
  for (let i = 0; i < sorted.length - 1; i++) {
    result.push(sorted[i]);

    const currentDate = parseISO(sorted[i].date);
    const nextDate = parseISO(sorted[i + 1].date);
    const daysDiff = Math.floor((nextDate - currentDate) / (1000 * 60 * 60 * 24));

    // 중간에 날짜가 빠진 경우 보간
    if (daysDiff > 1) {
      const currentValue = sorted[i].value;
      const nextValue = sorted[i + 1].value;
      const valueDiff = nextValue - currentValue;
      const step = valueDiff / daysDiff;

      for (let j = 1; j < daysDiff; j++) {
        const interpolatedDate = new Date(currentDate);
        interpolatedDate.setDate(interpolatedDate.getDate() + j);
        
        result.push({
          date: format(interpolatedDate, 'yyyy-MM-dd'),
          value: currentValue + step * j,
          interpolated: true // 보간된 데이터 표시
        });
      }
    }
  }
  result.push(sorted[sorted.length - 1]);
  return result;
}

/**
 * 지수 이동평균 (EMA) 스무딩
 * @param {Array} data - 시계열 데이터
 * @param {number} alpha - 스무딩 계수 (0-1)
 * @returns {Array} 스무딩된 데이터
 */
export function exponentialSmoothing(data, alpha = 0.3) {
  if (data.length === 0) return [];
  
  const smoothed = [{ ...data[0], smoothed: data[0].value }];
  
  for (let i = 1; i < data.length; i++) {
    const smoothedValue = alpha * data[i].value + (1 - alpha) * smoothed[i - 1].smoothed;
    smoothed.push({
      ...data[i],
      smoothed: smoothedValue
    });
  }
  
  return smoothed;
}

/**
 * 베이스라인 기반 데이터 생성 (데이터가 부족한 지역)
 * @param {string} unitId - 지역 ID
 * @param {string} startDate - 시작 날짜
 * @param {string} endDate - 종료 날짜
 * @param {string} signalType - 신호 타입 ('human', 'population')
 * @returns {Array} 생성된 데이터
 */
export async function generateBaselineBasedData(unitId, startDate, endDate, signalType = 'human') {
  // 베이스라인 데이터 조회
  const baseline = await BaselineMetric.findOne({
    date: { $lte: endDate }
  }).sort({ date: -1 }).lean();

  if (!baseline) {
    return [];
  }

  // 해당 지역의 기존 데이터 조회 (패턴 파악용)
  const existingData = signalType === 'human'
    ? await SignalHuman.find({
        unit_id: unitId,
        date: { $gte: startDate, $lte: endDate },
        signal_type: 'total'
      }).sort({ date: 1 }).lean()
    : await SignalPopulation.find({
        unit_id: unitId,
        date: { $gte: startDate, $lte: endDate }
      }).sort({ date: 1 }).lean();

  // 기존 데이터의 평균과 표준편차 계산
  const values = existingData.map(d => signalType === 'human' ? d.value : d.pop_total);
  const mean = values.length > 0 
    ? values.reduce((a, b) => a + b, 0) / values.length 
    : (signalType === 'human' ? baseline.avg_complaints_per_day : 10000);
  
  const variance = values.length > 1
    ? values.reduce((sum, val) => sum + Math.pow(val - mean, 2), 0) / (values.length - 1)
    : Math.pow(mean * 0.2, 2); // 20% 변동성 가정
  const std = Math.sqrt(variance);

  // 날짜 범위 생성
  const dates = eachDayOfInterval({
    start: parseISO(startDate),
    end: parseISO(endDate)
  });

  // 기존 데이터가 있는 날짜는 제외
  const existingDates = new Set(existingData.map(d => d.date));
  
  // 누락된 날짜에 대해 베이스라인 기반 데이터 생성
  const generated = [];
  dates.forEach(date => {
    const dateStr = format(date, 'yyyy-MM-dd');
    if (!existingDates.has(dateStr)) {
      // 정규분포 기반 랜덤 생성 (mean ± std 범위 내)
      const randomFactor = (Math.random() - 0.5) * 2; // -1 ~ 1
      const generatedValue = Math.max(0, mean + randomFactor * std);

      if (signalType === 'human') {
        generated.push({
          unit_id: unitId,
          date: dateStr,
          signal_type: 'total',
          value: Math.round(generatedValue),
          meta: {
            source: 'data_augmentation',
            method: 'baseline_based',
            confidence: 0.6
          }
        });
      } else {
        generated.push({
          unit_id: unitId,
          date: dateStr,
          pop_total: Math.round(generatedValue),
          pop_night: Math.round(generatedValue * 0.2), // 야간 인구 20% 가정
          meta: {
            source: 'data_augmentation',
            method: 'baseline_based',
            confidence: 0.6
          }
        });
      }
    }
  });

  return generated;
}

/**
 * 데이터 품질 리포트 생성
 * @param {string} unitId - 지역 ID (선택적)
 * @param {string} startDate - 시작 날짜
 * @param {string} endDate - 종료 날짜
 * @returns {Object} 데이터 품질 리포트
 */
export async function generateDataQualityReport(unitId = null, startDate, endDate) {
  const query = unitId ? { unit_id: unitId } : {};
  
  // Human Signal 품질 체크
  const humanData = await SignalHuman.find({
    ...query,
    date: { $gte: startDate, $lte: endDate },
    signal_type: 'total'
  }).sort({ date: 1 }).lean();

  // Population Signal 품질 체크
  const popData = await SignalPopulation.find({
    ...query,
    date: { $gte: startDate, $lte: endDate }
  }).sort({ date: 1 }).lean();

  // 날짜 범위 생성
  const dates = eachDayOfInterval({
    start: parseISO(startDate),
    end: parseISO(endDate)
  });
  const expectedDays = dates.length;

  // 결측치 계산
  const humanDates = new Set(humanData.map(d => d.date));
  const popDates = new Set(popData.map(d => d.date));
  
  const humanMissing = expectedDays - humanDates.size;
  const popMissing = expectedDays - popDates.size;

  // 데이터 완전성 점수 (0-100)
  const humanCompleteness = (humanDates.size / expectedDays) * 100;
  const popCompleteness = (popDates.size / expectedDays) * 100;

  // 이상치 감지 (Z-score > 3)
  const humanValues = humanData.map(d => d.value);
  const humanMean = humanValues.reduce((a, b) => a + b, 0) / humanValues.length;
  const humanStd = Math.sqrt(
    humanValues.reduce((sum, val) => sum + Math.pow(val - humanMean, 2), 0) / humanValues.length
  );
  const humanOutliers = humanData.filter(d => 
    Math.abs((d.value - humanMean) / humanStd) > 3
  ).length;

  return {
    period: { start: startDate, end: endDate, expected_days: expectedDays },
    human_signal: {
      total_records: humanData.length,
      missing_days: humanMissing,
      completeness: humanCompleteness.toFixed(2),
      outliers: humanOutliers,
      quality_score: Math.max(0, humanCompleteness - (humanOutliers / humanData.length) * 10)
    },
    population_signal: {
      total_records: popData.length,
      missing_days: popMissing,
      completeness: popCompleteness.toFixed(2),
      quality_score: popCompleteness
    },
    overall_quality: {
      score: ((humanCompleteness + popCompleteness) / 2).toFixed(2),
      grade: getQualityGrade((humanCompleteness + popCompleteness) / 2)
    }
  };
}

function getQualityGrade(score) {
  if (score >= 90) return 'A';
  if (score >= 80) return 'B';
  if (score >= 70) return 'C';
  if (score >= 60) return 'D';
  return 'F';
}

