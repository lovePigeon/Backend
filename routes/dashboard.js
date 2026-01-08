import express from 'express';
import SignalHuman from '../models/SignalHuman.js';
import SignalGeo from '../models/SignalGeo.js';
import SignalPopulation from '../models/SignalPopulation.js';
import ComfortIndex from '../models/ComfortIndex.js';
import Intervention from '../models/Intervention.js';
import { format, subDays, subWeeks, subMonths, startOfDay, endOfDay } from 'date-fns';

const router = express.Router();

/**
 * @swagger
 * /api/v1/dashboard/summary:
 *   get:
 *     summary: 데이터 요약 조회
 *     tags: [Dashboard]
 *     parameters:
 *       - in: query
 *         name: date
 *         schema:
 *           type: string
 *           format: date
 *       - in: query
 *         name: unit_id
 *         schema:
 *           type: string
 *     responses:
 *       200:
 *         description: 데이터 요약
 *         content:
 *           application/json:
 *             examples:
 *               summary:
 *                 value:
 *                   success: true
 *                   date: "2026-01-08"
 *                   unit_id: "all"
 *                   summary:
 *                     human_signal:
 *                       total_complaints: 150
 *                       by_type:
 *                         odor: 50
 *                         trash: 80
 *                         illegal_dump: 20
 *                       average_night_ratio: 0.65
 *                       average_repeat_ratio: 0.45
 *                     geo_signal:
 *                       count: 50
 *                       average_vulnerability: 0.6
 *                     population_signal:
 *                       total_population: 100000
 *                       night_population: 20000
 *                       night_ratio: 0.2
 *                     uci:
 *                       average_score: 65.5
 *                       grade_distribution:
 *                         A: 5
 *                         B: 10
 *                         C: 15
 *                         D: 12
 *                         E: 8
 */
router.get('/summary', async (req, res) => {
  try {
    const { date, unit_id } = req.query;
    const targetDate = date ? new Date(date) : new Date();

    // 기본 통계
    const humanStats = await getHumanSignalSummary(targetDate, unit_id);
    const geoStats = await getGeoSignalSummary(unit_id);
    const popStats = await getPopulationSignalSummary(targetDate, unit_id);
    const uciStats = await getUCIStats(targetDate, unit_id);

    res.json({
      success: true,
      date: format(targetDate, 'yyyy-MM-dd'),
      unit_id: unit_id || 'all',
      summary: {
        human_signal: humanStats,
        geo_signal: geoStats,
        population_signal: popStats,
        uci: uciStats
      }
    });
  } catch (error) {
    res.status(500).json({
      success: false,
      message: '데이터 요약 조회 중 오류가 발생했습니다.',
      error: error.message
    });
  }
});

/**
 * @swagger
 * /api/v1/dashboard/human-signal:
 *   get:
 *     summary: 민원 데이터 조회 (실시간/일별)
 *     tags: [Dashboard]
 *     parameters:
 *       - in: query
 *         name: date
 *         schema:
 *           type: string
 *           format: date
 *       - in: query
 *         name: unit_id
 *         schema:
 *           type: string
 *       - in: query
 *         name: period
 *         schema:
 *           type: string
 *           enum: [day, week, month]
 *           default: day
 *     responses:
 *       200:
 *         description: 민원 데이터
 *         content:
 *           application/json:
 *             examples:
 *               humanSignal:
 *                 value:
 *                   success: true
 *                   period: "day"
 *                   date_range:
 *                     start: "2026-01-08"
 *                     end: "2026-01-08"
 *                   summary:
 *                     total_complaints: 25
 *                     average_per_day: 25
 *                     by_day_of_week:
 *                       "0": 5
 *                       "1": 3
 *                       "2": 4
 *                     repeat_count: 8
 *                   trends:
 *                     - date: "2026-01-08"
 *                       total: 25
 *                       odor: 8
 *                       trash: 12
 *                       night_ratio: 0.65
 *                       repeat_ratio: 0.45
 */
