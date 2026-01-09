import mongoose from 'mongoose';
import dotenv from 'dotenv';
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';
import csv from 'csv-parser';
import SignalHuman from '../models/SignalHuman.js';
import { connectDB } from '../config/database.js';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

dotenv.config();

/**
 * CSV 데이터를 signal_type별로 분리하여 signals_human에 저장
 * 최종 구조: date, unit_id, signal_type, value, meta
 */
async function etlHumanSignals(filePath) {
  console.log(`\n📥 ETL Processing: ${path.basename(filePath)}`);
  
  const rows = [];
  let rowCount = 0;

  // 먼저 모든 행을 메모리에 읽기
  return new Promise((resolve, reject) => {
    fs.createReadStream(filePath)
      .pipe(csv())
      .on('data', (row) => {
        rows.push(row);
        rowCount++;
        if (rowCount % 1000 === 0) {
          console.log(`  Read ${rowCount} rows...`);
        }
      })
      .on('end', async () => {
        console.log(`  Total rows: ${rowCount}`);
        console.log(`  Processing in batches...`);
        
        let successCount = 0;
        let errorCount = 0;
        const batchSize = 100;
        
        // 배치로 처리
        for (let i = 0; i < rows.length; i += batchSize) {
          const batch = rows.slice(i, i + batchSize);
          
          try {
            const operations = [];
            
            batch.forEach(row => {
              const getValue = (keys, defaultValue = null) => {
                for (const key of keys) {
                  if (row[key] !== undefined && row[key] !== '' && row[key] !== null) {
                    return row[key];
                  }
                }
                return defaultValue;
              };

              // unit_id 생성
              let unitId = getValue(['unit_id', '동코드', '지역코드', 'location_id']);
              if (!unitId) {
                const district = getValue(['자치구별(2)', '구명', 'district']);
                if (district && district !== '소계' && district !== '합계') {
                  const hash = district.split('').reduce((acc, char) => acc + char.charCodeAt(0), 0);
                  unitId = `11110${(500 + (hash % 50)).toString().padStart(3, '0')}`;
                } else {
                  unitId = `11110${(500 + (i % 50)).toString().padStart(3, '0')}`;
                }
              }

              // 날짜 처리 - 첫 번째 컬럼이 년도일 수 있음
              let dateStr = getValue(['date', '날짜', '처리일자', '일자']);
              let yearCol = null;
              if (!dateStr) {
                // 첫 번째 컬럼이 년도인지 확인
                const firstKey = Object.keys(row)[0];
                if (firstKey && /^\d{4}$/.test(firstKey)) {
                  yearCol = firstKey;
                  dateStr = `${firstKey}-01-01`;
                } else {
                  // 모든 키에서 년도 찾기
                  yearCol = Object.keys(row).find(k => /^\d{4}$/.test(k));
                  if (yearCol) {
                    dateStr = `${yearCol}-01-01`;
                  } else {
                    dateStr = new Date().toISOString().split('T')[0];
                  }
                }
              } else {
                // date가 있으면 년도 컬럼 찾기
                yearCol = Object.keys(row).find(k => /^\d{4}$/.test(k));
              }

              // signal_type별로 분리하여 저장
              const signals = [];

              // 1. total (총 민원) - "계" 컬럼 찾기
              const totalValue = getValue(['계', '총건수', '민원건수', 'complaint_total', 'total']);
              if (totalValue && totalValue !== '소계' && totalValue !== '합계') {
                const numValue = typeof totalValue === 'string' ? totalValue.replace(/,/g, '').trim() : String(totalValue);
                const total = parseInt(numValue) || 0;
                if (total > 0 && !isNaN(total)) {
                  signals.push({
                    unit_id: unitId,
                    date: dateStr,
                    signal_type: 'total',
                    value: total,
                    meta: {
                      source: 'csv_import',
                      category: 'complaint',
                      raw: row
                    }
                  });
                }
              }
              
              // "계"가 없으면 년도 컬럼의 값을 사용 (첫 번째 숫자 컬럼)
              if (signals.length === 0 && yearCol) {
                const yearValue = row[yearCol];
                if (yearValue) {
                  const total = typeof yearValue === 'string' 
                    ? parseInt(yearValue.replace(/,/g, '')) || 0
                    : parseInt(yearValue) || 0;
                  if (total > 0 && !isNaN(total)) {
                    signals.push({
                      unit_id: unitId,
                      date: dateStr,
                      signal_type: 'total',
                      value: total,
                      meta: {
                        source: 'csv_import',
                        category: 'complaint',
                        raw: row
                      }
                    });
                  }
                }
              }
              
              // 여전히 없으면 첫 번째 큰 숫자 컬럼 사용 (년도 컬럼 제외)
              if (signals.length === 0) {
                const numericKeys = Object.keys(row).filter(k => {
                  // 년도 컬럼 제외
                  if (/^\d{4}$/.test(k)) return false;
                  const val = row[k];
                  if (typeof val === 'string') {
                    const cleaned = val.replace(/,/g, '').trim();
                    return /^\d+$/.test(cleaned) && parseInt(cleaned) > 100;
                  }
                  return typeof val === 'number' && val > 100;
                });
                if (numericKeys.length > 0) {
                  // 첫 번째 숫자 컬럼 사용
                  const firstNumeric = row[numericKeys[0]];
                  const total = typeof firstNumeric === 'string' 
                    ? parseInt(firstNumeric.replace(/,/g, '')) || 0
                    : parseInt(firstNumeric) || 0;
                  if (total > 0 && !isNaN(total)) {
                    signals.push({
                      unit_id: unitId,
                      date: dateStr,
                      signal_type: 'total',
                      value: total,
                      meta: {
                        source: 'csv_import',
                        category: 'complaint',
                        raw: row
                      }
                    });
                  }
                }
              }

              // 2. odor (악취 민원)
              const odorValue = getValue(['악취민원', 'complaint_odor', 'odor']);
              if (odorValue) {
                const numValue = typeof odorValue === 'string' ? odorValue.replace(/,/g, '').trim() : String(odorValue);
                const odor = parseInt(numValue) || 0;
                if (odor > 0) {
                  signals.push({
                    unit_id: unitId,
                    date: dateStr,
                    signal_type: 'odor',
                    value: odor,
                    meta: {
                      source: 'csv_import',
                      category: 'complaint',
                      raw: row
                    }
                  });
                }
              }

              // 3. trash (쓰레기 민원)
              const trashValue = getValue(['쓰레기민원', 'complaint_trash', 'trash', '고충민원']);
              if (trashValue) {
                const numValue = typeof trashValue === 'string' ? trashValue.replace(/,/g, '').trim() : String(trashValue);
                const trash = parseInt(numValue) || 0;
                if (trash > 0) {
                  signals.push({
                    unit_id: unitId,
                    date: dateStr,
                    signal_type: 'trash',
                    value: trash,
                    meta: {
                      source: 'csv_import',
                      category: 'complaint',
                      raw: row
                    }
                  });
                }
              }

              // 4. illegal_dumping (무단투기)
              const illegalValue = getValue(['무단투기', 'complaint_illegal_dump', 'illegal_dumping', 'illegal_dump']);
              if (illegalValue) {
                const numValue = typeof illegalValue === 'string' ? illegalValue.replace(/,/g, '').trim() : String(illegalValue);
                const illegal = parseInt(numValue) || 0;
                if (illegal > 0) {
                  signals.push({
                    unit_id: unitId,
                    date: dateStr,
                    signal_type: 'illegal_dumping',
                    value: illegal,
                    meta: {
                      source: 'csv_import',
                      category: 'complaint',
                      raw: row
                    }
                  });
                }
              }

              // 5. night_ratio (야간 비율)
              const nightRatio = getValue(['야간비율', 'night_ratio']);
              if (nightRatio !== null && nightRatio !== undefined && nightRatio !== '') {
                const ratio = parseFloat(nightRatio);
                if (!isNaN(ratio) && ratio >= 0 && ratio <= 1) {
                  signals.push({
                    unit_id: unitId,
                    date: dateStr,
                    signal_type: 'night_ratio',
                    value: ratio,
                    meta: {
                      source: 'csv_import',
                      category: 'ratio',
                      raw: row
                    }
                  });
                }
              }

              // 6. repeat_ratio (재발 비율)
              const repeatRatio = getValue(['재발비율', 'repeat_ratio']);
              if (repeatRatio !== null && repeatRatio !== undefined && repeatRatio !== '') {
                const ratio = parseFloat(repeatRatio);
                if (!isNaN(ratio) && ratio >= 0 && ratio <= 1) {
                  signals.push({
                    unit_id: unitId,
                    date: dateStr,
                    signal_type: 'repeat_ratio',
                    value: ratio,
                    meta: {
                      source: 'csv_import',
                      category: 'ratio',
                      raw: row
                    }
                  });
                }
              }

              // 각 signal을 bulkWrite operation으로 추가
              signals.forEach(signal => {
                operations.push({
                  updateOne: {
                    filter: {
                      unit_id: signal.unit_id,
                      date: signal.date,
                      signal_type: signal.signal_type
                    },
                    update: {
                      $set: signal
                    },
                    upsert: true
                  }
                });
              });
            });

            if (operations.length > 0) {
              try {
                const result = await SignalHuman.bulkWrite(operations, { ordered: false });
                successCount += result.upsertedCount + result.modifiedCount;
                if (i === 0) {
                  console.log(`  First batch: ${operations.length} operations`);
                  console.log(`    - Upserted: ${result.upsertedCount}`);
                  console.log(`    - Modified: ${result.modifiedCount}`);
                  console.log(`    - Sample signal:`, JSON.stringify(operations[0].updateOne.update.$set, null, 2));
                }
              } catch (bulkError) {
                console.error(`  BulkWrite error:`, bulkError.message);
                if (bulkError.writeErrors) {
                  console.error(`  Write errors:`, bulkError.writeErrors.slice(0, 3));
                }
                throw bulkError;
              }
            } else if (i === 0) {
              console.log(`  ⚠️  First batch: No operations generated`);
              console.log(`    Sample row keys:`, Object.keys(batch[0] || {}));
            }
            
            if ((i + batchSize) % 1000 === 0) {
              console.log(`  Processed ${i + batchSize} rows, ${successCount} signals created...`);
            }
          } catch (error) {
            errorCount += batch.length;
            console.error(`  Error processing batch ${i}-${i + batchSize}:`, error.message);
          }
        }
        
        console.log(`  ✅ Completed: ${successCount} signals created, ${errorCount} errors out of ${rowCount} rows`);
        resolve({ rowCount, successCount, errorCount });
      })
      .on('error', reject);
  });
}

