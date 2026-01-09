import mongoose from 'mongoose';
import dotenv from 'dotenv';
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';
import csv from 'csv-parser';
import BaselineMetric from '../models/BaselineMetric.js';
import SpatialUnit from '../models/SpatialUnit.js';
import { connectDB } from '../config/database.js';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

dotenv.config();

/**
 * CSV/XLSX 파일을 파싱하여 baseline_metrics에 저장
 * 
 * 데이터 구조:
 * - 년도, 월, 교통, 도로, 청소, 주택건축, ..., 총합계
 * - 각 행은 한 달의 데이터
 */
async function etlBaselineMetrics(filePath) {
  console.log(`\n📥 ETL Processing: ${path.basename(filePath)}`);
  
  const isXLSX = filePath.endsWith('.xlsx');
  const rows = [];
  
  // 파일 읽기
  if (isXLSX) {
    try {
      const XLSX = (await import('xlsx')).default;
      const workbook = XLSX.readFile(filePath);
      const sheetName = workbook.SheetNames[0];
      const worksheet = workbook.Sheets[sheetName];
      const data = XLSX.utils.sheet_to_json(worksheet);
      rows.push(...data);
      return processRows(rows, filePath);
    } catch (error) {
      console.log(`  ⚠️  XLSX 파일 처리 오류: ${error.message}`);
      return { rowCount: 0, operationsCount: 0 };
    }
  } else {
    return new Promise((resolve, reject) => {
      fs.createReadStream(filePath)
        .pipe(csv())
        .on('data', (row) => rows.push(row))
        .on('end', () => processRows(rows, filePath).then(resolve).catch(reject))
        .on('error', reject);
    });
  }
}

async function processRows(rows, filePath) {
  // spatial_units 개수 조회 (평균 계산용)
  const unitCount = await SpatialUnit.countDocuments();
  const avgDivisor = unitCount > 0 ? unitCount : 37; // 기본값 37
  
  const operations = [];
  let rowCount = 0;
  
  // 카테고리 매핑 (CSV 컬럼명 → 우리 카테고리)
  const categoryMapping = {
    '청소': '청소',
    '환경': '환경',
    '도로': '도로',
    '교통': '교통',
    '주택건축': '주택건축',
    '가로정비': '가로정비',
    '보건': '보건',
    '공원녹지': '공원녹지',
    '총합계': '전체'
  };
  
  for (const row of rows) {
    rowCount++;
    
    // 년도, 월 추출
    const year = String(row['년도'] || row['연도'] || '').trim();
    const month = String(row['월'] || '').trim().padStart(2, '0');
    
    if (!year || !month || !/^\d{4}$/.test(year)) {
      continue; // 헤더나 유효하지 않은 행 스킵
    }
    
    const period = `${year}-${month}`;
    
    // 전월 데이터 조회 (증가율 계산용)
    const prevMonth = parseInt(month) - 1;
    const prevYear = prevMonth === 0 ? parseInt(year) - 1 : parseInt(year);
    const prevPeriod = prevMonth === 0 
      ? `${prevYear}-12`
      : `${year}-${String(prevMonth).padStart(2, '0')}`;
    
    // 각 카테고리별로 저장
    for (const [csvCol, category] of Object.entries(categoryMapping)) {
      const value = row[csvCol];
      if (value === undefined || value === null || value === '') {
        continue;
      }
      
      // 숫자 변환 (쉼표 제거)
      const numValue = typeof value === 'string' 
        ? parseInt(value.replace(/,/g, '').trim()) || 0
        : parseInt(value) || 0;
      
      if (numValue === 0 && category !== '전체') {
        continue; // 0인 경우 스킵 (전체는 제외)
      }
      
      // 증가율 계산
      let growthRate = 0;
      if (category === '전체') {
        // 전월 총합계 조회
        const prevBaseline = await BaselineMetric.findOne({ 
          period: prevPeriod, 
          category: '전체' 
        });
        if (prevBaseline && prevBaseline.citywide_total > 0) {
          growthRate = (numValue - prevBaseline.citywide_total) / prevBaseline.citywide_total;
        }
      }
      
      const citywideAvgPerUnit = numValue / avgDivisor;
      
      operations.push({
        updateOne: {
          filter: { period, category },
          update: {
            $set: {
              period,
              category,
              citywide_total: numValue,
              citywide_avg_per_unit: citywideAvgPerUnit,
              growth_rate: growthRate,
              source: 'smart_complaint',
              meta: {
                year: parseInt(year),
                month: parseInt(month),
                raw_file: path.basename(filePath)
              }
            }
          },
          upsert: true
        }
      });
    }
  }
  
  if (operations.length > 0) {
    await BaselineMetric.bulkWrite(operations, { ordered: false });
    console.log(`  ✅ Processed ${rowCount} rows, created ${operations.length} baseline metrics`);
  } else {
    console.log(`  ⚠️  No valid data found`);
  }
  
  return { rowCount, operationsCount: operations.length };
}

async function main() {
  try {
    console.log('🚀 Starting ETL pipeline for baseline metrics...\n');
    
    await connectDB();
    
    const rawDir = path.join(__dirname, '..', 'data', 'raw');
    const allFiles = fs.readdirSync(rawDir);
    
    // 파일명에 "2025" 포함하고 CSV/XLSX인 파일 (베이스라인 데이터)
    const files = allFiles.filter(f => {
      return (f.endsWith('.csv') || f.endsWith('.xlsx')) && f.includes('2025');
    });
    
    console.log(`\n📁 Found ${files.length} baseline metric files:\n`);
    
    console.log(`📁 Found ${files.length} baseline metric files:\n`);
    files.forEach((f, i) => console.log(`  ${i + 1}. ${f}`));
    
    for (const filename of files) {
      const filePath = path.join(rawDir, filename);
      await etlBaselineMetrics(filePath);
    }
    
    console.log('\n✅ ETL pipeline completed successfully!');
    
    // 통계 출력
    const count = await BaselineMetric.countDocuments();
    const periods = await BaselineMetric.distinct('period');
    console.log(`\n📊 Baseline metrics: ${count}개`);
    console.log(`   기간: ${periods.sort().join(', ')}\n`);
    
    await mongoose.connection.close();
    process.exit(0);
  } catch (error) {
    console.error('❌ Error:', error);
    await mongoose.connection.close();
    process.exit(1);
  }
}

main();