router.get('/human-signal', async (req, res) => {
  try {
    const { date, unit_id, period = 'day' } = req.query;
    const targetDate = date ? new Date(date) : new Date();

    let startDate, endDate;
    switch (period) {
      case 'day':
        startDate = format(startOfDay(targetDate), 'yyyy-MM-dd');
        endDate = format(endOfDay(targetDate), 'yyyy-MM-dd');
        break;
      case 'week':
        startDate = format(subDays(targetDate, 7), 'yyyy-MM-dd');
        endDate = format(targetDate, 'yyyy-MM-dd');
        break;
      case 'month':
        startDate = format(subDays(targetDate, 30), 'yyyy-MM-dd');
        endDate = format(targetDate, 'yyyy-MM-dd');
        break;
      default:
        startDate = format(startOfDay(targetDate), 'yyyy-MM-dd');
        endDate = format(endOfDay(targetDate), 'yyyy-MM-dd');
    }

    const query = {
      date: { $gte: startDate, $lte: endDate }
    };
    if (unit_id) query.unit_id = unit_id;

    const signals = await SignalHuman.find(query).sort({ date: 1 });

    // 요약 통계
    const total = signals.reduce((sum, s) => sum + (s.complaint_total || 0), 0);
    const byDayOfWeek = {};
    const byHour = {};
    const trends = [];

    signals.forEach(signal => {
      const date = new Date(signal.date);
      const dayOfWeek = date.getDay();
      if (!byDayOfWeek[dayOfWeek]) byDayOfWeek[dayOfWeek] = 0;
      byDayOfWeek[dayOfWeek] += signal.complaint_total || 0;

      trends.push({
        date: signal.date,
        total: signal.complaint_total || 0,
        odor: signal.complaint_odor || 0,
        trash: signal.complaint_trash || 0,
        night_ratio: signal.night_ratio,
        repeat_ratio: signal.repeat_ratio
      });
    });

    res.json({
      success: true,
      period,
      date_range: { start: startDate, end: endDate },
      summary: {
        total_complaints: total,
        average_per_day: signals.length > 0 ? total / signals.length : 0,
        by_day_of_week: byDayOfWeek,
        repeat_count: signals.filter(s => (s.repeat_ratio || 0) > 0.5).length
      },
      trends: trends,
      data: signals
    });
  } catch (error) {
    res.status(500).json({
      success: false,
      message: '민원 데이터 조회 중 오류가 발생했습니다.',
      error: error.message
    });
  }
});

/**
 * @swagger
 * /api/v1/dashboard/geo-signal:
 *   get:
 *     summary: 지리 공간 데이터 조회
 *     tags: [Dashboard]
 *     parameters:
 *       - in: query
 *         name: unit_id
 *         schema:
 *           type: string
 *     responses:
 *       200:
 *         description: 지리 공간 데이터
 *         content:
 *           application/json:
 *             examples:
 *               geoSignal:
 *                 value:
 *                   success: true
 *                   count: 1
 *                   data:
 *                     - unit_id: "11110515"
 *                       alley_density: 65.5
 *                       backroad_ratio: 0.6
 *                       ventilation_proxy: 5.2
 *                       accessibility_proxy: 4.1
 *                       landuse_mix: 0.5
 *                       vulnerability_score: 0.65
 */
router.get('/geo-signal', async (req, res) => {
  try {
    const { unit_id } = req.query;

    const query = unit_id ? { _id: unit_id } : {};
    const signals = await SignalGeo.find(query);

    const summary = signals.map(s => ({
      unit_id: s._id,
      alley_density: s.alley_density,
      backroad_ratio: s.backroad_ratio,
      ventilation_proxy: s.ventilation_proxy,
      accessibility_proxy: s.accessibility_proxy,
      landuse_mix: s.landuse_mix,
      vulnerability_score: calculateVulnerabilityScore(s)
    }));

    res.json({
      success: true,
      count: signals.length,
      data: summary
    });
  } catch (error) {
    res.status(500).json({
      success: false,
      message: '지리 공간 데이터 조회 중 오류가 발생했습니다.',
      error: error.message
    });
  }
});

