import SignalHuman from '../models/SignalHuman.js';
import SignalGeo from '../models/SignalGeo.js';
import SignalPopulation from '../models/SignalPopulation.js';
import ComfortIndex from '../models/ComfortIndex.js';
import SpatialUnit from '../models/SpatialUnit.js';
import BaselineMetric from '../models/BaselineMetric.js';
import { settings } from '../config/settings.js';
import { subDays, format, parseISO } from 'date-fns';

export async function computeUCIForUnit(unitId, date, windowWeeks = 4, usePigeon = false) {
  const targetDate = typeof date === 'string' ? parseISO(date) : date;
  const windowDays = windowWeeks * 7;
  const startDate = subDays(targetDate, windowDays);
  const endDate = format(targetDate, 'yyyy-MM-dd');
  const startDateStr = format(startDate, 'yyyy-MM-dd');

  // 신호 수집
  const humanData = await SignalHuman.find({
    unit_id: unitId,
    date: { $gte: startDateStr, $lte: endDate }
  }).sort({ date: 1 });

  const geoData = await SignalGeo.findById(unitId);
  
  const popData = await SignalPopulation.find({
    unit_id: unitId,
    date: { $gte: startDateStr, $lte: endDate }
  }).sort({ date: 1 });

  // 컴포넌트 점수 계산 (베이스라인 보정 포함)
  const { score: humanScore, normalized: humanNorm, baseline: humanBaseline } = await computeHumanScore(humanData, windowDays, endDate);
  const { score: geoScore, normalized: geoNorm } = computeGeoScore(geoData);
  const { score: popScore, normalized: popNorm } = computePopulationScore(popData, windowDays);

  // 가중치 조정
  let weights = { ...settings.uciWeights };
  if (!usePigeon) {
    weights.pigeon = 0.0;
    const total = weights.human + weights.geo + weights.population;
    if (total > 0) {
      weights.human = weights.human / total;
      weights.geo = weights.geo / total;
      weights.population = weights.population / total;
    }
  }

  // 최종 UCI 점수 계산
  const scores = [];
  const weightList = [];

  if (humanScore !== null) {
    scores.push(humanScore);
    weightList.push(weights.human);
  }
  if (geoScore !== null) {
    scores.push(geoScore);
    weightList.push(weights.geo);
  }
  if (popScore !== null) {
    scores.push(popScore);
    weightList.push(weights.population);
  }

  if (scores.length === 0) {
    return null;
  }

  // 가중치 재정규화
  const totalWeight = weightList.reduce((a, b) => a + b, 0);
  const normalizedWeights = totalWeight > 0 ? weightList.map(w => w / totalWeight) : weightList;

  const uciScore = scores.reduce((sum, score, i) => sum + score * normalizedWeights[i], 0) * 100;
  const uciGrade = getGrade(uciScore);

  // 설명 생성 (베이스라인 정보 포함)
  const explain = generateExplain(humanData, geoData, popData, humanScore, geoScore, popScore, windowWeeks, humanBaseline);

  return {
    unit_id: unitId,
    date: endDate,
    uci_score: Math.round(uciScore * 100) / 100,
    uci_grade: uciGrade,
    components: {
      human_score: humanScore,
      geo_score: geoScore,
      population_score: popScore,
      pigeon_score: null,
      human_normalized: humanNorm,
      geo_normalized: geoNorm,
      population_normalized: popNorm,
      pigeon_normalized: {},
      weights: weights
    },
    explain: explain
  };
}

