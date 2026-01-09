import express from 'express';
import SignalHuman from '../models/SignalHuman.js';
import SignalGeo from '../models/SignalGeo.js';
import SignalPopulation from '../models/SignalPopulation.js';
import ComfortIndex from '../models/ComfortIndex.js';
import SpatialUnit from '../models/SpatialUnit.js';
import { format, subDays, subWeeks, subMonths, startOfDay, endOfDay } from 'date-fns';

const router = express.Router();

/**
 * @swagger
 * /api/v1/analytics/statistics:
 *   get:
 *     summary: 통계 분석 (평균, 표준편차, 최소/최대값 등)
 *     tags: [Analytics]
 *     parameters:
 *       - in: query
 *         name: signal_type
 *         required: true
 *         schema:
 *           type: string
 *           enum: [human, geo, population, uci]
 *       - in: query
 *         name: date_start
 *         schema:
 *           type: string
 *           format: date
 *       - in: query
 *         name: date_end
 *         schema:
 *           type: string
 *           format: date
 *       - in: query
 *         name: unit_id
 *         schema:
 *           type: string
 *       - in: query
 *         name: field
 *         schema:
 *           type: string
 *         description: Field name to analyze (e.g., complaint_total, uci_score)
 *     responses:
 *       200:
 *         description: 통계 분석 결과
 *         content:
 *           application/json:
 *             examples:
 *               stats:
 *                 value:
 *                   field: "complaint_total"
 *                   count: 100
 *                   mean: 5.2
 *                   median: 4.0
 *                   std_dev: 2.1
 *                   min: 0
 *                   max: 15
 *                   q25: 3
 *                   q75: 7
 */
router.get('/statistics', async (req, res) => {
  try {
    const { signal_type, date_start, date_end, unit_id, field } = req.query;

    if (!signal_type || !field) {
      return res.status(400).json({
        success: false,
        message: 'signal_type과 field 파라미터가 필요합니다.'
      });
    }

    let data = [];
    let query = {};

    if (date_start || date_end) {
      query.date = {};
      if (date_start) query.date.$gte = date_start;
      if (date_end) query.date.$lte = date_end;
    }

    if (unit_id) query.unit_id = unit_id;

    switch (signal_type) {
      case 'human':
        data = await SignalHuman.find(query);
        break;
      case 'population':
        data = await SignalPopulation.find(query);
        break;
      case 'uci':
        data = await ComfortIndex.find(query);
        break;
      case 'geo':
        if (unit_id) {
          const geo = await SignalGeo.findById(unit_id);
          data = geo ? [geo] : [];
        } else {
          data = await SignalGeo.find({});
        }
        break;
    }

    const values = data
      .map(d => {
        const val = field.split('.').reduce((obj, key) => obj?.[key], d);
        return typeof val === 'number' ? val : null;
      })
      .filter(v => v !== null && !isNaN(v))
      .sort((a, b) => a - b);

    if (values.length === 0) {
      return res.json({
        field,
        count: 0,
        message: '분석할 데이터가 없습니다.'
      });
    }

    const mean = values.reduce((a, b) => a + b, 0) / values.length;
    const median = values[Math.floor(values.length / 2)];
    const variance = values.reduce((sum, val) => sum + Math.pow(val - mean, 2), 0) / values.length;
    const stdDev = Math.sqrt(variance);
    const min = values[0];
    const max = values[values.length - 1];
    const q25 = values[Math.floor(values.length * 0.25)];
    const q75 = values[Math.floor(values.length * 0.75)];

    res.json({
      field,
      count: values.length,
      mean: Math.round(mean * 100) / 100,
      median: Math.round(median * 100) / 100,
      std_dev: Math.round(stdDev * 100) / 100,
      min,
      max,
      q25,
      q75,
      range: max - min
    });
  } catch (error) {
    res.status(500).json({
      success: false,
      message: '통계 분석 중 오류가 발생했습니다.',
      error: error.message
    });
  }
});