/**
 * @swagger
 * /api/v1/dashboard/population-signal:
 *   get:
 *     summary: 생활인구 데이터 조회 (실시간/일별)
 *     tags: [Dashboard]
 *     parameters:
 *       - in: query
 *         name: date
 *         schema:
 *           type: string
 *           format: date
 *       - in: query
 *         name: unit_id
 *         schema:
 *           type: string
 *       - in: query
 *         name: period
 *         schema:
 *           type: string
 *           enum: [day, week, month]
 *           default: day
 *     responses:
 *       200:
 *         description: 생활인구 데이터
 *         content:
 *           application/json:
 *             examples:
 *               populationSignal:
 *                 value:
 *                   success: true
 *                   period: "day"
 *                   date_range:
 *                     start: "2026-01-08"
 *                     end: "2026-01-08"
 *                   summary:
 *                     average_total: 10000
 *                     average_night: 2000
 *                     average_change_rate: 0.15
 *                     trend: "increasing"
 *                   trends:
 *                     - date: "2026-01-08"
 *                       pop_total: 10000
 *                       pop_night: 2000
 *                       pop_change_rate: 0.15
 *                       night_ratio: 0.2
 */
router.get('/population-signal', async (req, res) => {
  try {
    const { date, unit_id, period = 'day' } = req.query;
    const targetDate = date ? new Date(date) : new Date();

    let startDate, endDate;
    switch (period) {
      case 'day':
        startDate = format(startOfDay(targetDate), 'yyyy-MM-dd');
        endDate = format(endOfDay(targetDate), 'yyyy-MM-dd');
        break;
      case 'week':
        startDate = format(subDays(targetDate, 7), 'yyyy-MM-dd');
        endDate = format(targetDate, 'yyyy-MM-dd');
        break;
      case 'month':
        startDate = format(subDays(targetDate, 30), 'yyyy-MM-dd');
        endDate = format(targetDate, 'yyyy-MM-dd');
        break;
      default:
        startDate = format(startOfDay(targetDate), 'yyyy-MM-dd');
        endDate = format(endOfDay(targetDate), 'yyyy-MM-dd');
    }

    const query = {
      date: { $gte: startDate, $lte: endDate }
    };
    if (unit_id) query.unit_id = unit_id;

    const signals = await SignalPopulation.find(query).sort({ date: 1 });

    const trends = signals.map(s => ({
      date: s.date,
      pop_total: s.pop_total,
      pop_night: s.pop_night,
      pop_change_rate: s.pop_change_rate,
      night_ratio: s.pop_total > 0 ? (s.pop_night || 0) / s.pop_total : 0
    }));

    // 추세 계산
    const changeRates = signals.filter(s => s.pop_change_rate !== null).map(s => s.pop_change_rate);
    const avgChangeRate = changeRates.length > 0 
      ? changeRates.reduce((a, b) => a + b, 0) / changeRates.length 
      : 0;

    res.json({
      success: true,
      period,
      date_range: { start: startDate, end: endDate },
      summary: {
        average_total: signals.length > 0 
          ? signals.reduce((sum, s) => sum + (s.pop_total || 0), 0) / signals.length 
          : 0,
        average_night: signals.length > 0
          ? signals.reduce((sum, s) => sum + (s.pop_night || 0), 0) / signals.length
          : 0,
        average_change_rate: avgChangeRate,
        trend: avgChangeRate > 0.1 ? 'increasing' : avgChangeRate < -0.1 ? 'decreasing' : 'stable'
      },
      trends: trends,
      data: signals
    });
  } catch (error) {
    res.status(500).json({
      success: false,
      message: '생활인구 데이터 조회 중 오류가 발생했습니다.',
      error: error.message
    });
  }
});

/**
 * @swagger
 * /api/v1/dashboard/uci:
 *   get:
 *     summary: 편의성 지수 조회 (주간/월별/분기별)
 *     tags: [Dashboard]
 *     parameters:
 *       - in: query
 *         name: date
 *         schema:
 *           type: string
 *           format: date
 *       - in: query
 *         name: unit_id
 *         schema:
 *           type: string
 *       - in: query
 *         name: period
 *         schema:
 *           type: string
 *           enum: [week, month, quarter]
 *           default: week
 *     responses:
 *       200:
 *         description: 편의성 지수 데이터
 *         content:
 *           application/json:
 *             examples:
 *               uci:
 *                 value:
 *                   success: true
 *                   period: "week"
 *                   date_range:
 *                     start: "2026-01-01"
 *                     end: "2026-01-08"
 *                   summary:
 *                     average_score: 65.5
 *                     grade_distribution:
 *                       A: 5
 *                       B: 10
 *                       C: 15
 *                       D: 12
 *                       E: 8
 *                   trends:
 *                     - date: "2026-01-08"
 *                       unit_id: "11110515"
 *                       uci_score: 75.3
 *                       uci_grade: "D"
 *                       components:
 *                         human_score: 0.65
 *                         geo_score: 0.55
 *                       explain:
 *                         why_summary: "최근 4주 악취 민원 +38%"
 *                         key_drivers:
 *                           - signal: "complaint_odor_growth"
 *                             value: 0.83
 */
