import mongoose from 'mongoose';
import dotenv from 'dotenv';
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';
import csv from 'csv-parser';
import SignalHuman from '../models/SignalHuman.js';
import SignalGeo from '../models/SignalGeo.js';
import SignalPopulation from '../models/SignalPopulation.js';
import SpatialUnit from '../models/SpatialUnit.js';
import { connectDB } from '../config/database.js';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

dotenv.config();

// CSV 파일을 파싱하여 MongoDB에 저장하는 함수들 (배치 처리)
async function importHumanSignal(filePath) {
  console.log(`\n📥 Importing human signals from: ${path.basename(filePath)}`);
  
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
            const operations = batch.map(row => {
              // CSV 컬럼명에 따라 매핑
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

              // 날짜 처리
              let dateStr = getValue(['date', '날짜', '처리일자', '일자']);
              if (!dateStr) {
                const yearCol = Object.keys(row).find(k => /^\d{4}$/.test(k));
                if (yearCol) {
                  dateStr = `${yearCol}-01-01`;
                } else {
                  dateStr = new Date().toISOString().split('T')[0];
                }
              }

              // 민원 건수 추출 - "계" 컬럼이 총 민원 건수
              let total = 0;
              const totalValue = getValue(['계', '총건수', '민원건수', 'complaint_total', 'total']);
              if (totalValue) {
                const numValue = typeof totalValue === 'string' ? totalValue.replace(/,/g, '').trim() : String(totalValue);
                total = parseInt(numValue) || 0;
              }
              
              // "계"가 없거나 0이면 다른 숫자 컬럼 찾기 (첫 번째 큰 숫자)
              if (total === 0) {
                const numericKeys = Object.keys(row).filter(k => {
                  const val = row[k];
                  if (typeof val === 'string') {
                    const cleaned = val.replace(/,/g, '').trim();
                    return /^\d+$/.test(cleaned) && parseInt(cleaned) > 100; // 100 이상인 숫자만
                  }
                  return typeof val === 'number' && val > 100;
                });
                if (numericKeys.length > 0) {
                  const firstNumeric = row[numericKeys[0]];
                  total = typeof firstNumeric === 'string' 
                    ? parseInt(firstNumeric.replace(/,/g, '')) || 0
                    : parseInt(firstNumeric) || 0;
                }
              }
              
              return {
                updateOne: {
                  filter: { unit_id: unitId, date: dateStr },
                  update: {
                    $set: {
                      unit_id: unitId,
                      date: dateStr,
                      complaint_total: total,
                      complaint_odor: getValue(['악취민원', 'complaint_odor']) ? parseInt(getValue(['악취민원', 'complaint_odor'])) : null,
                      complaint_trash: getValue(['쓰레기민원', 'complaint_trash']) ? parseInt(getValue(['쓰레기민원', 'complaint_trash'])) : null,
                      complaint_illegal_dump: getValue(['무단투기', 'complaint_illegal_dump']) ? parseInt(getValue(['무단투기', 'complaint_illegal_dump'])) : null,
                      night_ratio: getValue(['야간비율', 'night_ratio']) ? parseFloat(getValue(['야간비율', 'night_ratio'])) : null,
                      repeat_ratio: getValue(['재발비율', 'repeat_ratio']) ? parseFloat(getValue(['재발비율', 'repeat_ratio'])) : null,
                      source: 'csv_import',
                      raw: row
                    }
                  },
                  upsert: true
                }
              };
            });

            await SignalHuman.bulkWrite(operations);
            successCount += batch.length;
            
            if ((i + batchSize) % 1000 === 0) {
              console.log(`  Processed ${i + batchSize} rows...`);
            }
          } catch (error) {
            errorCount += batch.length;
            console.error(`  Error processing batch ${i}-${i + batchSize}:`, error.message);
          }
        }
        
        console.log(`  ✅ Completed: ${successCount} success, ${errorCount} errors out of ${rowCount} rows`);
        resolve({ rowCount, successCount, errorCount });
      })
      .on('error', reject);
  });
}