/**
 * @swagger
 * /api/v1/analytics/correlation:
 *   get:
 *     summary: 상관관계 분석
 *     tags: [Analytics]
 *     parameters:
 *       - in: query
 *         name: signal_type
 *         required: true
 *         schema:
 *           type: string
 *           enum: [human, population]
 *       - in: query
 *         name: field1
 *         required: true
 *         schema:
 *           type: string
 *       - in: query
 *         name: field2
 *         required: true
 *         schema:
 *           type: string
 *       - in: query
 *         name: date_start
 *         schema:
 *           type: string
 *           format: date
 *       - in: query
 *         name: date_end
 *         schema:
 *           type: string
 *           format: date
 *     responses:
 *       200:
 *         description: 상관관계 분석 결과
 *         content:
 *           application/json:
 *             examples:
 *               correlation:
 *                 value:
 *                   field1: "complaint_total"
 *                   field2: "night_ratio"
 *                   correlation: 0.65
 *                   interpretation: "중간 정도의 양의 상관관계"
 *                   sample_size: 100
 */
router.get('/correlation', async (req, res) => {
  try {
    const { signal_type, field1, field2, date_start, date_end } = req.query;

    if (!signal_type || !field1 || !field2) {
      return res.status(400).json({
        success: false,
        message: 'signal_type, field1, field2 파라미터가 필요합니다.'
      });
    }

    let query = {};
    if (date_start || date_end) {
      query.date = {};
      if (date_start) query.date.$gte = date_start;
      if (date_end) query.date.$lte = date_end;
    }

    let data = [];
    switch (signal_type) {
      case 'human':
        data = await SignalHuman.find(query);
        break;
      case 'population':
        data = await SignalPopulation.find(query);
        break;
    }

    const pairs = data
      .map(d => {
        const val1 = field1.split('.').reduce((obj, key) => obj?.[key], d);
        const val2 = field2.split('.').reduce((obj, key) => obj?.[key], d);
        if (typeof val1 === 'number' && typeof val2 === 'number' && !isNaN(val1) && !isNaN(val2)) {
          return [val1, val2];
        }
        return null;
      })
      .filter(p => p !== null);

    if (pairs.length < 2) {
      return res.json({
        field1,
        field2,
        correlation: null,
        message: '상관관계 분석을 위한 충분한 데이터가 없습니다.'
      });
    }

    const values1 = pairs.map(p => p[0]);
    const values2 = pairs.map(p => p[1]);

    const mean1 = values1.reduce((a, b) => a + b, 0) / values1.length;
    const mean2 = values2.reduce((a, b) => a + b, 0) / values2.length;

    const numerator = pairs.reduce((sum, [v1, v2]) => sum + (v1 - mean1) * (v2 - mean2), 0);
    const denom1 = Math.sqrt(pairs.reduce((sum, [v1]) => sum + Math.pow(v1 - mean1, 2), 0));
    const denom2 = Math.sqrt(pairs.reduce((sum, [, v2]) => sum + Math.pow(v2 - mean2, 2), 0));

    const correlation = denom1 * denom2 !== 0 ? numerator / (denom1 * denom2) : 0;

    let interpretation = '';
    const absCorr = Math.abs(correlation);
    if (absCorr < 0.3) interpretation = '약한 상관관계';
    else if (absCorr < 0.7) interpretation = '중간 정도의 상관관계';
    else interpretation = '강한 상관관계';
    interpretation += correlation > 0 ? ' (양의 상관관계)' : ' (음의 상관관계)';

    res.json({
      field1,
      field2,
      correlation: Math.round(correlation * 1000) / 1000,
      interpretation,
      sample_size: pairs.length
    });
  } catch (error) {
    res.status(500).json({
      success: false,
      message: '상관관계 분석 중 오류가 발생했습니다.',
      error: error.message
    });
  }
});

/**
 * @swagger
 * /api/v1/analytics/trend:
 *   get:
 *     summary: 트렌드 분석 (시계열)
 *     tags: [Analytics]
 *     parameters:
 *       - in: query
 *         name: signal_type
 *         required: true
 *         schema:
 *           type: string
 *           enum: [human, population, uci]
 *       - in: query
 *         name: field
 *         required: true
 *         schema:
 *           type: string
 *       - in: query
 *         name: date_start
 *         required: true
 *         schema:
 *           type: string
 *           format: date
 *       - in: query
 *         name: date_end
 *         required: true
 *         schema:
 *           type: string
 *           format: date
 *       - in: query
 *         name: unit_id
 *         schema:
 *           type: string
 *       - in: query
 *         name: group_by
 *         schema:
 *           type: string
 *           enum: [day, week, month]
 *           default: day
 *     responses:
 *       200:
 *         description: 트렌드 분석 결과
 *         content:
 *           application/json:
 *             examples:
 *               trend:
 *                 value:
 *                   field: "complaint_total"
 *                   trend_direction: "increasing"
 *                   trend_rate: 0.15
 *                   data_points:
 *                     - date: "2026-01-01"
 *                       value: 5
 *                     - date: "2026-01-08"
 *                       value: 8
 *                   summary:
 *                     first_value: 5
 *                     last_value: 8
 *                     change_percent: 60
 */
