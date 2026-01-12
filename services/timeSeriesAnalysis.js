/**
 * Time Series Analysis Service
 * 
 * 시계열 분석 및 트렌드 예측을 위한 서비스
 * - 이동평균 (Moving Average)
 * - 선형 회귀 기반 트렌드 예측
 * - 계절성 분석
 * - 변화율 계산
 * 
 * 발표 포인트:
 * - 데이터 분석 역량 (시계열 분석)
 * - 예측 모델 (무료 로컬, 통계 기반)
 * - 트렌드 감지 및 시각화 데이터 제공
 */

import SignalHuman from '../models/SignalHuman.js';
import ComfortIndex from '../models/ComfortIndex.js';
import SignalPopulation from '../models/SignalPopulation.js';
import { format, subDays, parseISO, addDays } from 'date-fns';

/**
 * 이동평균 계산 (Moving Average)
 * @param {Array} data - 시계열 데이터 배열
 * @param {number} window - 윈도우 크기 (일 수)
 * @returns {Array} 이동평균 배열
 */
export function calculateMovingAverage(data, window = 7) {
  if (data.length < window) return data;
  
  const result = [];
  for (let i = 0; i < data.length; i++) {
    if (i < window - 1) {
      result.push(data[i].value);
    } else {
      const windowData = data.slice(i - window + 1, i + 1);
      const avg = windowData.reduce((sum, d) => sum + d.value, 0) / window;
      result.push(avg);
    }
  }
  return result;
}

/**
 * 선형 회귀를 사용한 트렌드 예측
 * @param {Array} data - 시계열 데이터 [{date, value}, ...]
 * @param {number} forecastDays - 예측할 일 수
 * @returns {Object} 예측 결과
 */
export function predictTrend(data, forecastDays = 7) {
  if (data.length < 2) {
    return {
      trend: 'stable',
      slope: 0,
      forecast: [],
      confidence: 0
    };
  }

  // 날짜를 숫자로 변환 (일 수)
  const n = data.length;
  const x = data.map((d, i) => i);
  const y = data.map(d => d.value);

  // 선형 회귀: y = ax + b
  const xMean = x.reduce((a, b) => a + b, 0) / n;
  const yMean = y.reduce((a, b) => a + b, 0) / n;

  let numerator = 0;
  let denominator = 0;

  for (let i = 0; i < n; i++) {
    numerator += (x[i] - xMean) * (y[i] - yMean);
    denominator += Math.pow(x[i] - xMean, 2);
  }

  const slope = denominator !== 0 ? numerator / denominator : 0;
  const intercept = yMean - slope * xMean;

  // 트렌드 판단
  let trend = 'stable';
  if (slope > 0.1) trend = 'increasing';
  else if (slope < -0.1) trend = 'decreasing';

  // 예측값 계산
  const forecast = [];
  const lastDate = parseISO(data[data.length - 1].date);
  
  for (let i = 1; i <= forecastDays; i++) {
    const futureX = n + i - 1;
    const predictedValue = slope * futureX + intercept;
    const futureDate = format(addDays(lastDate, i), 'yyyy-MM-dd');
    
    forecast.push({
      date: futureDate,
      value: Math.max(0, predictedValue), // 음수 방지
      confidence: Math.max(0, 1 - (i / forecastDays) * 0.5) // 멀수록 신뢰도 감소
    });
  }

  // 신뢰도 계산 (R² 근사)
  const ssRes = y.reduce((sum, yi, i) => {
    const predicted = slope * x[i] + intercept;
    return sum + Math.pow(yi - predicted, 2);
  }, 0);
  const ssTot = y.reduce((sum, yi) => sum + Math.pow(yi - yMean, 2), 0);
  const rSquared = ssTot > 0 ? 1 - (ssRes / ssTot) : 0;

  return {
    trend,
    slope,
    intercept,
    forecast,
    confidence: Math.max(0, Math.min(1, rSquared)),
    rSquared
  };
}

/**
 * 계절성 분석 (요일별, 월별 패턴)
 * @param {Array} data - 시계열 데이터
 * @returns {Object} 계절성 패턴
 */
