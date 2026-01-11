import mongoose from 'mongoose';
import dotenv from 'dotenv';
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';
import { execSync } from 'child_process';
import csv from 'csv-parser';
import SignalPopulation from '../models/SignalPopulation.js';
import { connectDB } from '../config/database.js';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

dotenv.config();

/**
 * 서울시 생활인구 데이터 ETL
 * 
 * 파일 형식: LOCAL_PEOPLE_DONG_YYYYMM.csv
 * - 기준일ID: YYYYMMDD (예: "20251201")
 * - 시간대구분: 00-23 (24시간)
 * - 행정동코드: 8자리 (예: "11110515")
 * - 총생활인구수: 숫자
 * 
 * 처리 방식:
 * 1. 시간대별 데이터를 일별로 집계
 * 2. 총생활인구수: 일별 합계 또는 평균
 * 3. 야간인구수: 시간대 20-06시 합계
 * 4. 변화율: 전일 대비 계산
 */
async function etlPopulationSignals(filePath) {
  console.log(`\n📥 ETL Processing: ${path.basename(filePath)}\n`);
  
  const rows = [];
  let rowCount = 0;
  
  return new Promise((resolve, reject) => {
    fs.createReadStream(filePath)
      .pipe(csv())
      .on('data', (row) => {
        rows.push(row);
        rowCount++;
        if (rowCount % 50000 === 0) {
          console.log(`  Read ${rowCount} rows...`);
        }
      })
      .on('end', () => {
        console.log(`  Total rows: ${rowCount}`);
        processRows(rows, filePath).then(resolve).catch(reject);
      })
      .on('error', reject);
  });
}