async function computeHumanScore(data, windowDays, targetDate = null) {
  if (!data || data.length === 0) return { score: null, normalized: {} };

  // signal_type별로 데이터 분리
  const totalSignals = data.filter(d => d.signal_type === 'total');
  const odorSignals = data.filter(d => d.signal_type === 'odor');
  const trashSignals = data.filter(d => d.signal_type === 'trash');
  const illegalSignals = data.filter(d => d.signal_type === 'illegal_dumping');
  const nightRatioSignals = data.filter(d => d.signal_type === 'night_ratio');
  const repeatRatioSignals = data.filter(d => d.signal_type === 'repeat_ratio');

  const totalComplaints = totalSignals.reduce((sum, d) => sum + (d.value || 0), 0);
  const odorComplaints = odorSignals.reduce((sum, d) => sum + (d.value || 0), 0);
  const trashComplaints = trashSignals.reduce((sum, d) => sum + (d.value || 0), 0);
  const illegalDump = illegalSignals.reduce((sum, d) => sum + (d.value || 0), 0);

  const nightRatios = nightRatioSignals.map(d => d.value).filter(v => v !== null && v !== undefined);
  const repeatRatios = repeatRatioSignals.map(d => d.value).filter(v => v !== null && v !== undefined);

  const avgNightRatio = nightRatios.length > 0 ? nightRatios.reduce((a, b) => a + b, 0) / nightRatios.length : 0;
  const avgRepeatRatio = repeatRatios.length > 0 ? repeatRatios.reduce((a, b) => a + b, 0) / repeatRatios.length : 0;

  // 지역 내부 증가율 계산
  let unitGrowthRate = 0;
  if (totalSignals.length >= 2) {
    const firstHalf = totalSignals.slice(0, Math.floor(totalSignals.length / 2));
    const secondHalf = totalSignals.slice(Math.floor(totalSignals.length / 2));
    const firstTotal = firstHalf.reduce((sum, d) => sum + (d.value || 0), 0);
    const secondTotal = secondHalf.reduce((sum, d) => sum + (d.value || 0), 0);
    unitGrowthRate = firstTotal > 0 ? (secondTotal - firstTotal) / firstTotal : 0;
  }

  // 베이스라인 조회 (선택적, targetDate가 있으면)
  let baselineData = null;
  let relativeToBaseline = 1.0;
  let excessGrowthRate = 0;
  
  if (targetDate) {
    const period = format(parseISO(targetDate), 'yyyy-MM');
    baselineData = await BaselineMetric.findOne({ 
      period, 
      category: '전체' 
    });
    
    if (baselineData) {
      // 단위당 평균 계산
      const unitAvgComplaints = totalComplaints / windowDays;
      const baselineAvg = baselineData.citywide_avg_per_unit || (baselineData.citywide_total / 37);
      
      if (baselineAvg > 0) {
        relativeToBaseline = Math.min(3.0, unitAvgComplaints / baselineAvg); // 최대 3배로 제한
      }
      
      // 초과 증가율 계산
      const baselineGrowthRate = baselineData.growth_rate || 0;
      excessGrowthRate = Math.max(0, unitGrowthRate - baselineGrowthRate);
    }
  }

  const normalized = {
    total_complaints: Math.min(1.0, (totalComplaints / windowDays) / 10.0),
    odor_ratio: totalComplaints > 0 ? odorComplaints / totalComplaints : 0,
    trash_ratio: totalComplaints > 0 ? trashComplaints / totalComplaints : 0,
    illegal_dump_ratio: totalComplaints > 0 ? illegalDump / totalComplaints : 0,
    night_ratio: avgNightRatio,
    repeat_ratio: avgRepeatRatio,
    growth_rate: Math.min(1.0, Math.max(0, unitGrowthRate) / 0.5),
    // 베이스라인 보정 지표 (신규)
    relative_to_baseline: relativeToBaseline,
    excess_growth_rate: Math.min(1.0, excessGrowthRate / 0.3) // 30%p 초과 = 1.0
  };

  // 가중치 재조정 (베이스라인 보정 추가)
  const humanScore = (
    normalized.total_complaints * 0.15 +           // 절대값 (가중치 감소)
    normalized.relative_to_baseline * 0.20 +       // 베이스라인 대비 (신규)
    normalized.excess_growth_rate * 0.15 +          // 초과 증가율 (신규)
    normalized.odor_ratio * 0.15 +                  // 기존 (가중치 감소)
    normalized.trash_ratio * 0.12 +                 // 기존 (가중치 감소)
    normalized.illegal_dump_ratio * 0.12 +         // 기존 (가중치 감소)
    normalized.night_ratio * 0.11                   // 기존 (가중치 감소)
  );

  return { 
    score: humanScore, 
    normalized,
    baseline: baselineData ? {
      period: baselineData.period,
      citywide_total: baselineData.citywide_total,
      growth_rate: baselineData.growth_rate
    } : null
  };
}

