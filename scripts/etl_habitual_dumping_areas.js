import mongoose from 'mongoose';
import dotenv from 'dotenv';
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';
import XLSX from 'xlsx';
import SignalGeo from '../models/SignalGeo.js';
import SpatialUnit from '../models/SpatialUnit.js';
import { connectDB } from '../config/database.js';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

dotenv.config();

/**
 * 서울특별시 강남구_쓰레기상습무단투기지역현황.xlsx 처리
 * 
 * 역할: 공간 후보군 데이터 (어디를 먼저 볼 것인가)
 * - signals_geo에 habitual_dumping_risk 업데이트
 */
async function etlHabitualDumpingAreas(filePath) {
  console.log(`\n📥 ETL Processing: ${path.basename(filePath)}\n`);
  
  try {
    const workbook = XLSX.readFile(filePath);
    const sheetName = workbook.SheetNames[0];
    const worksheet = workbook.Sheets[sheetName];
    const rows = XLSX.utils.sheet_to_json(worksheet);
    
    console.log(`  Found ${rows.length} rows`);
    
    const operations = [];
    let processedCount = 0;
    
    for (const row of rows) {
      // XLSX 컬럼명 확인 필요 (실제 파일 구조에 맞게 수정)
      // 예상 컬럼: 주소, 좌표(위도/경도), 위험도 등
      const address = row['주소'] || row['위치'] || row['지역'] || '';
      const lat = parseFloat(row['위도'] || row['lat'] || row['latitude'] || 0);
      const lng = parseFloat(row['경도'] || row['lng'] || row['longitude'] || 0);
      const riskLevel = row['위험도'] || row['risk_level'] || 'medium';
      
      if (!address && (lat === 0 || lng === 0)) {
        continue; // 유효하지 않은 행 스킵
      }
      
      // 주소를 unit_id로 매핑 (간단한 매칭 로직)
      // 실제로는 주소 파싱 및 geocoding 필요
      const unitId = await findUnitIdByAddress(address, lat, lng);
      
      if (!unitId) {
        console.log(`  ⚠️  Cannot map to unit_id: ${address}`);
        continue;
      }
      
      // signals_geo 업데이트
      const location = {
        lat,
        lng,
        address,
        risk_level: riskLevel.toLowerCase() === 'high' ? 'high' : 
                   riskLevel.toLowerCase() === 'low' ? 'low' : 'medium'
      };
      
      operations.push({
        updateOne: {
          filter: { _id: unitId },
          update: {
            $set: {
              habitual_dumping_risk: riskLevel === 'high' ? 0.8 : 
                                    riskLevel === 'medium' ? 0.5 : 0.3,
              source: 'gangnam_habitual_dumping'
            },
            $inc: { habitual_dumping_count: 1 },
            $push: { habitual_dumping_locations: location }
          },
          upsert: true
        }
      });
      
      processedCount++;
    }
    
    if (operations.length > 0) {
      await SignalGeo.bulkWrite(operations, { ordered: false });
      console.log(`  ✅ Processed ${processedCount} areas, updated ${operations.length} signals_geo`);
    } else {
      console.log(`  ⚠️  No valid data found`);
    }
    
    return { processedCount, operationsCount: operations.length };
  } catch (error) {
    console.error(`  ❌ Error processing file:`, error.message);
    return { processedCount: 0, operationsCount: 0 };
  }
}

/**
 * 주소/좌표로 unit_id 찾기
 * 실제로는 geocoding API 또는 주소 매칭 로직 필요
 */
async function findUnitIdByAddress(address, lat, lng) {
  // 간단한 구현: 주소에서 행정동 추출
  // 실제로는 더 정교한 매칭 필요
  const dongMatch = address.match(/(\w+동)/);
  if (dongMatch) {
    const dongName = dongMatch[1];
    const unit = await SpatialUnit.findOne({ name: { $regex: dongName } });
    if (unit) return unit._id;
  }
  
  // 좌표 기반 매칭 (간단한 구현)
  if (lat !== 0 && lng !== 0) {
    // 실제로는 2dsphere 인덱스로 $geoWithin 사용
    // 여기서는 간단히 가장 가까운 unit 반환
    const units = await SpatialUnit.find({});
    // TODO: 실제 거리 계산 및 매칭
  }
  
  return null;
}

async function main() {
  try {
    console.log('🚀 Starting ETL pipeline for habitual dumping areas...\n');
    
    await connectDB();
    
    const rawDir = path.join(__dirname, '..', 'data', 'raw');
    const files = fs.readdirSync(rawDir).filter(f => 
      f.includes('상습') && f.includes('무단투기') && (f.endsWith('.xlsx') || f.endsWith('.xls'))
    );
    
    if (files.length === 0) {
      console.log('⚠️  No habitual dumping area files found.');
      console.log('   File name should include "상습" and "무단투기"\n');
      process.exit(0);
    }
    
    console.log(`📁 Found ${files.length} files:\n`);
    files.forEach((f, i) => console.log(`  ${i + 1}. ${f}`));
    
    for (const filename of files) {
      const filePath = path.join(rawDir, filename);
      await etlHabitualDumpingAreas(filePath);
    }
    
    console.log('\n✅ ETL pipeline completed successfully!');
    
    // 통계 출력
    const count = await SignalGeo.countDocuments({ habitual_dumping_risk: { $exists: true } });
    console.log(`\n📊 Signals with habitual dumping risk: ${count}개\n`);
    
    await mongoose.connection.close();
    process.exit(0);
  } catch (error) {
    console.error('❌ Error:', error);
    await mongoose.connection.close();
    process.exit(1);
  }
}

main();