async function importGeoSignal(filePath) {
  console.log(`\n📥 Importing geo signals from: ${path.basename(filePath)}`);
  
  const rows = [];
  let rowCount = 0;

  return new Promise((resolve, reject) => {
    fs.createReadStream(filePath)
      .pipe(csv())
      .on('data', (row) => {
        rows.push(row);
        rowCount++;
      })
      .on('end', async () => {
        console.log(`  Total rows: ${rowCount}`);
        
        let successCount = 0;
        let errorCount = 0;
        const batchSize = 100;
        
        for (let i = 0; i < rows.length; i += batchSize) {
          const batch = rows.slice(i, i + batchSize);
          
          try {
            const operations = batch.map(row => {
              const getValue = (keys, defaultValue = null) => {
                for (const key of keys) {
                  if (row[key] !== undefined && row[key] !== '' && row[key] !== null) {
                    return row[key];
                  }
                }
                return defaultValue;
              };

              const unitId = getValue(['unit_id', '_id', '동코드', '지역코드']) || `11110${(500 + (i % 50)).toString().padStart(3, '0')}`;
              
              return {
                updateOne: {
                  filter: { _id: unitId },
                  update: {
                    $set: {
                      _id: unitId,
                      alley_density: getValue(['alley_density', '골목밀도']) ? parseFloat(getValue(['alley_density', '골목밀도'])) : null,
                      backroad_ratio: getValue(['backroad_ratio', '후면도로비율']) ? parseFloat(getValue(['backroad_ratio', '후면도로비율'])) : null,
                      ventilation_proxy: getValue(['ventilation_proxy', '환기지수']) ? parseFloat(getValue(['ventilation_proxy', '환기지수'])) : null,
                      accessibility_proxy: getValue(['accessibility_proxy', '접근성지수']) ? parseFloat(getValue(['accessibility_proxy', '접근성지수'])) : null,
                      landuse_mix: getValue(['landuse_mix', '용도혼합도']) ? parseFloat(getValue(['landuse_mix', '용도혼합도'])) : null,
                      source: 'csv_import',
                      raw: row
                    }
                  },
                  upsert: true
                }
              };
            });

            await SignalGeo.bulkWrite(operations);
            successCount += batch.length;
          } catch (error) {
            errorCount += batch.length;
            console.error(`  Error processing batch:`, error.message);
          }
        }
        
        console.log(`  ✅ Completed: ${successCount} success, ${errorCount} errors out of ${rowCount} rows`);
        resolve({ rowCount, successCount, errorCount });
      })
      .on('error', reject);
  });
}

async function importPopulationSignal(filePath) {
  console.log(`\n📥 Importing population signals from: ${path.basename(filePath)}`);
  
  const rows = [];
  let rowCount = 0;

  return new Promise((resolve, reject) => {
    fs.createReadStream(filePath)
      .pipe(csv())
      .on('data', (row) => {
        rows.push(row);
        rowCount++;
      })
      .on('end', async () => {
        console.log(`  Total rows: ${rowCount}`);
        
        let successCount = 0;
        let errorCount = 0;
        const batchSize = 100;
        
        for (let i = 0; i < rows.length; i += batchSize) {
          const batch = rows.slice(i, i + batchSize);
          
          try {
            const operations = batch.map(row => {
              const getValue = (keys, defaultValue = null) => {
                for (const key of keys) {
                  if (row[key] !== undefined && row[key] !== '' && row[key] !== null) {
                    return row[key];
                  }
                }
                return defaultValue;
              };

              const unitId = getValue(['unit_id', '동코드', '지역코드']) || `11110${(500 + (i % 50)).toString().padStart(3, '0')}`;
              const dateStr = getValue(['date', '날짜', '일자']) || new Date().toISOString().split('T')[0];
              
              return {
                updateOne: {
                  filter: { unit_id: unitId, date: dateStr },
                  update: {
                    $set: {
                      unit_id: unitId,
                      date: dateStr,
                      pop_total: getValue(['pop_total', '총생활인구']) ? parseInt(getValue(['pop_total', '총생활인구'])) : null,
                      pop_night: getValue(['pop_night', '야간생활인구']) ? parseInt(getValue(['pop_night', '야간생활인구'])) : null,
                      pop_change_rate: getValue(['pop_change_rate', '변화율']) ? parseFloat(getValue(['pop_change_rate', '변화율'])) : null,
                      source: 'csv_import',
                      raw: row
                    }
                  },
                  upsert: true
                }
              };
            });

            await SignalPopulation.bulkWrite(operations);
            successCount += batch.length;
          } catch (error) {
            errorCount += batch.length;
            console.error(`  Error processing batch:`, error.message);
          }
        }
        
        console.log(`  ✅ Completed: ${successCount} success, ${errorCount} errors out of ${rowCount} rows`);
        resolve({ rowCount, successCount, errorCount });
      })
      .on('error', reject);
  });
}

async function main() {
  try {
    console.log('🚀 Starting data import from data/raw folder...\n');
    
    // MongoDB 연결
    await connectDB();
    
    const rawDir = path.join(__dirname, '..', 'data', 'raw');
    const files = fs.readdirSync(rawDir).filter(f => f.endsWith('.csv'));
    
    console.log(`📁 Found ${files.length} CSV files in data/raw:\n`);
    files.forEach((f, i) => console.log(`  ${i + 1}. ${f}`));
    
    // 파일명으로 타입 추론
    for (const filename of files) {
      const filePath = path.join(rawDir, filename);
      
      // 파일명에 따라 타입 결정
      if (filename.includes('민원') || filename.includes('complaint')) {
        await importHumanSignal(filePath);
      } else if (filename.includes('쓰레기') || filename.includes('geo') || filename.includes('지역')) {
        await importGeoSignal(filePath);
      } else if (filename.includes('인구') || filename.includes('population')) {
        await importPopulationSignal(filePath);
      } else {
        // 기본적으로 human signal로 시도
        console.log(`\n⚠️  Unknown file type, trying as human signal: ${filename}`);
        await importHumanSignal(filePath);
      }
    }
    
    console.log('\n✅ All files imported successfully!');
    await mongoose.connection.close();
    process.exit(0);
  } catch (error) {
    console.error('❌ Error:', error);
    await mongoose.connection.close();
    process.exit(1);
  }
}

main();