async function main() {
  try {
    console.log('🚀 Starting ETL pipeline for human signals...\n');
    
    await connectDB();
    
    const rawDir = path.join(__dirname, '..', 'data', 'raw');
    const files = fs.readdirSync(rawDir).filter(f => f.endsWith('.csv'));
    
    console.log(`📁 Found ${files.length} CSV files in data/raw:\n`);
    files.forEach((f, i) => console.log(`  ${i + 1}. ${f}`));
    
    // 모든 CSV 파일 처리 (민원 관련 파일 우선)
    let processedCount = 0;
    for (const filename of files) {
      // 모든 CSV 파일 처리 (필터링 제거)
      const filePath = path.join(rawDir, filename);
      console.log(`\n📄 Processing: ${filename}`);
      try {
        const result = await etlHumanSignals(filePath);
        processedCount++;
        console.log(`  ✅ Result: ${result.successCount} signals from ${result.rowCount} rows\n`);
      } catch (error) {
        console.error(`  ❌ Error processing ${filename}:`, error.message);
      }
    }
    
    if (processedCount === 0) {
      console.log('⚠️  No files processed.');
    } else {
      console.log(`\n✅ Total: ${processedCount} files processed`);
    }
    
    console.log('\n✅ ETL pipeline completed successfully!');
    await mongoose.connection.close();
    process.exit(0);
  } catch (error) {
    console.error('❌ Error:', error);
    await mongoose.connection.close();
    process.exit(1);
  }
}

main();

