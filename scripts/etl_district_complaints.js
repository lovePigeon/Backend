import mongoose from 'mongoose';
import dotenv from 'dotenv';
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';
import csv from 'csv-parser';
import XLSX from 'xlsx';
import SignalHuman from '../models/SignalHuman.js';
import { connectDB } from '../config/database.js';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

dotenv.config();

// 구 이름 -> 구 코드 매핑
const DISTRICT_CODE_MAP = {
  '종로구': '11110',
  '중구': '11140',
  '용산구': '11170',
  '성동구': '11200',
  '광진구': '11215',
  '동대문구': '11230',
  '중랑구': '11260',
  '성북구': '11290',
  '강북구': '11305',
  '도봉구': '11320',
  '노원구': '11350',
  '은평구': '11380',
  '서대문구': '11410',
  '마포구': '11440',
  '양천구': '11470',
  '강서구': '11500',
  '구로구': '11530',
  '금천구': '11545',
  '영등포구': '11560',
  '동작구': '11590',
  '관악구': '11620',
  '서초구': '11650',
  '강남구': '11680',
  '송파구': '11710',
  '강동구': '11740'
};

/**
 * CSV 파일 처리
 */
async function processCSV(filePath) {
  console.log(`\n📥 Processing CSV: ${path.basename(filePath)}`);

  const rows = [];
  let rowCount = 0;

  // CP949 인코딩 지원을 위해 iconv-lite 사용
  let iconv;
  try {
    iconv = (await import('iconv-lite')).default;
  } catch (e) {
    // iconv-lite가 없으면 기본 인코딩 사용
    iconv = null;
  }

  return new Promise((resolve, reject) => {
    const stream = fs.createReadStream(filePath);
    
    // 인코딩 변환 스트림 추가 (있는 경우)
    let csvStream;
    if (iconv) {
      const iconvStream = iconv.decodeStream('cp949');
      csvStream = stream.pipe(iconvStream).pipe(csv());
    } else {
      // UTF-8로 시도
      csvStream = stream.pipe(csv());
    }

    csvStream
      .on('data', (row) => {
        rows.push(row);
        rowCount++;
      })
      .on('end', async () => {
        console.log(`  Total rows: ${rowCount}`);
        try {
          const operations = await parseRows(rows, filePath);
          resolve(operations);
        } catch (error) {
          reject(error);
        }
      })
      .on('error', (error) => {
        // CP949 실패 시 UTF-8로 재시도
        if (iconv && !error.message.includes('UTF')) {
          console.log(`  ⚠️  CP949 decode failed, retrying with UTF-8...`);
          fs.createReadStream(filePath, { encoding: 'utf8' })
            .pipe(csv())
            .on('data', (row) => {
              if (!rows.find(r => JSON.stringify(r) === JSON.stringify(row))) {
                rows.push(row);
                rowCount++;
              }
            })
            .on('end', async () => {
              console.log(`  Total rows (retry): ${rowCount}`);
              try {
                const operations = await parseRows(rows, filePath);
                resolve(operations);
              } catch (err) {
                reject(err);
              }
            })
            .on('error', reject);
        } else {
          reject(error);
        }
      });
  });
}

/**
 * XLSX 파일 처리
 */
async function processXLSX(filePath) {
  console.log(`\n📥 Processing XLSX: ${path.basename(filePath)}`);

  const workbook = XLSX.readFile(filePath);
  const sheetName = workbook.SheetNames[0];
  const worksheet = workbook.Sheets[sheetName];
  const rows = XLSX.utils.sheet_to_json(worksheet, { defval: '' });

  console.log(`  Total rows: ${rows.length}`);
  const operations = await parseRows(rows, filePath);
  return operations;
}

/**
 * 행 데이터 파싱하여 MongoDB operations 생성
 */
