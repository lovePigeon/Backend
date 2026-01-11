import mongoose from 'mongoose';
import dotenv from 'dotenv';
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';
import csv from 'csv-parser';
import CleanupLog from '../models/CleanupLog.js';
import { connectDB } from '../config/database.js';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

dotenv.config();

/**
 * 서울특별시 강남구_쓰레기수거+현황.csv 처리
 * 
 * 역할: 개입 정보 및 Before/After 효과 추적용 데이터
 * - cleanup_logs 컬렉션에 저장
 * - Before/After Tracking에만 사용
 */
async function etlCleanupLogs(filePath) {
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
  const operations = [];
  let rowCount = 0;
  
  // CSV 구조 파싱 (실제 파일 구조에 맞게 수정 필요)
  // 예상 컬럼: 시점, 자치구별, 수거량, 처리량, 처리방법 등
  
  for (const row of rows) {
    rowCount++;
    
    // 시점 추출
    const year = String(row['시점'] || row['년도'] || '').trim();
    if (!year || !/^\d{4}$/.test(year)) {
      continue; // 헤더나 유효하지 않은 행 스킵
    }
    
    // 자치구 추출
    const district = String(row['자치구별(1)'] || row['자치구별(2)'] || row['자치구'] || '').trim();
    if (!district || district === '합계' || district === '소계') {
      continue;
    }
    
    // unit_id 매핑 (자치구 → 행정동)
    // 실제로는 자치구를 여러 행정동으로 매핑하거나, 자치구 단위로 저장
    const unitIds = await findUnitIdsByDistrict(district);
    
    if (unitIds.length === 0) {
      console.log(`  ⚠️  Cannot map district to unit_ids: ${district}`);
      continue;
    }
    
    // 데이터 추출
    const collectionAmount = parseFloat(row['배출량(C) (톤/일)'] || row['배출량'] || 0);
    const processingAmount = parseFloat(row['처리량(D) (톤/일)'] || row['처리량'] || 0);
    const collectionRate = parseFloat(row['수거율(D/C) (%)'] || row['수거율'] || 0);
    const populationRate = parseFloat(row['수거지인구율(B/A) (%)'] || row['인구율'] || 0);
    
    const processingMethod = {
      landfill: parseFloat(row['매립'] || 0),
      incineration: parseFloat(row['소각'] || 0),
      recycling: parseFloat(row['재활용'] || 0),
      other: parseFloat(row['기타'] || 0)
    };
    
    // 각 unit_id에 대해 cleanup_log 생성
    // 날짜는 연도 기준으로 1월 1일로 설정 (또는 월별 데이터면 해당 월)
    const date = `${year}-01-01`; // 연도별 데이터로 가정
    
    for (const unitId of unitIds) {
      operations.push({
        updateOne: {
          filter: { unit_id: unitId, date },
          update: {
            $set: {
              unit_id: unitId,
              date,
              cleanup_type: 'regular',
              collection_amount: collectionAmount,
              collection_rate: collectionRate,
              processing_method: processingMethod,
              population_rate: populationRate,
              source: 'seoul_cleanup_status',
              meta: {
                district,
                year: parseInt(year),
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
    await CleanupLog.bulkWrite(operations, { ordered: false });
    console.log(`  ✅ Processed ${rowCount} rows, created ${operations.length} cleanup logs`);
  } else {
    console.log(`  ⚠️  No valid data found`);
  }
  
  return { rowCount, operationsCount: operations.length };
}

/**
 * 자치구를 unit_id로 매핑
 * 실제로는 자치구에 속한 모든 행정동을 반환
 */
async function findUnitIdsByDistrict(district) {
  const SpatialUnit = (await import('../models/SpatialUnit.js')).default;
  
  // 자치구 이름으로 행정동 찾기 (간단한 구현)
  // 실제로는 자치구-행정동 매핑 테이블 필요
  const units = await SpatialUnit.find({
    name: { $regex: district }
  });
  
  return units.map(u => u._id);
}

async function main() {
  try {
    console.log('🚀 Starting ETL pipeline for cleanup logs...\n');
    
    await connectDB();
    
    const rawDir = path.join(__dirname, '..', 'data', 'raw');
    const files = fs.readdirSync(rawDir).filter(f => 
      f.includes('수거') && f.includes('현황') && f.endsWith('.csv')
    );
    
    if (files.length === 0) {
      console.log('⚠️  No cleanup status files found.');
      console.log('   File name should include "수거" and "현황"\n');
      process.exit(0);
    }
    
    console.log(`📁 Found ${files.length} files:\n`);
    files.forEach((f, i) => console.log(`  ${i + 1}. ${f}`));
    
    for (const filename of files) {
      const filePath = path.join(rawDir, filename);
      await etlCleanupLogs(filePath);
    }
    
    console.log('\n✅ ETL pipeline completed successfully!');
    
    // 통계 출력
    const count = await CleanupLog.countDocuments();
    console.log(`\n📊 Cleanup logs: ${count}개\n`);
    
    await mongoose.connection.close();
    process.exit(0);
  } catch (error) {
    console.error('❌ Error:', error);
    await mongoose.connection.close();
    process.exit(1);
  }
}

main();

