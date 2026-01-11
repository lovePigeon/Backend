import mongoose from 'mongoose';
import dotenv from 'dotenv';
import { format, parseISO, subDays } from 'date-fns';
import SignalHuman from '../models/SignalHuman.js';
import SignalGeo from '../models/SignalGeo.js';
import SignalPopulation from '../models/SignalPopulation.js';
import ComfortIndex from '../models/ComfortIndex.js';
import SpatialUnit from '../models/SpatialUnit.js';
import { computeUCIForUnit } from '../services/uciCompute.js';
import { connectDB } from '../config/database.js';

dotenv.config();

/**
 * 모든 spatial_unit에 대해 comfort_index 계산 및 저장
 */
async function computeAllComfortIndexes(date = null, windowWeeks = 4) {
  console.log('\n🚀 Computing comfort_index for all units...\n');
  
  await connectDB();
  
  // 날짜가 지정되지 않으면 데이터가 있는 최신 날짜 사용
  let targetDate = date ? parseISO(date) : null;
  let dateStr = date ? format(parseISO(date), 'yyyy-MM-dd') : null;
  
  if (!dateStr) {
    // signals_human에서 최신 날짜 찾기
    const latestSignal = await SignalHuman.findOne({ signal_type: 'total' })
      .sort({ date: -1 });
    
    if (latestSignal) {
      dateStr = latestSignal.date;
      targetDate = parseISO(dateStr);
      console.log(`📅 Using latest date from data: ${dateStr}\n`);
    } else {
      dateStr = format(new Date(), 'yyyy-MM-dd');
      targetDate = new Date();
      console.log(`⚠️  No data found, using current date: ${dateStr}\n`);
    }
  }
  
  // 1. spatial_unit 조회 (행정동 단위)
  const spatialUnits = await SpatialUnit.find({});
  console.log(`📊 Found ${spatialUnits.length} spatial units (행정동)\n`);
  
  // 2. 구 단위 unit_id 조회 (seoul_district_complaints 소스)
  const districtUnits = await SignalHuman.distinct('unit_id', {
    'meta.source': 'seoul_district_complaints'
  });
  console.log(`📊 Found ${districtUnits.length} district units (구 단위)\n`);
  
  // 모든 unit_id 합치기
  const allUnitIds = new Set();
  
  // spatial_unit의 _id 추가
  spatialUnits.forEach(unit => allUnitIds.add(unit._id));
  
  // 구 단위 unit_id 추가
  districtUnits.forEach(unitId => allUnitIds.add(unitId));
  
  const totalUnits = Array.from(allUnitIds);
  console.log(`📊 Total units to process: ${totalUnits.length}\n`);
  
  let successCount = 0;
  let errorCount = 0;
  
  for (const unitId of totalUnits) {
    try {
      const result = await computeUCIForUnit(unitId, dateStr, windowWeeks, false);
      
      if (result) {
        // comfort_index에 저장
        await ComfortIndex.findOneAndUpdate(
          { unit_id: result.unit_id, date: result.date },
          {
            unit_id: result.unit_id,
            date: result.date,
            uci_score: result.uci_score,
            uci_grade: result.uci_grade,
            components: result.components,
            explain: result.explain,
            created_at: new Date()
          },
          { upsert: true, new: true }
        );
        
        successCount++;
        if (successCount % 10 === 0) {
          console.log(`  Processed ${successCount}/${totalUnits.length} units...`);
        }
      } else {
        // 데이터가 없어서 계산 불가
        errorCount++;
      }
    } catch (error) {
      errorCount++;
      console.error(`  Error computing UCI for ${unitId}:`, error.message);
    }
  }
  
  console.log(`\n✅ Completed: ${successCount} success, ${errorCount} errors`);
  await mongoose.connection.close();
  process.exit(0);
}

// 명령줄 인자 처리
const dateArg = process.argv[2];
const windowWeeksArg = parseInt(process.argv[3]) || 4;

computeAllComfortIndexes(dateArg, windowWeeksArg).catch(error => {
  console.error('❌ Error:', error);
  process.exit(1);
});

