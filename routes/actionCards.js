import express from 'express';
import ComfortIndex from '../models/ComfortIndex.js';
import SignalHuman from '../models/SignalHuman.js';
import SignalGeo from '../models/SignalGeo.js';
import SignalPopulation from '../models/SignalPopulation.js';
import BaselineMetric from '../models/BaselineMetric.js';
import { subDays, format, parseISO } from 'date-fns';

const router = express.Router();

// POST /generate는 백엔드 내부용이므로 제거됨
// 프론트엔드는 GET /api/v1/action-cards만 사용

/**
 * @swagger
 * /api/v1/action-cards:
 *   get:
 *     summary: Action Cards 조회
 *     tags: [Action Cards]
 *     parameters:
 *       - in: query
 *         name: date
 *         required: true
 *         schema:
 *           type: string
 *           format: date
 *       - in: query
 *         name: unit_id
 *         schema:
 *           type: string
 *     responses:
 *       200:
 *         description: Action cards 목록
 *         content:
 *           application/json:
 *             examples:
 *               cards:
 *                 value:
 *                   - card_id: "AC-11110515-2026-01-08"
 *                     unit_id: "11110515"
 *                     date: "2026-01-08"
 *                     title: "야간 악취 민원 급증: 야간/주말 집중 점검 권고"
 *                     why: "악취 민원 증가율이 높고(상위 5%), 야간 집중도가 높아 야간 배출/관리 공백 가능성이 큼"
 *                     recommended_actions:
 *                       - "야간(20~02시) 집중 청소/수거"
 *                       - "주말 민원 다발 시간대 순찰 강화"
 *                     tags:
 *                       - "night_spike"
 *                       - "odor"
 *                     confidence: 0.78
 *                     limitations:
 *                       - "이벤트/상권 영향 가능"
 *                       - "민원 데이터는 사후 신고 기반"
 */
router.get('/', async (req, res) => {
  try {
    const { date, unit_id } = req.query;
    const unitIds = unit_id ? [unit_id] : null;
    
    const query = { date };
    if (unitIds) {
      query.unit_id = { $in: unitIds };
    }

    const comfortIndices = await ComfortIndex.find(query).sort({ uci_score: -1 });
    const cards = [];

    for (const ci of comfortIndices) {
      const card = await generateCardForUnit(ci, date, false);
      if (card) {
        cards.push(card);
      }
    }

    res.json(cards);
  } catch (error) {
    res.status(500).json({
      success: false,
      message: 'Action cards 조회 중 오류가 발생했습니다.',
      error: error.message
    });
  }
});