function computeGeoScore(data) {
  if (!data) return { score: null, normalized: {} };

  const values = {
    alley_density: data.alley_density || 0,
    backroad_ratio: data.backroad_ratio || 0,
    ventilation_proxy: data.ventilation_proxy || 0,
    accessibility_proxy: data.accessibility_proxy || 0,
    landuse_mix: data.landuse_mix || 0
  };

  const normalized = {
    alley_density: Math.min(1.0, values.alley_density / 100.0),
    backroad_ratio: values.backroad_ratio,
    ventilation_proxy: Math.min(1.0, Math.max(0, 1 - values.ventilation_proxy / 10.0)),
    accessibility_proxy: Math.min(1.0, Math.max(0, 1 - values.accessibility_proxy / 10.0)),
    landuse_mix: values.landuse_mix
  };

  const geoScore = (
    normalized.alley_density * 0.3 +
    normalized.backroad_ratio * 0.25 +
    normalized.ventilation_proxy * 0.2 +
    normalized.accessibility_proxy * 0.15 +
    normalized.landuse_mix * 0.1
  );

  return { score: geoScore, normalized };
}

function computePopulationScore(data, windowDays) {
  if (!data || data.length === 0) return { score: null, normalized: {} };

  const totalPop = data.reduce((sum, d) => sum + (d.pop_total || 0), 0);
  const nightPop = data.reduce((sum, d) => sum + (d.pop_night || 0), 0);
  const changeRates = data.filter(d => d.pop_change_rate !== null && d.pop_change_rate !== undefined).map(d => d.pop_change_rate);
  const avgChangeRate = changeRates.length > 0 ? changeRates.reduce((a, b) => a + b, 0) / changeRates.length : 0;

  const avgTotal = totalPop / data.length;
  const avgNight = nightPop / data.length;
  const nightRatio = avgTotal > 0 ? avgNight / avgTotal : 0;

  const normalized = {
    avg_total: Math.min(1.0, avgTotal / 10000.0),
    night_ratio: nightRatio,
    change_rate: Math.min(1.0, Math.max(0, avgChangeRate) / 0.3)
  };

  const popScore = (
    normalized.avg_total * 0.3 +
    normalized.night_ratio * 0.4 +
    normalized.change_rate * 0.3
  );

  return { score: popScore, normalized };
}

function getGrade(score) {
  if (score < 20) return 'A';
  if (score < 40) return 'B';
  if (score < 60) return 'C';
  if (score < 80) return 'D';
  return 'E';
}

