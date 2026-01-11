import mongoose from 'mongoose';
import dotenv from 'dotenv';
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';
import csv from 'csv-parser';
import { parseISO, format, getDay, getHours } from 'date-fns';
import TimePatternTemplate from '../models/TimePatternTemplate.js';
import { connectDB } from '../config/database.js';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

dotenv.config();

/**
 * 전북특별자치도 전주시_쓰레기 불법투기 단속현황.csv 처리
 * 
 * 역할: 시간 패턴 템플릿 데이터 (언제 문제되는가)
 * - 시간 패턴 정의용 (hour, day_of_week, is_night, is_weekend)
 * - Action Card 룰 생성용 템플릿
 * - 예측용이 아닌 행동 패턴 레퍼런스
 */
async function etlTimePatternTemplates(filePath) {
  console.log(`\n📥 ETL Processing: ${path.basename(filePath)}\n`);
  
  const rows = [];
  
  return new Promise((resolve, reject) => {
    fs.createReadStream(filePath)
      .pipe(csv())
      .on('data', (row) => rows.push(row))
      .on('end', () => processRows(rows, filePath).then(resolve).catch(reject))
      .on('error', reject);
  });
}

async function processRows(rows, filePath) {
  // 위반내용별로 그룹화
  const violationsByType = {};
  
  for (const row of rows) {
    const violationType = String(row['위반내용'] || row['위반 내용'] || '').trim();
    if (!violationType) continue;
    
    if (!violationsByType[violationType]) {
      violationsByType[violationType] = [];
    }
    
    const violationDate = String(row['위반일자'] || row['위반 일자'] || '').trim();
    const violationTime = String(row['위반시간'] || row['위반 시간'] || '').trim();
    
    if (violationDate) {
      violationsByType[violationType].push({
        date: violationDate,
        time: violationTime
      });
    }
  }
  
  const operations = [];
  
  // 각 위반 유형별로 시간 패턴 분석
  for (const [violationType, violations] of Object.entries(violationsByType)) {
    if (violations.length === 0) continue;
    
    const hourDistribution = Array(24).fill(0);
    const dayDistribution = { 월: 0, 화: 0, 수: 0, 목: 0, 금: 0, 토: 0, 일: 0 };
    let nightCount = 0;
    let weekendCount = 0;
    let totalCount = 0;
    
    const dayNames = ['일', '월', '화', '수', '목', '금', '토'];
    
    for (const violation of violations) {
      try {
        // 날짜 파싱
        const dateStr = violation.date;
        if (!dateStr || !/^\d{4}-\d{2}-\d{2}/.test(dateStr)) continue;
        
        const date = parseISO(dateStr.split(' ')[0]);
        const dayOfWeek = getDay(date); // 0=일요일, 1=월요일, ...
        const dayName = dayNames[dayOfWeek];
        
        dayDistribution[dayName]++;
        
        // 주말 체크
        if (dayOfWeek === 0 || dayOfWeek === 6) {
          weekendCount++;
        }
        
        // 시간 파싱
        let hour = 12; // 기본값: 정오
        if (violation.time) {
          const timeMatch = violation.time.match(/(\d{1,2})/);
          if (timeMatch) {
            hour = parseInt(timeMatch[1]);
            if (hour < 0 || hour > 23) hour = 12;
          }
        }
        
        hourDistribution[hour]++;
        
        // 야간 체크 (20-06시)
        if (hour >= 20 || hour < 6) {
          nightCount++;
        }
        
        totalCount++;
      } catch (error) {
        // 날짜 파싱 실패 시 스킵
        continue;
      }
    }
    
    if (totalCount === 0) continue;
    
    // 비율 계산
    const nightRatio = totalCount > 0 ? nightCount / totalCount : 0;
    const weekendRatio = totalCount > 0 ? weekendCount / totalCount : 0;
    
    // 피크 시간대 찾기 (상위 3개)
    const hourCounts = hourDistribution.map((count, hour) => ({ hour, count }));
    hourCounts.sort((a, b) => b.count - a.count);
    const peakHours = hourCounts.slice(0, 3).map(h => h.hour);
    
    // 피크 요일 찾기 (상위 2개)
    const dayCounts = Object.entries(dayDistribution).map(([day, count]) => ({ day, count }));
    dayCounts.sort((a, b) => b.count - a.count);
    const peakDays = dayCounts.slice(0, 2).map(d => d.day);
    
    // pattern_type 결정
    let patternType = 'illegal_dumping';
    if (violationType.includes('악취') || violationType.includes('냄새')) {
      patternType = 'odor_complaint';
    } else if (violationType.includes('민원') || violationType.includes('신고')) {
      patternType = 'waste_complaint';
    }
    
    operations.push({
      updateOne: {
        filter: { 
          pattern_type: patternType,
          violation_type: violationType
        },
        update: {
          $set: {
            pattern_type: patternType,
            violation_type: violationType,
            time_pattern: {
              hour_distribution: hourDistribution,
              day_of_week_distribution: dayDistribution,
              night_ratio: nightRatio,
              weekend_ratio: weekendRatio,
              peak_hours: peakHours,
              peak_days: peakDays
            },
            sample_size: totalCount,
            source: 'jeonju_illegal_dumping',
            meta: {
              raw_file: path.basename(filePath)
            }
          }
        },
        upsert: true
      }
    });
  }
  
  if (operations.length > 0) {
    await TimePatternTemplate.bulkWrite(operations, { ordered: false });
    console.log(`  ✅ Processed ${rows.length} rows, created ${operations.length} time pattern templates`);
    
    // 샘플 출력
    const sample = await TimePatternTemplate.findOne({ pattern_type: 'illegal_dumping' });
    if (sample) {
      console.log(`\n  📊 Sample template:`);
      console.log(`     Pattern: ${sample.pattern_type}`);
      console.log(`     Violation: ${sample.violation_type}`);
      console.log(`     Night ratio: ${(sample.time_pattern.night_ratio * 100).toFixed(1)}%`);
      console.log(`     Weekend ratio: ${(sample.time_pattern.weekend_ratio * 100).toFixed(1)}%`);
      console.log(`     Peak hours: ${sample.time_pattern.peak_hours.join(', ')}`);
      console.log(`     Sample size: ${sample.sample_size}`);
    }
  } else {
    console.log(`  ⚠️  No valid data found`);
  }
  
  return { rowCount: rows.length, operationsCount: operations.length };
}