async function parseRows(rows, filePath) {
  const operations = [];
  let processedCount = 0;

  for (const row of rows) {
    // 년도, 월 추출 - 다양한 키 이름 시도
    let year = null;
    let month = null;

    // 년도 찾기 - 모든 키 확인
    for (const key of Object.keys(row)) {
      const val = row[key];
      if (val && !isNaN(parseInt(String(val)))) {
        const numVal = parseInt(String(val));
        // 첫 번째 숫자 컬럼이 년도일 가능성
        if (key === '년도' || (key.length <= 5 && numVal >= 2000 && numVal <= 2030)) {
          year = numVal;
          break;
        }
      }
    }

    // 월 찾기
    for (const key of Object.keys(row)) {
      const val = row[key];
      if (val && !isNaN(parseInt(String(val)))) {
        const numVal = parseInt(String(val));
        if (key === '월' || (key === Object.keys(row)[1] && numVal >= 1 && numVal <= 12)) {
          month = numVal;
          break;
        }
      }
    }

    // 년도와 월이 모두 필요
    if (!year || !month) {
      continue;
    }

    const dateStr = `${year}-${String(month).padStart(2, '0')}-01`;
    const fileName = path.basename(filePath);

    // 각 구별로 데이터 처리
    for (const [districtName, districtCode] of Object.entries(DISTRICT_CODE_MAP)) {
      const value = row[districtName];
      if (!value && value !== 0) continue;

      // 값 정리 (문자열인 경우 쉼표 제거)
      let cleanValue = String(value).replace(/,/g, '').trim();
      cleanValue = cleanValue.replace(/"/g, ''); // 따옴표 제거

      const numValue = parseInt(cleanValue);
      if (isNaN(numValue) || numValue < 0) continue;

      // operation 생성 (SignalHuman 스키마에 맞게)
      operations.push({
        updateOne: {
          filter: {
            unit_id: districtCode,
            date: dateStr,
            signal_type: 'total'
          },
          update: {
            $set: {
              unit_id: districtCode,
              date: dateStr,
              signal_type: 'total',
              value: numValue,
              meta: {
                source: 'seoul_district_complaints',
                category: 'complaint',
                district_name: districtName,
                raw_file: fileName,
                aggregation_level: 'district',
                raw: {}
              }
            }
          },
          upsert: true
        }
      });
    }

    processedCount++;
    if (processedCount % 100 === 0) {
      console.log(`  Processed ${processedCount}/${rows.length} rows...`);
    }
  }

  console.log(`  Generated ${operations.length} operations from ${processedCount} rows`);
  return operations;
}

/**
 * 메인 함수
 */
async function main() {
  console.log('🚀 Starting ETL pipeline for district-level complaints...\n');
  await connectDB();

  const rawDir = path.join(__dirname, '..', 'data', 'raw');
  
  // 파일 패턴 직접 지정 (인코딩 문제 회피)
  const filePatterns = [
    '*위치별*불편신고건수*.csv',
    '*위치별*불편신고건수*.xlsx'
  ];
  
  // glob을 사용하지 않고 직접 파일 이름을 확인
  // list_dir 결과를 기반으로 파일 이름 직접 지정
  const knownFiles = [
    '서울시 위치별 불편신고건수 정보_2025년_08월.csv',
    '서울시 위치별 불편신고건수 정보_2025년_09월.xlsx',
    '서울시 위치별 불편신고건수 정보_2025년_10월.xlsx',
    '서울시 위치별 불편신고건수 정보_2025년_11월.xlsx',
    '서울시 위치별 불편신고건수 정보_2025년_12월 (1).csv'
  ];
  
  // 실제로 존재하는 파일만 필터링
  const files = knownFiles.filter(f => {
    const filePath = path.join(rawDir, f);
    return fs.existsSync(filePath);
  });
  
  console.log(`\n📁 Found ${files.length} files:\n`);
  files.forEach((file, index) => console.log(`  ${index + 1}. ${file}`));
  console.log('');

  if (files.length === 0) {
    console.log('⚠️  No district complaint files found.');
    process.exit(0);
  }

  console.log(`📁 Found ${files.length} files:\n`);
  files.forEach((file, index) => console.log(`  ${index + 1}. ${file}`));
  console.log('');

  let totalOperations = 0;

  for (const file of files) {
    const filePath = path.join(rawDir, file);

    try {
      let operations;
      if (file.endsWith('.csv')) {
        operations = await processCSV(filePath);
      } else if (file.endsWith('.xlsx')) {
        operations = await processXLSX(filePath);
      } else {
        console.log(`  ⚠️  Skipping unsupported file: ${file}`);
        continue;
      }

      if (operations.length > 0) {
        // 배치로 처리
        const batchSize = 500;
        let bulkProcessedCount = 0;
        let successCount = 0;
        let errorCount = 0;

        for (let i = 0; i < operations.length; i += batchSize) {
          const batch = operations.slice(i, i + batchSize);
          try {
            const result = await SignalHuman.bulkWrite(batch, { ordered: false });
            successCount += result.insertedCount + result.modifiedCount;
            bulkProcessedCount += batch.length;

            if (bulkProcessedCount % 1000 === 0) {
              console.log(`  ✅ Processed ${bulkProcessedCount}/${operations.length} operations...`);
            }
          } catch (error) {
            errorCount += batch.length;
            console.error(`  ❌ Error in batch ${Math.floor(i / batchSize) + 1}:`, error.message);
            // 개별 저장 시도
            for (const op of batch) {
              try {
                await SignalHuman.findOneAndUpdate(
                  op.updateOne.filter,
                  op.updateOne.update.$set,
                  { upsert: true, new: true }
                );
                successCount++;
              } catch (err) {
                errorCount++;
              }
            }
          }
        }

        console.log(`  ✅ Imported ${successCount} records from ${file} (errors: ${errorCount})\n`);
        totalOperations += successCount;
      } else {
        console.log(`  ⚠️  No valid data found in ${file}\n`);
      }
    } catch (error) {
      console.error(`  ❌ Error processing ${file}:`, error.message);
    }
  }

  // 결과 요약
  const count = await SignalHuman.countDocuments({
    'meta.source': 'seoul_district_complaints'
  });
  const distinctDistricts = await SignalHuman.distinct('unit_id', {
    'meta.source': 'seoul_district_complaints'
  });
  const distinctDates = await SignalHuman.distinct('date', {
    'meta.source': 'seoul_district_complaints'
  }).then(dates => dates.sort());

  console.log(`\n✅ ETL pipeline completed successfully!`);
  console.log(`\n📊 District-level complaints: ${count.toLocaleString()}개`);
  console.log(`   총 처리된 operation 수: ${totalOperations}개`);
  console.log(`   지역 수: ${distinctDistricts.length}개`);
  console.log(`   날짜 범위: ${distinctDates[0] || '없음'} ~ ${distinctDates[distinctDates.length - 1] || '없음'}`);
  console.log(`   고유 날짜 수: ${distinctDates.length}일\n`);

  await mongoose.connection.close();
  process.exit(0);
}

main().catch(error => {
  console.error('❌ ETL pipeline failed:', error);
  process.exit(1);
});

