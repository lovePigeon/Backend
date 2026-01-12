import mongoose from 'mongoose';
import dotenv from 'dotenv';
import { format, parseISO, subDays } from 'date-fns';
import SignalHuman from '../models/SignalHuman.js';
import ComfortIndex from '../models/ComfortIndex.js';
import SpatialUnit from '../models/SpatialUnit.js';
import { computeUCIForUnit } from '../services/uciCompute.js';
import { connectDB } from '../config/database.js';

dotenv.config();

/**
 * 여러 날짜에 대해 UCI 계산
 * Human Signal 데이터가 있는 날짜들을 자동으로 찾아서 계산
 */
async function computeUCIForMultipleDates(days = 365) {
  console.log(`\n🚀 Computing UCI for multiple dates (last ${days} days)...\n`);
  
  await connectDB();
  
  // Human Signal 데이터가 있는 날짜들 확인
  const endDate = new Date();
  const startDate = subDays(endDate, days);
  const startDateStr = format(startDate, 'yyyy-MM-dd');
  const endDateStr = format(endDate, 'yyyy-MM-dd');
  
  // 먼저 전체 날짜 범위 확인
  const allAvailableDates = await SignalHuman.distinct('date', {
    signal_type: 'total'
  }).sort();
  
  if (allAvailableDates.length === 0) {
    console.log('⚠️  No Human Signal data found in database');
    await mongoose.connection.close();
    process.exit(0);
  }
  
  console.log(`📊 Total dates with Human Signal data: ${allAvailableDates.length}`);
  console.log(`   First date: ${allAvailableDates[0]}`);
  console.log(`   Last date: ${allAvailableDates[allAvailableDates.length - 1]}\n`);
  
  // 요청한 기간 내의 날짜만 필터링
  const availableDates = allAvailableDates.filter(date => {
    return date >= startDateStr && date <= endDateStr;
  });
  
  if (availableDates.length === 0) {
    console.log(`⚠️  No data found in the specified period (${startDateStr} ~ ${endDateStr})`);
    console.log(`💡 Try with a longer period: npm run compute-uci-multiple 365`);
    console.log(`   Or use all available dates: node scripts/compute_uci_multiple_dates.js 9999\n`);
    await mongoose.connection.close();
    process.exit(0);
  }
  
  console.log(`📅 Found ${availableDates.length} dates with Human Signal data in the specified period`);
  console.log(`   Range: ${availableDates[0]} ~ ${availableDates[availableDates.length - 1]}\n`);
  
  // spatial_unit 조회
  const spatialUnits = await SpatialUnit.find({});
  const districtUnits = await SignalHuman.distinct('unit_id', {
    'meta.source': 'seoul_district_complaints'
  });
  
  const allUnitIds = new Set();
  spatialUnits.forEach(unit => allUnitIds.add(unit._id));
  districtUnits.forEach(unitId => allUnitIds.add(unitId));
  
  const totalUnits = Array.from(allUnitIds);
  console.log(`📊 Total units to process: ${totalUnits.length}\n`);
  
  let totalSuccess = 0;
  let totalErrors = 0;
  
  // 각 날짜에 대해 UCI 계산
  for (let i = 0; i < availableDates.length; i++) {
    const dateStr = availableDates[i];
    console.log(`\n📅 Processing date ${i + 1}/${availableDates.length}: ${dateStr}`);
    
    let dateSuccess = 0;
    let dateErrors = 0;
    
    for (const unitId of totalUnits) {
      try {
        const result = await computeUCIForUnit(unitId, dateStr, 4, false);
        
        if (result) {
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
          
          dateSuccess++;
          totalSuccess++;
        } else {
          dateErrors++;
          totalErrors++;
        }
      } catch (error) {
        dateErrors++;
        totalErrors++;
        // 에러는 조용히 처리 (너무 많을 수 있음)
      }
    }
    
    console.log(`   ✅ ${dateSuccess} success, ❌ ${dateErrors} errors`);
  }
  
  console.log(`\n✅ Completed: ${totalSuccess} total success, ${totalErrors} total errors`);
  console.log(`📊 Processed ${availableDates.length} dates for ${totalUnits.length} units`);
  
  await mongoose.connection.close();
  process.exit(0);
}

// 명령줄 인자 처리
const daysArg = parseInt(process.argv[2]) || 365; // 기본값을 365일로 변경

computeUCIForMultipleDates(daysArg).catch(error => {
  console.error('❌ Error:', error);
  process.exit(1);
});