router.get('/uci', async (req, res) => {
  try {
    const { date, unit_id, period = 'week' } = req.query;
    const targetDate = date ? new Date(date) : new Date();

    let startDate, endDate;
    switch (period) {
      case 'week':
        startDate = format(subWeeks(targetDate, 1), 'yyyy-MM-dd');
        endDate = format(targetDate, 'yyyy-MM-dd');
        break;
      case 'month':
        startDate = format(subMonths(targetDate, 1), 'yyyy-MM-dd');
        endDate = format(targetDate, 'yyyy-MM-dd');
        break;
      case 'quarter':
        startDate = format(subMonths(targetDate, 3), 'yyyy-MM-dd');
        endDate = format(targetDate, 'yyyy-MM-dd');
        break;
      default:
        startDate = format(subWeeks(targetDate, 1), 'yyyy-MM-dd');
        endDate = format(targetDate, 'yyyy-MM-dd');
    }

    const query = {
      date: { $gte: startDate, $lte: endDate }
    };
    if (unit_id) query.unit_id = unit_id;

    const indices = await ComfortIndex.find(query).sort({ date: -1 });

    const trends = indices.map(ci => ({
      date: ci.date,
      unit_id: ci.unit_id,
      uci_score: ci.uci_score,
      uci_grade: ci.uci_grade,
      components: ci.components,
      explain: ci.explain
    }));

    res.json({
      success: true,
      period,
      date_range: { start: startDate, end: endDate },
      summary: {
        average_score: indices.length > 0
          ? indices.reduce((sum, ci) => sum + ci.uci_score, 0) / indices.length
          : 0,
        grade_distribution: {
          A: indices.filter(ci => ci.uci_grade === 'A').length,
          B: indices.filter(ci => ci.uci_grade === 'B').length,
          C: indices.filter(ci => ci.uci_grade === 'C').length,
          D: indices.filter(ci => ci.uci_grade === 'D').length,
          E: indices.filter(ci => ci.uci_grade === 'E').length
        }
      },
      trends: trends,
      data: indices
    });
  } catch (error) {
    res.status(500).json({
      success: false,
      message: '편의성 지수 조회 중 오류가 발생했습니다.',
      error: error.message
    });
  }
});

/**
 * @swagger
 * /api/v1/dashboard/interventions:
 *   get:
 *     summary: 개선 사업 데이터 조회
 *     tags: [Dashboard]
 *     parameters:
 *       - in: query
 *         name: unit_id
 *         schema:
 *           type: string
 *       - in: query
 *         name: status
 *         schema:
 *           type: string
 *           enum: [active, completed]
 *     responses:
 *       200:
 *         description: 개선 사업 데이터
 *         content:
 *           application/json:
 *             examples:
 *               interventions:
 *                 value:
 *                   success: true
 *                   count: 10
 *                   active: 5
 *                   completed: 5
 *                   data:
 *                     - intervention_id: "65a1b2c3d4e5f6a7b8c9d0e1"
 *                       unit_id: "11110515"
 *                       intervention_type: "night_cleanup"
 *                       start_date: "2026-01-08"
 *                       end_date: null
 *                       status: "active"
 *                       progress: 25
 *                       note: "야간 집중 청소 실시"
 */
