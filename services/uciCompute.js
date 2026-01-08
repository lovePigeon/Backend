import SignalHuman from '../models/SignalHuman.js';
import SignalGeo from '../models/SignalGeo.js';
import SignalPopulation from '../models/SignalPopulation.js';
import ComfortIndex from '../models/ComfortIndex.js';
import SpatialUnit from '../models/SpatialUnit.js';
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

  // 컴포넌트 점수 계산
  const { score: humanScore, normalized: humanNorm } = computeHumanScore(humanData, windowDays);
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

  // 설명 생성
  const explain = generateExplain(humanData, geoData, popData, humanScore, geoScore, popScore, windowWeeks);

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

function computeHumanScore(data, windowDays) {
  if (!data || data.length === 0) return { score: null, normalized: {} };

  const totalComplaints = data.reduce((sum, d) => sum + (d.complaint_total || 0), 0);
  const odorComplaints = data.reduce((sum, d) => sum + (d.complaint_odor || 0), 0);
  const trashComplaints = data.reduce((sum, d) => sum + (d.complaint_trash || 0), 0);
  const illegalDump = data.reduce((sum, d) => sum + (d.complaint_illegal_dump || 0), 0);

  const nightRatios = data.filter(d => d.night_ratio !== null && d.night_ratio !== undefined).map(d => d.night_ratio);
  const repeatRatios = data.filter(d => d.repeat_ratio !== null && d.repeat_ratio !== undefined).map(d => d.repeat_ratio);

  const avgNightRatio = nightRatios.length > 0 ? nightRatios.reduce((a, b) => a + b, 0) / nightRatios.length : 0;
  const avgRepeatRatio = repeatRatios.length > 0 ? repeatRatios.reduce((a, b) => a + b, 0) / repeatRatios.length : 0;

  // 증가율 계산
  let growthRate = 0;
  if (data.length >= 2) {
    const firstHalf = data.slice(0, Math.floor(data.length / 2));
    const secondHalf = data.slice(Math.floor(data.length / 2));
    const firstTotal = firstHalf.reduce((sum, d) => sum + (d.complaint_total || 0), 0);
    const secondTotal = secondHalf.reduce((sum, d) => sum + (d.complaint_total || 0), 0);
    growthRate = firstTotal > 0 ? (secondTotal - firstTotal) / firstTotal : 0;
  }

  const normalized = {
    total_complaints: Math.min(1.0, (totalComplaints / windowDays) / 10.0),
    odor_ratio: totalComplaints > 0 ? odorComplaints / totalComplaints : 0,
    trash_ratio: totalComplaints > 0 ? trashComplaints / totalComplaints : 0,
    illegal_dump_ratio: totalComplaints > 0 ? illegalDump / totalComplaints : 0,
    night_ratio: avgNightRatio,
    repeat_ratio: avgRepeatRatio,
    growth_rate: Math.min(1.0, Math.max(0, growthRate) / 0.5)
  };

  const humanScore = (
    normalized.total_complaints * 0.2 +
    normalized.odor_ratio * 0.2 +
    normalized.trash_ratio * 0.15 +
    normalized.illegal_dump_ratio * 0.15 +
    normalized.night_ratio * 0.15 +
    normalized.repeat_ratio * 0.15
  );

  return { score: humanScore, normalized };
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

function generateExplain(humanData, geoData, popData, humanScore, geoScore, popScore, windowWeeks) {
  const drivers = [];
  const summaryParts = [];

  if (humanScore && humanScore > 0.5 && humanData && humanData.length > 0) {
    const total = humanData.reduce((sum, d) => sum + (d.complaint_total || 0), 0);
    const odor = humanData.reduce((sum, d) => sum + (d.complaint_odor || 0), 0);
    const nightRatios = humanData.filter(d => d.night_ratio !== null).map(d => d.night_ratio);
    const nightAvg = nightRatios.length > 0 ? nightRatios.reduce((a, b) => a + b, 0) / nightRatios.length : 0;

    if (odor > 0) {
      summaryParts.push(`악취 민원 ${odor}건`);
      drivers.push({ signal: 'complaint_odor', value: Math.round((odor / total) * 100) / 100 });
    }

    if (nightAvg > 0.6) {
      summaryParts.push(`야간 집중도 ${Math.round(nightAvg * 100)}%`);
      drivers.push({ signal: 'night_ratio', value: Math.round(nightAvg * 100) / 100 });
    }
  }

  if (geoScore && geoScore > 0.5 && geoData) {
    if (geoData.alley_density && geoData.alley_density > 50) {
      summaryParts.push('골목 밀도 상위');
      drivers.push({ signal: 'alley_density', value: Math.round(geoData.alley_density * 100) / 100 });
    }
  }

  if (popScore && popScore > 0.5 && popData && popData.length > 0) {
    const changeRates = popData.filter(d => d.pop_change_rate !== null).map(d => d.pop_change_rate);
    if (changeRates.length > 0) {
      const avgChange = changeRates.reduce((a, b) => a + b, 0) / changeRates.length;
      if (avgChange > 0.1) {
        summaryParts.push(`생활인구 증가 ${Math.round(avgChange * 100)}%`);
        drivers.push({ signal: 'pop_change_rate', value: Math.round(avgChange * 100) / 100 });
      }
    }
  }

  const whySummary = summaryParts.length > 0 ? summaryParts.join(', ') : `최근 ${windowWeeks}주간 신호 분석`;

  return {
    why_summary: whySummary,
    key_drivers: drivers
  };
}