async function generateCardForUnit(comfortIndex, date, usePigeon) {
  const unitId = comfortIndex.unit_id;
  const targetDate = new Date(date);
  const windowDays = 28;

  const startDate = format(subDays(targetDate, windowDays), 'yyyy-MM-dd');

  const humanData = await SignalHuman.find({
    unit_id: unitId,
    date: { $gte: startDate, $lte: date }
  }).sort({ date: -1 }).limit(200); // signal_type별로 분리되어 더 많은 데이터 필요

  const geoData = await SignalGeo.findById(unitId);
  
  const popData = await SignalPopulation.find({
    unit_id: unitId,
    date: { $gte: startDate, $lte: date }
  }).sort({ date: -1 }).limit(28);

  const cardId = `AC-${unitId}-${date}`;
  const titleParts = [];
  const whyParts = [];
  const actions = [];
  const tags = [];
  const limitations = ['민원 데이터는 사후 신고 기반'];

  // Human 신호 분석 (signal_type별로 분리)
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

    const avgNight = nightRatios.length > 0 ? nightRatios.reduce((a, b) => a + b, 0) / nightRatios.length : 0;
    const avgRepeat = repeatRatios.length > 0 ? repeatRatios.reduce((a, b) => a + b, 0) / repeatRatios.length : 0;

    if (avgNight > 0.6) {
      titleParts.push('야간 민원 급증');
      whyParts.push(`야간 집중도 ${Math.round(avgNight * 100)}%로 높아 야간 배출/관리 공백 가능성`);
      actions.push('야간(20~02시) 집중 청소/수거');
      actions.push('주말 민원 다발 시간대 순찰 강화');
      tags.push('night_spike');
    }

    if (avgRepeat > 0.5) {
      titleParts.push('반복 민원');
      whyParts.push(`반복 신고 비율 ${Math.round(avgRepeat * 100)}%로 구조적 원인 가능성`);
      actions.push('반복 민원 지점 현장 기록 및 원인 분류');
      actions.push('부서 협업을 통한 구조 원인 조사');
      tags.push('repeat_issue');
    }

    if (odor > 0 && odor / total > 0.3) {
      titleParts.push('악취 민원');
      whyParts.push(`악취 민원 ${odor}건(${Math.round((odor / total) * 100)}%)`);
      actions.push('악취 발생 지점 현장 확인');
      actions.push('배출원 추적 및 관리');
      tags.push('odor');
    }

    if (trash > 0 && trash / total > 0.3) {
      titleParts.push('쓰레기 민원');
      whyParts.push(`쓰레기 민원 ${trash}건(${Math.round((trash / total) * 100)}%)`);
      actions.push('쓰레기통 위치/수거 동선 검토');
      tags.push('trash');
    }
  }

  // Geo 신호 분석
  if (geoData) {
    const alleyDensity = geoData.alley_density || 0;
    const backroadRatio = geoData.backroad_ratio || 0;

    if (alleyDensity > 50 || backroadRatio > 0.5) {
      titleParts.push('공간 취약');
      whyParts.push('골목/후면 도로 비율이 높아 관리 사각지대 가능성');
      actions.push('쓰레기통 위치/수거 동선 개선');
      actions.push('시설 개선 후보 지역 검토');
      tags.push('geo_vulnerable');
    }
  }

  // Population 신호 분석
  if (popData && popData.length > 0) {
    const changeRates = popData.filter(d => d.pop_change_rate !== null).map(d => d.pop_change_rate);
    if (changeRates.length > 0) {
      const avgChange = changeRates.reduce((a, b) => a + b, 0) / changeRates.length;
      if (avgChange > 0.1 && humanData && humanData.length > 0) {
        titleParts.push('인구 급증');
        whyParts.push(`생활인구 증가 ${Math.round(avgChange * 100)}%로 이벤트/상권 교란 가능성`);
        actions.push('단기 점검 및 모니터링 강화');
        tags.push('pop_surge');
        limitations.push('이벤트/상권 영향 가능');
      }
    }
  }

  const title = titleParts.length > 0
    ? titleParts.slice(0, 2).join(': ') + ' - 집중 점검 권고'
    : `UCI 점수 ${comfortIndex.uci_score.toFixed(1)}점: 모니터링 권고`;

  // 베이스라인 비교 문구 추가
  const baselineParts = [];
  try {
    const period = format(parseISO(date), 'yyyy-MM');
    const baseline = await BaselineMetric.findOne({ period, category: '전체' });
    
    if (baseline && humanData && humanData.length > 0) {
      const totalSignals = humanData.filter(d => d.signal_type === 'total');
      const total = totalSignals.reduce((sum, d) => sum + (d.value || 0), 0);
      const unitAvg = total / 28; // 4주 기준
      const baselineAvg = baseline.citywide_avg_per_unit || (baseline.citywide_total / 37);
      const relativeRatio = baselineAvg > 0 ? (unitAvg / baselineAvg) : 1.0;
      
      if (relativeRatio > 1.3) {
        baselineParts.push(`동일 분야의 서울시 평균 대비 ${Math.round(relativeRatio * 10) / 10}배 높은 신고량`);
      }
      
      // 증가율 비교
      if (totalSignals.length >= 2) {
        const firstHalf = totalSignals.slice(0, Math.floor(totalSignals.length / 2));
        const secondHalf = totalSignals.slice(Math.floor(totalSignals.length / 2));
        const firstTotal = firstHalf.reduce((sum, d) => sum + (d.value || 0), 0);
        const secondTotal = secondHalf.reduce((sum, d) => sum + (d.value || 0), 0);
        const unitGrowthRate = firstTotal > 0 ? (secondTotal - firstTotal) / firstTotal : 0;
        const baselineGrowthRate = baseline.growth_rate || 0;
        const excessGrowth = unitGrowthRate - baselineGrowthRate;
        
        if (excessGrowth > 0.1) {
          baselineParts.push(`최근 2개월 신고 증가율이 서울시 전체 대비 ${Math.round(excessGrowth * 100)}%p 높음`);
        }
      }
    }
  } catch (error) {
    // 베이스라인 조회 실패해도 계속 진행
  }
  
  const why = whyParts.length > 0 || baselineParts.length > 0
    ? [...whyParts, ...baselineParts].join('. ')
    : `UCI 점수 ${comfortIndex.uci_score.toFixed(1)}점으로 우선순위 높음`;
  
  if (baselineParts.length > 0) {
    whyParts.push(...baselineParts);
    limitations.push('서울시 전체 평균 대비 상대적 비교 기준 사용');
  }

  const confidence = Math.min(0.9, 0.5 + (comfortIndex.uci_score / 100) * 0.3);
  const uniqueActions = [...new Set(actions)].slice(0, 5);

  return {
    card_id: cardId,
    unit_id: unitId,
    date,
    title,
    why,
    recommended_actions: uniqueActions,
    tags,
    confidence: Math.round(confidence * 100) / 100,
    limitations
  };
}

export default router;