router.get('/interventions', async (req, res) => {
  try {
    const { unit_id, status } = req.query;

    const query = {};
    if (unit_id) query.unit_id = unit_id;
    if (status === 'active') {
      query.end_date = null;
    } else if (status === 'completed') {
      query.end_date = { $ne: null };
    }

    const interventions = await Intervention.find(query).sort({ start_date: -1 });

    const summary = interventions.map(i => ({
      intervention_id: i._id,
      unit_id: i.unit_id,
      intervention_type: i.intervention_type,
      start_date: i.start_date,
      end_date: i.end_date,
      status: i.end_date ? 'completed' : 'active',
      progress: calculateProgress(i),
      note: i.note
    }));

    res.json({
      success: true,
      count: interventions.length,
      active: interventions.filter(i => !i.end_date).length,
      completed: interventions.filter(i => i.end_date).length,
      data: summary
    });
  } catch (error) {
    res.status(500).json({
      success: false,
      message: '개선 사업 데이터 조회 중 오류가 발생했습니다.',
      error: error.message
    });
  }
});

/**
 * @swagger
 * /api/v1/dashboard/interventions/{intervention_id}/effect:
 *   get:
 *     summary: 개입 이력 및 전후 효과 조회
 *     tags: [Dashboard]
 *     parameters:
 *       - in: path
 *         name: intervention_id
 *         required: true
 *         schema:
 *           type: string
 *       - in: query
 *         name: baseline_weeks
 *         schema:
 *           type: integer
 *           default: 4
 *       - in: query
 *         name: followup_weeks
 *         schema:
 *           type: integer
 *           default: 4
 *     responses:
 *       200:
 *         description: 개입 효과 데이터
 *         content:
 *           application/json:
 *             examples:
 *               effect:
 *                 value:
 *                   success: true
 *                   intervention:
 *                     intervention_id: "65a1b2c3d4e5f6a7b8c9d0e1"
 *                     unit_id: "11110515"
 *                     intervention_type: "night_cleanup"
 *                     start_date: "2026-01-08"
 *                     end_date: null
 *                   effect:
 *                     baseline_period:
 *                       start: "2025-12-11"
 *                       end: "2026-01-07"
 *                       average_uci: 80.5
 *                       data:
 *                         - date: "2025-12-11"
 *                           uci_score: 82.5
 *                     followup_period:
 *                       start: "2026-01-08"
 *                       end: "2026-02-05"
 *                       average_uci: 65.2
 *                       data:
 *                         - date: "2026-01-08"
 *                           uci_score: 75.2
 *                     improvement: 19.0
 *                     effect_size: 15.3
 */
router.get('/interventions/:intervention_id/effect', async (req, res) => {
  try {
    const { intervention_id } = req.params;
    const { baseline_weeks = 4, followup_weeks = 4 } = req.query;

    const intervention = await Intervention.findById(intervention_id);
    if (!intervention) {
      return res.status(404).json({
        success: false,
        message: '개입 이력을 찾을 수 없습니다.'
      });
    }

    const startDate = new Date(intervention.start_date);
    const baselineStart = format(subDays(startDate, baseline_weeks * 7), 'yyyy-MM-dd');
    const baselineEnd = format(subDays(startDate, 1), 'yyyy-MM-dd');
    const followupStart = format(startDate, 'yyyy-MM-dd');
    const followupEnd = intervention.end_date
      ? format(new Date(intervention.end_date), 'yyyy-MM-dd')
      : format(subDays(new Date(), -followup_weeks * 7), 'yyyy-MM-dd');

    const baselineUCI = await ComfortIndex.find({
      unit_id: intervention.unit_id,
      date: { $gte: baselineStart, $lte: baselineEnd }
    }).sort({ date: 1 });

    const followupUCI = await ComfortIndex.find({
      unit_id: intervention.unit_id,
      date: { $gte: followupStart, $lte: followupEnd }
    }).sort({ date: 1 });

    const baselineAvg = baselineUCI.length > 0
      ? baselineUCI.reduce((sum, ci) => sum + ci.uci_score, 0) / baselineUCI.length
      : 0;

    const followupAvg = followupUCI.length > 0
      ? followupUCI.reduce((sum, ci) => sum + ci.uci_score, 0) / followupUCI.length
      : 0;

    res.json({
      success: true,
      intervention: {
        intervention_id: intervention._id,
        unit_id: intervention.unit_id,
        intervention_type: intervention.intervention_type,
        start_date: intervention.start_date,
        end_date: intervention.end_date
      },
      effect: {
        baseline_period: {
          start: baselineStart,
          end: baselineEnd,
          average_uci: baselineAvg,
          data: baselineUCI
        },
        followup_period: {
          start: followupStart,
          end: followupEnd,
          average_uci: followupAvg,
          data: followupUCI
        },
        improvement: baselineAvg > 0 ? ((baselineAvg - followupAvg) / baselineAvg * 100) : 0,
        effect_size: baselineAvg - followupAvg
      }
    });
  } catch (error) {
    res.status(500).json({
      success: false,
      message: '개입 효과 분석 중 오류가 발생했습니다.',
      error: error.message
    });
  }
});