function generateExplain(humanData, geoData, popData, humanScore, geoScore, popScore, windowWeeks, baseline = null) {
  const drivers = [];
  const summaryParts = [];

  // Human 신호 분석 (조건 완화: humanScore > 0.5 제거, 데이터만 있으면 분석)
  if (humanData && humanData.length > 0) {
    const totalSignals = humanData.filter(d => d.signal_type === 'total');
    const odorSignals = humanData.filter(d => d.signal_type === 'odor');
    const trashSignals = humanData.filter(d => d.signal_type === 'trash');
    const nightRatioSignals = humanData.filter(d => d.signal_type === 'night_ratio');
    const repeatRatioSignals = humanData.filter(d => d.signal_type === 'repeat_ratio');
    
    const total = totalSignals.reduce((sum, d) => sum + (d.value || 0), 0);
    const odor = odorSignals.reduce((sum, d) => sum + (d.value || 0), 0);
    const trash = trashSignals.reduce((sum, d) => sum + (d.value || 0), 0);
    const nightRatios = nightRatioSignals.map(d => d.value).filter(v => v !== null && v !== undefined);
    const repeatRatios = repeatRatioSignals.map(d => d.value).filter(v => v !== null && v !== undefined);
    const nightAvg = nightRatios.length > 0 ? nightRatios.reduce((a, b) => a + b, 0) / nightRatios.length : 0;
    const repeatAvg = repeatRatios.length > 0 ? repeatRatios.reduce((a, b) => a + b, 0) / repeatRatios.length : 0;

    // 베이스라인 비교 문구 추가 (조건 완화)
    if (baseline && total > 0) {
      const unitAvg = total / (windowWeeks * 7);
      const baselineAvg = baseline.citywide_avg_per_unit || (baseline.citywide_total / 37);
      const relativeRatio = baselineAvg > 0 ? (unitAvg / baselineAvg) : 1.0;
      
      // 1.2배 이상이면 추가 (기존 1.5배에서 완화)
      if (relativeRatio > 1.2) {
        summaryParts.push(`서울시 평균 대비 ${Math.round(relativeRatio * 10) / 10}배 높은 신고량`);
        drivers.push({ 
          signal: 'relative_to_baseline', 
          value: Math.round(relativeRatio * 100) / 100 
        });
      }
      
      // 증가율 비교 (조건 완화: 0.05 이상이면 추가)
      if (totalSignals.length >= 2) {
        const firstHalf = totalSignals.slice(0, Math.floor(totalSignals.length / 2));
        const secondHalf = totalSignals.slice(Math.floor(totalSignals.length / 2));
        const firstTotal = firstHalf.reduce((sum, d) => sum + (d.value || 0), 0);
        const secondTotal = secondHalf.reduce((sum, d) => sum + (d.value || 0), 0);
        const unitGrowthRate = firstTotal > 0 ? (secondTotal - firstTotal) / firstTotal : 0;
        const baselineGrowthRate = baseline.growth_rate || 0;
        const excessGrowth = unitGrowthRate - baselineGrowthRate;
        
        if (excessGrowth > 0.05) {  // 0.1에서 0.05로 완화
          summaryParts.push(`서울시 전체 증가율 대비 ${Math.round(excessGrowth * 100)}%p 높은 증가`);
          drivers.push({ 
            signal: 'excess_growth_rate', 
            value: Math.round(excessGrowth * 100) / 100 
          });
        }
      }
    }

    // 민원 유형별 분석 (조건 완화)
    if (total > 0) {
      if (odor > 0 && odor / total > 0.1) {  // 0.3에서 0.1로 완화
        summaryParts.push(`악취 민원 ${odor}건`);
        drivers.push({ signal: 'complaint_odor', value: Math.round((odor / total) * 100) / 100 });
      }

      if (trash > 0 && trash / total > 0.1) {  // 0.3에서 0.1로 완화
        summaryParts.push(`쓰레기 민원 ${trash}건`);
        drivers.push({ signal: 'complaint_trash', value: Math.round((trash / total) * 100) / 100 });
      }
    }

    // 야간/반복 비율 분석 (조건 완화)
    if (nightAvg > 0.4) {  // 0.6에서 0.4로 완화
      summaryParts.push(`야간 집중도 ${Math.round(nightAvg * 100)}%`);
      drivers.push({ signal: 'night_ratio', value: Math.round(nightAvg * 100) / 100 });
    }

    if (repeatAvg > 0.3) {  // 0.5에서 0.3으로 완화
      summaryParts.push(`반복 신고 비율 ${Math.round(repeatAvg * 100)}%`);
      drivers.push({ signal: 'repeat_ratio', value: Math.round(repeatAvg * 100) / 100 });
    }

    // 총 민원 건수 (항상 추가)
    if (total > 0) {
      drivers.push({ signal: 'total_complaints', value: total });
    }
  }

  // Geo 신호 분석 (조건 완화)
  if (geoData) {
    if (geoData.alley_density && geoData.alley_density > 30) {  // 50에서 30으로 완화
      summaryParts.push('골목 밀도 상위');
      drivers.push({ signal: 'alley_density', value: Math.round(geoData.alley_density * 100) / 100 });
    }

    if (geoData.backroad_ratio && geoData.backroad_ratio > 0.3) {
      drivers.push({ signal: 'backroad_ratio', value: Math.round(geoData.backroad_ratio * 100) / 100 });
    }
  }

  // Population 신호 분석 (조건 완화)
  if (popData && popData.length > 0) {
    const changeRates = popData.filter(d => d.pop_change_rate !== null && d.pop_change_rate !== undefined).map(d => d.pop_change_rate);
    if (changeRates.length > 0) {
      const avgChange = changeRates.reduce((a, b) => a + b, 0) / changeRates.length;
      if (avgChange > 0.05) {  // 0.1에서 0.05로 완화
        summaryParts.push(`생활인구 증가 ${Math.round(avgChange * 100)}%`);
        drivers.push({ signal: 'pop_change_rate', value: Math.round(avgChange * 100) / 100 });
      }
    }
  }

  const whySummary = summaryParts.length > 0 
    ? summaryParts.join(', ') 
    : `최근 ${windowWeeks}주간 신호 분석`;

  return {
    why_summary: whySummary,
    key_drivers: drivers,
    baseline_reference: baseline ? {
      period: baseline.period,
      citywide_total: baseline.citywide_total
    } : null
  };
}