export function analyzeSeasonality(data) {
  const dayOfWeekPattern = { 0: [], 1: [], 2: [], 3: [], 4: [], 5: [], 6: [] };
  const monthlyPattern = {};

  data.forEach(d => {
    const date = parseISO(d.date);
    const dayOfWeek = date.getDay();
    const month = format(date, 'yyyy-MM');

    if (dayOfWeekPattern[dayOfWeek] !== undefined) {
      dayOfWeekPattern[dayOfWeek].push(d.value);
    }

    if (!monthlyPattern[month]) {
      monthlyPattern[month] = [];
    }
    monthlyPattern[month].push(d.value);
  });

  // 평균 계산
  const dayOfWeekAvg = {};
  Object.keys(dayOfWeekPattern).forEach(day => {
    const values = dayOfWeekPattern[day];
    dayOfWeekAvg[day] = values.length > 0
      ? values.reduce((a, b) => a + b, 0) / values.length
      : 0;
  });

  const monthlyAvg = {};
  Object.keys(monthlyPattern).forEach(month => {
    const values = monthlyPattern[month];
    monthlyAvg[month] = values.length > 0
      ? values.reduce((a, b) => a + b, 0) / values.length
      : 0;
  });

  return {
    dayOfWeek: dayOfWeekAvg,
    monthly: monthlyAvg,
    peakDay: Object.keys(dayOfWeekAvg).reduce((a, b) => 
      dayOfWeekAvg[a] > dayOfWeekAvg[b] ? a : b
    ),
    peakMonth: Object.keys(monthlyAvg).reduce((a, b) => 
      monthlyAvg[a] > monthlyAvg[b] ? a : b
    )
  };
}

/**
 * UCI 트렌드 분석 및 예측
 * @param {string} unitId - 지역 ID
 * @param {number} days - 분석 기간 (일)
 * @param {number} forecastDays - 예측 기간 (일)
 * @returns {Object} 트렌드 분석 결과
 */
export async function analyzeUCITrend(unitId, days = 30, forecastDays = 7) {
  // 먼저 실제 데이터가 있는 날짜 범위 확인
  const allData = await ComfortIndex.find({ unit_id: unitId })
    .sort({ date: 1 })
    .select('date uci_score uci_grade')
    .lean();

  if (allData.length === 0) {
    return {
      unit_id: unitId,
      hasData: false,
      message: '해당 지역에 UCI 데이터가 없습니다.'
    };
  }

  // 실제 데이터가 있는 최신 날짜를 기준으로 분석
  const latestDataDate = parseISO(allData[allData.length - 1].date);
  const endDate = latestDataDate;
  const startDate = subDays(endDate, days);
  const startDateStr = format(startDate, 'yyyy-MM-dd');
  const endDateStr = format(latestDataDate, 'yyyy-MM-dd');

  // 요청한 기간 내의 데이터 조회
  const uciData = allData.filter(d => {
    const dDate = parseISO(d.date);
    return dDate >= startDate && dDate <= latestDataDate;
  });

  if (uciData.length === 0) {
    // 요청한 기간에 데이터가 없음
    if (allData.length === 0) {
      return {
        unit_id: unitId,
        hasData: false,
        message: '해당 지역에 UCI 데이터가 없습니다.'
      };
    }
    
    // 다른 기간에 데이터가 있음
    const firstDate = allData[0].date;
    const lastDate = allData[allData.length - 1].date;
    return {
      unit_id: unitId,
      hasData: false,
      message: `요청한 기간(${startDateStr} ~ ${endDateStr})에 데이터가 없습니다.`,
      available_period: {
        start: firstDate,
        end: lastDate,
        total_days: allData.length
      },
      suggestion: `다음과 같이 요청해보세요: days=${Math.ceil((new Date() - new Date(lastDate)) / (1000 * 60 * 60 * 24))}`
    };
  }

  // 데이터가 1개만 있는 경우 - 기본 정보만 제공
  if (uciData.length === 1) {
    const singleData = uciData[0];
    return {
      unit_id: unitId,
      hasData: true,
      data_quality: 'limited', // 제한적 데이터
      message: '트렌드 분석을 위해서는 최소 2일 이상의 데이터가 필요합니다.',
      period: {
        start: startDateStr,
        end: endDateStr,
        days: days,
        actual_data_days: 1
      },
      current: {
        uci_score: singleData.uci_score,
        uci_grade: singleData.uci_grade,
        date: singleData.date
      },
      trend: {
        direction: 'unknown',
        slope: 0,
        change_rate: '0.00',
        confidence: 0,
        message: '데이터 부족으로 트렌드 분석 불가'
      },
      forecast: [],
      moving_averages: {
        ma7: [],
        ma14: []
      },
      seasonality: {},
      statistics: {
        min: singleData.uci_score,
        max: singleData.uci_score,
        mean: singleData.uci_score,
        std: 0
      },
      available_period: allData.length > 1 ? {
        start: allData[0].date,
        end: allData[allData.length - 1].date,
        total_days: allData.length
      } : null
    };
  }

  // 시계열 데이터 변환
  const timeSeries = uciData.map(d => ({
    date: d.date,
    value: d.uci_score
  }));

  // 이동평균 계산
  const movingAvg7 = calculateMovingAverage(timeSeries, 7);
  const movingAvg14 = calculateMovingAverage(timeSeries, 14);

  // 트렌드 예측
  const prediction = predictTrend(timeSeries, forecastDays);

  // 계절성 분석
  const seasonality = analyzeSeasonality(timeSeries);

  // 변화율 계산
  const firstValue = timeSeries[0].value;
  const lastValue = timeSeries[timeSeries.length - 1].value;
  const changeRate = firstValue > 0 
    ? ((lastValue - firstValue) / firstValue) * 100 
    : 0;

  return {
    unit_id: unitId,
    hasData: true,
    data_quality: 'sufficient', // 충분한 데이터
    period: {
      start: startDateStr,
      end: endDateStr,
      days: days,
      actual_data_days: uciData.length
    },
    current: {
      uci_score: lastValue,
      uci_grade: uciData[uciData.length - 1].uci_grade
    },
    trend: {
      direction: prediction.trend,
      slope: prediction.slope,
      change_rate: changeRate.toFixed(2),
      confidence: prediction.confidence
    },
    moving_averages: {
      ma7: movingAvg7.map((val, i) => ({
        date: timeSeries[i].date,
        value: val
      })),
      ma14: movingAvg14.map((val, i) => ({
        date: timeSeries[i].date,
        value: val
      }))
    },
    forecast: prediction.forecast,
    seasonality,
    statistics: {
      min: Math.min(...timeSeries.map(d => d.value)),
      max: Math.max(...timeSeries.map(d => d.value)),
      mean: timeSeries.reduce((sum, d) => sum + d.value, 0) / timeSeries.length,
      std: calculateStandardDeviation(timeSeries.map(d => d.value))
    }
  };
}