async function processRows(rows, filePath) {
  console.log(`  Processing in batches...`);
  
  // 일별, 행정동별로 집계
  const dailyData = {}; // { date_unitId: { date, unit_id, total_pop, night_pop, hours } }
  
  let validRowCount = 0;
  
  // 헤더 키 정규화 (BOM 문자 제거)
  const normalizeKey = (key) => {
    if (!key) return '';
    return String(key).replace(/^\uFEFF/, '').replace(/^"|"$/g, '').trim();
  };
  
  for (const row of rows) {
    // 첫 번째 키 확인 (BOM 문자 있을 수 있음)
    const keys = Object.keys(row);
    const dateKey = keys.find(k => normalizeKey(k).includes('기준일ID')) || keys[0];
    const hourKey = keys.find(k => normalizeKey(k).includes('시간대구분')) || keys[1];
    const unitKey = keys.find(k => normalizeKey(k).includes('행정동코드')) || keys[2];
    const popKey = keys.find(k => normalizeKey(k).includes('총생활인구수')) || keys[3];
    
    // 헤더 행 스킵
    if (normalizeKey(dateKey).includes('기준일ID') && !normalizeKey(row[dateKey] || '').match(/^\d{8}/)) {
      continue;
    }
    
    // 기준일ID 파싱 (YYYYMMDD)
    const baseDateId = normalizeKey(row[dateKey] || row['기준일ID'] || '');
    if (!baseDateId || !/^\d{8}$/.test(baseDateId)) {
      continue;
    }
    
    // 날짜 형식 변환 (YYYYMMDD → YYYY-MM-DD)
    const year = baseDateId.substring(0, 4);
    const month = baseDateId.substring(4, 6);
    const day = baseDateId.substring(6, 8);
    const date = `${year}-${month}-${day}`;
    
    // 행정동코드
    const unitId = normalizeKey(row[unitKey] || row['행정동코드'] || row['동코드'] || '');
    if (!unitId || !/^\d{8}$/.test(unitId)) {
      continue;
    }
    
    // 시간대 (00-23)
    const hourStr = normalizeKey(row[hourKey] || row['시간대구분'] || row['시간'] || '0');
    const hour = parseInt(hourStr);
    if (isNaN(hour) || hour < 0 || hour > 23) {
      continue;
    }
    
    // 총생활인구수
    const totalPopStr = normalizeKey(row[popKey] || row['총생활인구수'] || row['총인구'] || '0').replace(/,/g, '');
    const totalPop = parseFloat(totalPopStr);
    if (isNaN(totalPop) || totalPop <= 0) {
      continue;
    }
    
    validRowCount++;
    
    const key = `${date}_${unitId}`;
    
    if (!dailyData[key]) {
      dailyData[key] = {
        date,
        unit_id: unitId,
        total_pop: 0,
        night_pop: 0,
        hours: []
      };
    }
    
    // 총 인구수는 시간대별 평균 또는 합계 사용 (일반적으로 평균 사용)
    dailyData[key].total_pop += totalPop;
    dailyData[key].hours.push({ hour, pop: totalPop });
    
    // 야간 인구수 (20-06시)
    if (hour >= 20 || hour < 6) {
      dailyData[key].night_pop += totalPop;
    }
  }
  
  console.log(`  Aggregated ${Object.keys(dailyData).length} daily records`);
  
  // 일별 데이터를 signals_population 형식으로 변환
  const operations = [];
  const dailyRecords = Object.values(dailyData);
  
  // 전일 데이터를 저장하여 변화율 계산
  const prevDayData = {}; // { unit_id: { date, pop_total } }
  
  // 날짜 순으로 정렬
  dailyRecords.sort((a, b) => {
    if (a.date !== b.date) return a.date.localeCompare(b.date);
    return a.unit_id.localeCompare(b.unit_id);
  });
  
  for (const record of dailyRecords) {
    // 총 인구수는 시간대별 평균 사용 (24시간 평균)
    const hourCount = record.hours.length;
    const popTotal = hourCount > 0 ? Math.round(record.total_pop / hourCount) : 0;
    
    // 야간 인구수는 야간 시간대 평균
    const nightHourCount = record.hours.filter(h => h.hour >= 20 || h.hour < 6).length;
    const popNight = nightHourCount > 0 ? Math.round(record.night_pop / nightHourCount) : 0;
    
    // 변화율 계산 (전일 대비)
    let popChangeRate = 0;
    const prevKey = prevDayData[record.unit_id];
    if (prevKey && prevKey.pop_total > 0) {
      popChangeRate = (popTotal - prevKey.pop_total) / prevKey.pop_total;
    }
    
    // 전일 데이터 업데이트
    prevDayData[record.unit_id] = {
      date: record.date,
      pop_total: popTotal
    };
    
    operations.push({
      updateOne: {
        filter: {
          unit_id: record.unit_id,
          date: record.date
        },
        update: {
          $set: {
            unit_id: record.unit_id,
            date: record.date,
            pop_total: popTotal,
            pop_night: popNight > 0 ? popNight : null,
            pop_change_rate: popChangeRate !== 0 ? Math.round(popChangeRate * 1000) / 1000 : null,
            source: 'seoul_living_population',
            raw: {
              hour_count: hourCount,
              night_hour_count: nightHourCount,
              raw_file: path.basename(filePath)
            }
          }
        },
        upsert: true
      }
    });
  }
  
  if (operations.length > 0) {
    // 배치로 처리 (메모리 절약)
    const batchSize = 1000;
    let processedCount = 0;
    
    for (let i = 0; i < operations.length; i += batchSize) {
      const batch = operations.slice(i, i + batchSize);
      await SignalPopulation.bulkWrite(batch, { ordered: false });
      processedCount += batch.length;
      
      if (i % 10000 === 0) {
        console.log(`  Processed ${processedCount}/${operations.length} records...`);
      }
    }
    
    console.log(`  ✅ Created ${operations.length} population signals`);
  } else {
    console.log(`  ⚠️  No valid data found`);
  }
  
  return { rowCount: validRowCount, operationsCount: operations.length };
}

/**
 * ZIP 파일 압축 해제
 */
function extractZip(zipPath, extractDir) {
  try {
    // unzip 명령어 사용 (macOS/Linux 기본 제공)
    execSync(`unzip -o -q "${zipPath}" -d "${extractDir}"`, { stdio: 'ignore' });
    return true;
  } catch (error) {
    console.error(`  ❌ Failed to extract ${path.basename(zipPath)}:`, error.message);
    return false;
  }
}