async function main() {
  try {
    console.log('🚀 Starting ETL pipeline for time pattern templates...\n');
    
    await connectDB();
    
    const rawDir = path.join(__dirname, '..', 'data', 'raw');
    const files = fs.readdirSync(rawDir).filter(f => 
      (f.includes('전주') || f.includes('전북')) && 
      (f.includes('불법') || f.includes('단속')) && 
      f.endsWith('.csv')
    );
    
    if (files.length === 0) {
      console.log('⚠️  No time pattern template files found.');
      console.log('   File name should include "전주" or "전북" and "불법" or "단속"\n');
      process.exit(0);
    }
    
    console.log(`📁 Found ${files.length} files:\n`);
    files.forEach((f, i) => console.log(`  ${i + 1}. ${f}`));
    
    for (const filename of files) {
      const filePath = path.join(rawDir, filename);
      await etlTimePatternTemplates(filePath);
    }
    
    console.log('\n✅ ETL pipeline completed successfully!');
    
    // 통계 출력
    const count = await TimePatternTemplate.countDocuments();
    const patterns = await TimePatternTemplate.distinct('pattern_type');
    console.log(`\n📊 Time pattern templates: ${count}개`);
    console.log(`   Pattern types: ${patterns.join(', ')}\n`);
    
    await mongoose.connection.close();
    process.exit(0);
  } catch (error) {
    console.error('❌ Error:', error);
    await mongoose.connection.close();
    process.exit(1);
  }
}

main();