/**
 * 표준편차 계산
 */
function calculateStandardDeviation(values) {
  const mean = values.reduce((a, b) => a + b, 0) / values.length;
  const variance = values.reduce((sum, val) => sum + Math.pow(val - mean, 2), 0) / values.length;
  return Math.sqrt(variance);
}

/**
 * 민원 데이터 트렌드 분석
 */
export async function analyzeComplaintTrend(unitId, days = 30, forecastDays = 7) {
  const endDate = new Date();
  const startDate = subDays(endDate, days);
  const startDateStr = format(startDate, 'yyyy-MM-dd');
  const endDateStr = format(endDate, 'yyyy-MM-dd');

  const complaintData = await SignalHuman.find({
    unit_id: unitId,
    date: { $gte: startDateStr, $lte: endDateStr },
    signal_type: 'total'
  })
    .sort({ date: 1 })
    .lean();

  // 전체 데이터 확인
  const allData = await SignalHuman.find({ 
    unit_id: unitId,
    signal_type: 'total'
  })
    .sort({ date: 1 })
    .select('date value')
    .lean();

  if (complaintData.length === 0) {
    if (allData.length === 0) {
      return {
        unit_id: unitId,
        hasData: false,
        message: '해당 지역에 민원 데이터가 없습니다.'
      };
    }
    
    const firstDate = allData[0].date;
    const lastDate = allData[allData.length - 1].date;
    return {
      unit_id: unitId,
      hasData: false,
      message: `요청한 기간(${startDateStr} ~ ${endDateStr})에 데이터가 없습니다.`,
      available_period: {
        start: firstDate,
        end: lastDate,
        total_days: allData.length
      }
    };
  }

  if (complaintData.length === 1) {
    const singleData = complaintData[0];
    return {
      unit_id: unitId,
      hasData: true,
      data_quality: 'limited',
      message: '트렌드 분석을 위해서는 최소 2일 이상의 데이터가 필요합니다.',
      current: {
        total_complaints: singleData.value,
        date: singleData.date
      },
      trend: {
        direction: 'unknown',
        slope: 0,
        confidence: 0,
        message: '데이터 부족으로 트렌드 분석 불가'
      },
      forecast: [],
      seasonality: {},
      available_period: allData.length > 1 ? {
        start: allData[0].date,
        end: allData[allData.length - 1].date,
        total_days: allData.length
      } : null
    };
  }

  const timeSeries = complaintData.map(d => ({
    date: d.date,
    value: d.value
  }));

  const prediction = predictTrend(timeSeries, forecastDays);
  const seasonality = analyzeSeasonality(timeSeries);

  return {
    unit_id: unitId,
    hasData: true,
    current: {
      total_complaints: timeSeries[timeSeries.length - 1].value
    },
    trend: {
      direction: prediction.trend,
      slope: prediction.slope,
      confidence: prediction.confidence
    },
    forecast: prediction.forecast,
    seasonality
  };
}