router.get('/trend', async (req, res) => {
  try {
    const { signal_type, field, date_start, date_end, unit_id, group_by = 'day' } = req.query;

    if (!signal_type || !field || !date_start || !date_end) {
      return res.status(400).json({
        success: false,
        message: 'signal_type, field, date_start, date_end 파라미터가 필요합니다.'
      });
    }

    let query = {
      date: { $gte: date_start, $lte: date_end }
    };
    if (unit_id) query.unit_id = unit_id;

    let data = [];
    switch (signal_type) {
      case 'human':
        data = await SignalHuman.find(query).sort({ date: 1 });
        break;
      case 'population':
        data = await SignalPopulation.find(query).sort({ date: 1 });
        break;
      case 'uci':
        data = await ComfortIndex.find(query).sort({ date: 1 });
        break;
    }

    const dataPoints = data.map(d => {
      const val = field.split('.').reduce((obj, key) => obj?.[key], d);
      return {
        date: d.date,
        value: typeof val === 'number' ? val : null
      };
    }).filter(dp => dp.value !== null);

    if (dataPoints.length < 2) {
      return res.json({
        field,
        trend_direction: 'insufficient_data',
        message: '트렌드 분석을 위한 충분한 데이터가 없습니다.'
      });
    }

    const firstValue = dataPoints[0].value;
    const lastValue = dataPoints[dataPoints.length - 1].value;
    const changePercent = firstValue > 0 ? ((lastValue - firstValue) / firstValue) * 100 : 0;
    const trendDirection = changePercent > 5 ? 'increasing' : changePercent < -5 ? 'decreasing' : 'stable';
    const trendRate = changePercent / 100;

    res.json({
      field,
      trend_direction: trendDirection,
      trend_rate: Math.round(trendRate * 1000) / 1000,
      data_points: dataPoints,
      summary: {
        first_value: firstValue,
        last_value: lastValue,
        change_percent: Math.round(changePercent * 100) / 100,
        period_days: dataPoints.length
      }
    });
  } catch (error) {
    res.status(500).json({
      success: false,
      message: '트렌드 분석 중 오류가 발생했습니다.',
      error: error.message
    });
  }
});

/**
 * @swagger
 * /api/v1/analytics/aggregate:
 *   get:
 *     summary: 집계 분석 (그룹별 통계)
 *     tags: [Analytics]
 *     parameters:
 *       - in: query
 *         name: signal_type
 *         required: true
 *         schema:
 *           type: string
 *           enum: [human, population, uci]
 *       - in: query
 *         name: group_by
 *         required: true
 *         schema:
 *           type: string
 *           enum: [unit_id, date, uci_grade]
 *       - in: query
 *         name: field
 *         required: true
 *         schema:
 *           type: string
 *       - in: query
 *         name: date_start
 *         schema:
 *           type: string
 *           format: date
 *       - in: query
 *         name: date_end
 *         schema:
 *           type: string
 *           format: date
 *     responses:
 *       200:
 *         description: 집계 분석 결과
 *         content:
 *           application/json:
 *             examples:
 *               aggregate:
 *                 value:
 *                   group_by: "unit_id"
 *                   field: "complaint_total"
 *                   groups:
 *                     "11110515":
 *                       count: 30
 *                       sum: 150
 *                       avg: 5.0
 *                       min: 0
 *                       max: 12
 *                     "11110516":
 *                       count: 30
 *                       sum: 90
 *                       avg: 3.0
 *                       min: 0
 *                       max: 8
 */