// 헬퍼 함수들
async function getHumanSignalSummary(date, unitId) {
  const dateStr = format(date, 'yyyy-MM-dd');
  const query = { date: dateStr };
  if (unitId) query.unit_id = unitId;

  const signals = await SignalHuman.find(query);
  const total = signals.reduce((sum, s) => sum + (s.complaint_total || 0), 0);

  return {
    total_complaints: total,
    by_type: {
      odor: signals.reduce((sum, s) => sum + (s.complaint_odor || 0), 0),
      trash: signals.reduce((sum, s) => sum + (s.complaint_trash || 0), 0),
      illegal_dump: signals.reduce((sum, s) => sum + (s.complaint_illegal_dump || 0), 0)
    },
    average_night_ratio: signals.length > 0
      ? signals.reduce((sum, s) => sum + (s.night_ratio || 0), 0) / signals.length
      : 0,
    average_repeat_ratio: signals.length > 0
      ? signals.reduce((sum, s) => sum + (s.repeat_ratio || 0), 0) / signals.length
      : 0
  };
}

async function getGeoSignalSummary(unitId) {
  const query = unitId ? { _id: unitId } : {};
  const signals = await SignalGeo.find(query);

  return {
    count: signals.length,
    average_vulnerability: signals.length > 0
      ? signals.reduce((sum, s) => sum + calculateVulnerabilityScore(s), 0) / signals.length
      : 0
  };
}

async function getPopulationSignalSummary(date, unitId) {
  const dateStr = format(date, 'yyyy-MM-dd');
  const query = { date: dateStr };
  if (unitId) query.unit_id = unitId;

  const signals = await SignalPopulation.find(query);
  const total = signals.reduce((sum, s) => sum + (s.pop_total || 0), 0);
  const night = signals.reduce((sum, s) => sum + (s.pop_night || 0), 0);

  return {
    total_population: total,
    night_population: night,
    night_ratio: total > 0 ? night / total : 0
  };
}

async function getUCIStats(date, unitId) {
  const dateStr = format(date, 'yyyy-MM-dd');
  const query = { date: dateStr };
  if (unitId) query.unit_id = unitId;

  const indices = await ComfortIndex.find(query);
  const avgScore = indices.length > 0
    ? indices.reduce((sum, ci) => sum + ci.uci_score, 0) / indices.length
    : 0;

  return {
    average_score: avgScore,
    grade_distribution: {
      A: indices.filter(ci => ci.uci_grade === 'A').length,
      B: indices.filter(ci => ci.uci_grade === 'B').length,
      C: indices.filter(ci => ci.uci_grade === 'C').length,
      D: indices.filter(ci => ci.uci_grade === 'D').length,
      E: indices.filter(ci => ci.uci_grade === 'E').length
    }
  };
}

function calculateVulnerabilityScore(geoSignal) {
  const scores = [];
  if (geoSignal.alley_density) scores.push(geoSignal.alley_density / 100);
  if (geoSignal.backroad_ratio) scores.push(geoSignal.backroad_ratio);
  if (geoSignal.ventilation_proxy) scores.push(1 - geoSignal.ventilation_proxy / 10);
  if (geoSignal.accessibility_proxy) scores.push(1 - geoSignal.accessibility_proxy / 10);

  return scores.length > 0
    ? scores.reduce((a, b) => a + b, 0) / scores.length
    : 0;
}

function calculateProgress(intervention) {
  if (intervention.end_date) return 100;
  
  const start = new Date(intervention.start_date);
  const now = new Date();
  const daysPassed = (now - start) / (1000 * 60 * 60 * 24);
  
  // 기본 30일 기준으로 진행률 계산 (실제로는 프로젝트 기간에 따라 조정)
  return Math.min(100, Math.round((daysPassed / 30) * 100));
}

export default router;