async function main() {
  try {
    console.log('🚀 Starting ETL pipeline for population signals...\n');
    
    await connectDB();
    
    const rawDir = path.join(__dirname, '..', 'data', 'raw');
    const tempDir = path.join(rawDir, '.temp_extract');
    
    // 임시 디렉토리 생성
    if (!fs.existsSync(tempDir)) {
      fs.mkdirSync(tempDir, { recursive: true });
    }
    
    // ZIP 파일 찾기
    const zipFiles = fs.readdirSync(rawDir).filter(f => 
      (f.includes('LOCAL_PEOPLE') || f.includes('local_people') || f.includes('생활인구')) &&
      f.endsWith('.zip')
    ).sort();
    
    // CSV 파일 찾기
    const csvFiles = fs.readdirSync(rawDir).filter(f => 
      (f.includes('LOCAL_PEOPLE') || f.includes('local_people') || f.includes('생활인구')) &&
      f.endsWith('.csv')
    );
    
    const allFiles = [...csvFiles];
    
    // ZIP 파일 압축 해제
    if (zipFiles.length > 0) {
      console.log(`📦 Found ${zipFiles.length} ZIP files, extracting...\n`);
      
      for (const zipFile of zipFiles) {
        const zipPath = path.join(rawDir, zipFile);
        console.log(`  Extracting ${zipFile}...`);
        
        if (extractZip(zipPath, tempDir)) {
          // 압축 해제된 CSV 파일 찾기
          const extractedFiles = fs.readdirSync(tempDir).filter(f => f.endsWith('.csv'));
          if (extractedFiles.length > 0) {
            // 첫 번째 CSV 파일을 원본 ZIP 파일명과 동일한 이름으로 변경
            const extractedPath = path.join(tempDir, extractedFiles[0]);
            const targetPath = path.join(rawDir, zipFile.replace('.zip', '.csv'));
            
            // 이미 존재하면 스킵
            if (!fs.existsSync(targetPath)) {
              fs.renameSync(extractedPath, targetPath);
              allFiles.push(zipFile.replace('.zip', '.csv'));
              console.log(`    ✅ Extracted to ${path.basename(targetPath)}`);
            } else {
              fs.unlinkSync(extractedPath);
              allFiles.push(zipFile.replace('.zip', '.csv'));
              console.log(`    ⏭️  Already exists, skipped`);
            }
          }
        }
      }
      
      // 임시 디렉토리 정리
      try {
        fs.rmSync(tempDir, { recursive: true, force: true });
      } catch (e) {
        // 무시
      }
      
      console.log('');
    }
    
    // 중복 제거 및 정렬
    const uniqueFiles = [...new Set(allFiles)].sort();
    
    if (uniqueFiles.length === 0) {
      console.log('⚠️  No population signal files found.');
      console.log('   File name should include "LOCAL_PEOPLE" or "생활인구"\n');
      process.exit(0);
    }
    
    console.log(`📁 Found ${uniqueFiles.length} CSV files to process:\n`);
    uniqueFiles.forEach((f, i) => {
      if (i < 10 || i >= uniqueFiles.length - 5) {
        console.log(`  ${i + 1}. ${f}`);
      } else if (i === 10) {
        console.log(`  ... (${uniqueFiles.length - 15} more files) ...`);
      }
    });
    console.log('');
    
    let totalProcessed = 0;
    for (const filename of uniqueFiles) {
      const filePath = path.join(rawDir, filename);
      if (fs.existsSync(filePath)) {
        const result = await etlPopulationSignals(filePath);
        totalProcessed += result.operationsCount;
      }
    }
    
    console.log('\n✅ ETL pipeline completed successfully!');
    
    // 통계 출력
    const count = await SignalPopulation.countDocuments();
    const dates = await SignalPopulation.distinct('date').then(d => d.sort().slice(-5));
    const unitIds = await SignalPopulation.distinct('unit_id');
    
    console.log(`\n📊 Population signals: ${count}개`);
    console.log(`   지역 수: ${unitIds.length}개`);
    console.log(`   최근 날짜: ${dates.join(', ')}\n`);
    
    await mongoose.connection.close();
    process.exit(0);
  } catch (error) {
    console.error('❌ Error:', error);
    await mongoose.connection.close();
    process.exit(1);
  }
}

main();