router.get('/aggregate', async (req, res) => {
  try {
    const { signal_type, group_by, field, date_start, date_end } = req.query;

    if (!signal_type || !group_by || !field) {
      return res.status(400).json({
        success: false,
        message: 'signal_type, group_by, field 파라미터가 필요합니다.'
      });
    }

    let query = {};
    if (date_start || date_end) {
      query.date = {};
      if (date_start) query.date.$gte = date_start;
      if (date_end) query.date.$lte = date_end;
    }

    let data = [];
    switch (signal_type) {
      case 'human':
        data = await SignalHuman.find(query);
        break;
      case 'population':
        data = await SignalPopulation.find(query);
        break;
      case 'uci':
        data = await ComfortIndex.find(query);
        break;
    }

    const groups = {};

    data.forEach(d => {
      const groupKey = group_by.split('.').reduce((obj, key) => obj?.[key], d);
      const value = field.split('.').reduce((obj, key) => obj?.[key], d);

      if (groupKey && typeof value === 'number' && !isNaN(value)) {
        if (!groups[groupKey]) {
          groups[groupKey] = {
            count: 0,
            sum: 0,
            values: []
          };
        }
        groups[groupKey].count++;
        groups[groupKey].sum += value;
        groups[groupKey].values.push(value);
      }
    });

    const result = {};
    Object.keys(groups).forEach(key => {
      const group = groups[key];
      const sorted = [...group.values].sort((a, b) => a - b);
      result[key] = {
        count: group.count,
        sum: Math.round(group.sum * 100) / 100,
        avg: Math.round((group.sum / group.count) * 100) / 100,
        min: sorted[0],
        max: sorted[sorted.length - 1],
        median: sorted[Math.floor(sorted.length / 2)]
      };
    });

    res.json({
      group_by,
      field,
      groups: result
    });
  } catch (error) {
    res.status(500).json({
      success: false,
      message: '집계 분석 중 오류가 발생했습니다.',
      error: error.message
    });
  }
});

/**
 * @swagger
 * /api/v1/analytics/comparison:
 *   get:
 *     summary: 비교 분석 (두 기간 또는 두 그룹 비교)
 *     tags: [Analytics]
 *     parameters:
 *       - in: query
 *         name: signal_type
 *         required: true
 *         schema:
 *           type: string
 *           enum: [human, population, uci]
 *       - in: query
 *         name: field
 *         required: true
 *         schema:
 *           type: string
 *       - in: query
 *         name: period1_start
 *         required: true
 *         schema:
 *           type: string
 *           format: date
 *       - in: query
 *         name: period1_end
 *         required: true
 *         schema:
 *           type: string
 *           format: date
 *       - in: query
 *         name: period2_start
 *         required: true
 *         schema:
 *           type: string
 *           format: date
 *       - in: query
 *         name: period2_end
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
 *         description: 비교 분석 결과
 *         content:
 *           application/json:
 *             examples:
 *               comparison:
 *                 value:
 *                   field: "complaint_total"
 *                   period1:
 *                     start: "2025-12-01"
 *                     end: "2025-12-31"
 *                     avg: 4.5
 *                     total: 135
 *                   period2:
 *                     start: "2026-01-01"
 *                     end: "2026-01-31"
 *                     avg: 6.2
 *                     total: 186
 *                   difference:
 *                     absolute: 51
 *                     percent: 37.8
 *                   significance: "significant_increase"
 */
router.get('/comparison', async (req, res) => {
  try {
    const { 
      signal_type, 
      field, 
      period1_start, 
      period1_end, 
      period2_start, 
      period2_end,
      unit_id 
    } = req.query;

    if (!signal_type || !field || !period1_start || !period1_end || !period2_start || !period2_end) {
      return res.status(400).json({
        success: false,
        message: '필수 파라미터가 누락되었습니다.'
      });
    }

    let query1 = { date: { $gte: period1_start, $lte: period1_end } };
    let query2 = { date: { $gte: period2_start, $lte: period2_end } };
    if (unit_id) {
      query1.unit_id = unit_id;
      query2.unit_id = unit_id;
    }

    let data1 = [], data2 = [];
    switch (signal_type) {
      case 'human':
        data1 = await SignalHuman.find(query1);
        data2 = await SignalHuman.find(query2);
        break;
      case 'population':
        data1 = await SignalPopulation.find(query1);
        data2 = await SignalPopulation.find(query2);
        break;
      case 'uci':
        data1 = await ComfortIndex.find(query1);
        data2 = await ComfortIndex.find(query2);
        break;
    }

    const values1 = data1
      .map(d => {
        const val = field.split('.').reduce((obj, key) => obj?.[key], d);
        return typeof val === 'number' ? val : null;
      })
      .filter(v => v !== null && !isNaN(v));

    const values2 = data2
      .map(d => {
        const val = field.split('.').reduce((obj, key) => obj?.[key], d);
        return typeof val === 'number' ? val : null;
      })
      .filter(v => v !== null && !isNaN(v));

    const avg1 = values1.length > 0 ? values1.reduce((a, b) => a + b, 0) / values1.length : 0;
    const avg2 = values2.length > 0 ? values2.reduce((a, b) => a + b, 0) / values2.length : 0;
    const total1 = values1.reduce((a, b) => a + b, 0);
    const total2 = values2.reduce((a, b) => a + b, 0);

    const diff = total2 - total1;
    const diffPercent = total1 > 0 ? (diff / total1) * 100 : 0;

    let significance = 'no_change';
    if (Math.abs(diffPercent) > 20) {
      significance = diffPercent > 0 ? 'significant_increase' : 'significant_decrease';
    } else if (Math.abs(diffPercent) > 10) {
      significance = diffPercent > 0 ? 'moderate_increase' : 'moderate_decrease';
    } else if (Math.abs(diffPercent) > 5) {
      significance = diffPercent > 0 ? 'slight_increase' : 'slight_decrease';
    }

    res.json({
      field,
      period1: {
        start: period1_start,
        end: period1_end,
        avg: Math.round(avg1 * 100) / 100,
        total: total1,
        count: values1.length
      },
      period2: {
        start: period2_start,
        end: period2_end,
        avg: Math.round(avg2 * 100) / 100,
        total: total2,
        count: values2.length
      },
      difference: {
        absolute: diff,
        percent: Math.round(diffPercent * 100) / 100,
        avg_change: Math.round((avg2 - avg1) * 100) / 100
      },
      significance
    });
  } catch (error) {
    res.status(500).json({
      success: false,
      message: '비교 분석 중 오류가 발생했습니다.',
      error: error.message
    });
  }
});

