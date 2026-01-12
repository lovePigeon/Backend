/**
 * Data Validation Script
 * 
 * 데이터 품질 및 일관성 검증
 * - 데이터 완전성 체크
 * - 데이터 일관성 체크
 * - 이상치 감지
 * - 중복 데이터 체크
 */

import dotenv from 'dotenv';
import { connectDB } from '../config/database.js';
import SignalHuman from '../models/SignalHuman.js';
import SignalPopulation from '../models/SignalPopulation.js';
import ComfortIndex from '../models/ComfortIndex.js';
import SpatialUnit from '../models/SpatialUnit.js';
import AnomalySignal from '../models/AnomalySignal.js';
import { format, subDays, parseISO } from 'date-fns';

dotenv.config();

/**
 * 데이터 검증 리포트 생성
 */
async function validateData() {
  try {
    await connectDB();
    console.log('✅ MongoDB connected\n');

    const report = {
      timestamp: new Date().toISOString(),
      summary: {
        total_issues: 0,
        critical: 0,
        warnings: 0
      },
      issues: []
    };

    // 1. Spatial Units 일관성 체크
    console.log('📊 Checking spatial units consistency...');
    const spatialUnits = await SpatialUnit.find({}).lean();
    const spatialUnitIds = new Set(spatialUnits.map(u => u._id));
    console.log(`  Found ${spatialUnits.length} spatial units`);

    // 2. Signals Human 데이터 검증
    console.log('\n📊 Validating signals_human...');
    const humanSignals = await SignalHuman.find({}).lean();
    const humanStats = {
      total: humanSignals.length,
      invalid_unit_id: 0,
      invalid_date: 0,
      invalid_value: 0,
      duplicate: 0,
      missing_dates: []
    };

    const humanDateSet = new Set();
    const humanUniqueKeys = new Set();

    humanSignals.forEach(signal => {
      // unit_id 검증
      if (!spatialUnitIds.has(signal.unit_id) && signal.unit_id.length !== 5) {
        humanStats.invalid_unit_id++;
        report.issues.push({
          type: 'warning',
          collection: 'signals_human',
          issue: `Invalid unit_id: ${signal.unit_id}`,
          document_id: signal._id
        });
      }

      // 날짜 형식 검증
      if (!/^\d{4}-\d{2}-\d{2}$/.test(signal.date)) {
        humanStats.invalid_date++;
        report.issues.push({
          type: 'critical',
          collection: 'signals_human',
          issue: `Invalid date format: ${signal.date}`,
          document_id: signal._id
        });
      } else {
        humanDateSet.add(signal.date);
      }

      // 값 범위 검증
      if (signal.value < 0 || (signal.signal_type === 'night_ratio' && signal.value > 1)) {
        humanStats.invalid_value++;
        report.issues.push({
          type: 'warning',
          collection: 'signals_human',
          issue: `Invalid value: ${signal.value} for signal_type: ${signal.signal_type}`,
          document_id: signal._id
        });
      }

      // 중복 체크
      const uniqueKey = `${signal.unit_id}-${signal.date}-${signal.signal_type}`;
      if (humanUniqueKeys.has(uniqueKey)) {
        humanStats.duplicate++;
        report.issues.push({
          type: 'critical',
          collection: 'signals_human',
          issue: `Duplicate entry: ${uniqueKey}`,
          document_id: signal._id
        });
      } else {
        humanUniqueKeys.add(uniqueKey);
      }
    });

    console.log(`  Total records: ${humanStats.total}`);
    console.log(`  Invalid unit_id: ${humanStats.invalid_unit_id}`);
    console.log(`  Invalid date: ${humanStats.invalid_date}`);
    console.log(`  Invalid value: ${humanStats.invalid_value}`);
    console.log(`  Duplicates: ${humanStats.duplicate}`);
    console.log(`  Unique dates: ${humanDateSet.size}`);

    // 3. Comfort Index 검증
    console.log('\n📊 Validating comfort_index...');
    const comfortIndices = await ComfortIndex.find({}).lean();
    const uciStats = {
      total: comfortIndices.length,
      invalid_uci_score: 0,
      invalid_grade: 0,
      invalid_unit_id: 0,
      date_mismatch: 0
    };

    comfortIndices.forEach(ci => {
      // UCI 점수 범위 검증 (0-100)
      if (ci.uci_score < 0 || ci.uci_score > 100) {
        uciStats.invalid_uci_score++;
        report.issues.push({
          type: 'critical',
          collection: 'comfort_index',
          issue: `Invalid uci_score: ${ci.uci_score} (must be 0-100)`,
          document_id: ci._id
        });
      }

      // 등급 검증
      if (!['A', 'B', 'C', 'D', 'E'].includes(ci.uci_grade)) {
        uciStats.invalid_grade++;
        report.issues.push({
          type: 'critical',
          collection: 'comfort_index',
          issue: `Invalid uci_grade: ${ci.uci_grade}`,
          document_id: ci._id
        });
      }

      // unit_id 검증
      if (!spatialUnitIds.has(ci.unit_id) && ci.unit_id.length !== 5) {
        uciStats.invalid_unit_id++;
        report.issues.push({
          type: 'warning',
          collection: 'comfort_index',
          issue: `Invalid unit_id: ${ci.unit_id}`,
          document_id: ci._id
        });
      }

      // 등급과 점수 일치 검증
      const expectedGrade = getGradeFromScore(ci.uci_score);
      if (expectedGrade !== ci.uci_grade) {
        uciStats.date_mismatch++;
        report.issues.push({
          type: 'warning',
          collection: 'comfort_index',
          issue: `Grade mismatch: score=${ci.uci_score}, expected=${expectedGrade}, actual=${ci.uci_grade}`,
          document_id: ci._id
        });
      }
    });

    console.log(`  Total records: ${uciStats.total}`);
    console.log(`  Invalid uci_score: ${uciStats.invalid_uci_score}`);
    console.log(`  Invalid grade: ${uciStats.invalid_grade}`);
    console.log(`  Grade mismatches: ${uciStats.date_mismatch}`);

    // 4. Anomaly Signals 검증
    console.log('\n📊 Validating anomaly_signals...');
    const anomalySignals = await AnomalySignal.find({}).lean();
    const anomalyStats = {
      total: anomalySignals.length,
      invalid_score: 0,
      invalid_unit_id: 0
    };

    anomalySignals.forEach(anomaly => {
      // anomaly_score 범위 검증 (0-1)
      if (anomaly.anomaly_score < 0 || anomaly.anomaly_score > 1) {
        anomalyStats.invalid_score++;
        report.issues.push({
          type: 'critical',
          collection: 'anomaly_signals',
          issue: `Invalid anomaly_score: ${anomaly.anomaly_score} (must be 0-1)`,
          document_id: anomaly._id
        });
      }
    });

    console.log(`  Total records: ${anomalyStats.total}`);
    console.log(`  Invalid scores: ${anomalyStats.invalid_score}`);

    // 5. 데이터 완전성 체크
    console.log('\n📊 Checking data completeness...');
    const latestDate = await SignalHuman.findOne({ signal_type: 'total' })
      .sort({ date: -1 })
      .lean();
    
    if (latestDate) {
      const latestDateStr = latestDate.date;
      const dateRange = 30; // 최근 30일
      const startDate = format(subDays(parseISO(latestDateStr), dateRange), 'yyyy-MM-dd');
      
      const dateCoverage = await SignalHuman.aggregate([
        {
          $match: {
            signal_type: 'total',
            date: { $gte: startDate, $lte: latestDateStr }
          }
        },
        {
          $group: {
            _id: '$date',
            count: { $sum: 1 }
          }
        },
        {
          $sort: { _id: -1 }
        }
      ]);

      console.log(`  Latest date: ${latestDateStr}`);
      console.log(`  Date range checked: ${startDate} ~ ${latestDateStr}`);
      console.log(`  Days with data: ${dateCoverage.length} / ${dateRange}`);
      
      if (dateCoverage.length < dateRange * 0.8) {
        report.issues.push({
          type: 'warning',
          collection: 'signals_human',
          issue: `Low date coverage: ${dateCoverage.length}/${dateRange} days (${(dateCoverage.length/dateRange*100).toFixed(1)}%)`
        });
      }
    }

    // 리포트 요약
    report.summary.critical = report.issues.filter(i => i.type === 'critical').length;
    report.summary.warnings = report.issues.filter(i => i.type === 'warning').length;
    report.summary.total_issues = report.issues.length;

    // 출력
    console.log('\n' + '='.repeat(60));
    console.log('📋 Validation Report');
    console.log('='.repeat(60));
    console.log(`Total Issues: ${report.summary.total_issues}`);
    console.log(`  Critical: ${report.summary.critical}`);
    console.log(`  Warnings: ${report.summary.warnings}`);

    if (report.summary.critical > 0) {
      console.log('\n❌ Critical Issues:');
      report.issues.filter(i => i.type === 'critical').slice(0, 10).forEach(issue => {
        console.log(`  - ${issue.collection}: ${issue.issue}`);
      });
      if (report.summary.critical > 10) {
        console.log(`  ... and ${report.summary.critical - 10} more`);
      }
    }

    if (report.summary.warnings > 0 && report.summary.warnings <= 20) {
      console.log('\n⚠️  Warnings:');
      report.issues.filter(i => i.type === 'warning').forEach(issue => {
        console.log(`  - ${issue.collection}: ${issue.issue}`);
      });
    }

    if (report.summary.total_issues === 0) {
      console.log('\n✅ No issues found! Data validation passed.');
    } else {
      console.log(`\n⚠️  Found ${report.summary.total_issues} issues. Please review and fix.`);
    }

    return report;
  } catch (error) {
    console.error('❌ Validation error:', error);
    throw error;
  }
}

/**
 * UCI 점수로 등급 계산
 */
function getGradeFromScore(score) {
  if (score >= 80) return 'E';
  if (score >= 60) return 'D';
  if (score >= 40) return 'C';
  if (score >= 20) return 'B';
  return 'A';
}

// 실행
validateData()
  .then(() => {
    console.log('\n✅ Validation completed');
    process.exit(0);
  })
  .catch(error => {
    console.error('❌ Validation failed:', error);
    process.exit(1);
  });