/**
 * @swagger
 * /api/v1/analytics/export:
 *   get:
 *     summary: 분석 결과 CSV 내보내기
 *     tags: [Analytics]
 *     parameters:
 *       - in: query
 *         name: signal_type
 *         required: true
 *         schema:
 *           type: string
 *       - in: query
 *         name: date_start
 *         schema:
 *           type: string
 *           format: date
 *       - in: query
 *         name: date_end
 *         schema:
 *           type: string
 *           format: date
 *       - in: query
 *         name: unit_id
 *         schema:
 *           type: string
 *       - in: query
 *         name: format
 *         schema:
 *           type: string
 *           enum: [csv, json]
 *           default: csv
 *     responses:
 *       200:
 *         description: CSV 또는 JSON 형식의 데이터
 */
router.get('/export', async (req, res) => {
  try {
    const { signal_type, date_start, date_end, unit_id, format = 'csv' } = req.query;

    if (!signal_type) {
      return res.status(400).json({
        success: false,
        message: 'signal_type 파라미터가 필요합니다.'
      });
    }

    let query = {};
    if (date_start || date_end) {
      query.date = {};
      if (date_start) query.date.$gte = date_start;
      if (date_end) query.date.$lte = date_end;
    }
    if (unit_id) query.unit_id = unit_id;

    let data = [];
    switch (signal_type) {
      case 'human':
        data = await SignalHuman.find(query).sort({ date: 1 });
        break;
      case 'population':
        data = await SignalPopulation.find(query).sort({ date: 1 });
        break;
      case 'uci':
        data = await ComfortIndex.find(query).sort({ date: 1 });
        break;
      case 'geo':
        if (unit_id) {
          const geo = await SignalGeo.findById(unit_id);
          data = geo ? [geo] : [];
        } else {
          data = await SignalGeo.find({});
        }
        break;
    }

    if (format === 'csv') {
      if (data.length === 0) {
        return res.status(404).json({
          success: false,
          message: '내보낼 데이터가 없습니다.'
        });
      }

      const headers = Object.keys(data[0].toObject ? data[0].toObject() : data[0]);
      const csvRows = [
        headers.join(','),
        ...data.map(row => {
          const obj = row.toObject ? row.toObject() : row;
          return headers.map(header => {
            const val = obj[header];
            if (val === null || val === undefined) return '';
            if (typeof val === 'object') return JSON.stringify(val);
            return String(val).replace(/,/g, ';');
          }).join(',');
        })
      ];

      res.setHeader('Content-Type', 'text/csv');
      res.setHeader('Content-Disposition', `attachment; filename="${signal_type}_${date_start || 'all'}_${date_end || 'all'}.csv"`);
      res.send(csvRows.join('\n'));
    } else {
      res.json({
        success: true,
        count: data.length,
        data: data.map(d => d.toObject ? d.toObject() : d)
      });
    }
  } catch (error) {
    res.status(500).json({
      success: false,
      message: '데이터 내보내기 중 오류가 발생했습니다.',
      error: error.message
    });
  }
});

export default router;

