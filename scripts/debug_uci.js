import mongoose from 'mongoose';
import dotenv from 'dotenv';
import SignalHuman from '../models/SignalHuman.js';
import SpatialUnit from '../models/SpatialUnit.js';
import { computeUCIForUnit } from '../services/uciCompute.js';
import { connectDB } from '../config/database.js';

dotenv.config();

async function debug() {
  await connectDB();
  
  // 데이터 확인
  const humanCount = await SignalHuman.countDocuments({ signal_type: 'total' });
  const unitCount = await SpatialUnit.countDocuments();
  
  console.log(`\n📊 데이터 현황:`);
  console.log(`  signals_human (total): ${humanCount}개`);
  console.log(`  spatial_units: ${unitCount}개\n`);
  
  if (humanCount === 0) {
    console.log('❌ signals_human 데이터가 없습니다.');
    await mongoose.connection.close();
    process.exit(1);
  }
  
  // 샘플 unit_id로 테스트
  const sampleUnit = await SpatialUnit.findOne();
  if (!sampleUnit) {
    console.log('❌ spatial_units가 없습니다.');
    await mongoose.connection.close();
    process.exit(1);
  }
  
  console.log(`\n🔍 테스트 unit_id: ${sampleUnit._id}\n`);
  
  // 해당 unit의 데이터 확인
  const unitData = await SignalHuman.find({ unit_id: sampleUnit._id });
  console.log(`  해당 unit의 signals_human: ${unitData.length}개`);
  
  if (unitData.length > 0) {
    console.log(`  샘플 데이터:`);
    console.log(JSON.stringify(unitData[0], null, 2));
    
    // 날짜 범위 확인
    const dates = unitData.map(d => d.date).sort();
    console.log(`\n  날짜 범위: ${dates[0]} ~ ${dates[dates.length - 1]}`);
    
    // 최신 날짜로 UCI 계산 시도
    const latestDate = dates[dates.length - 1];
    console.log(`\n🧮 최신 날짜(${latestDate})로 UCI 계산 시도...\n`);
    
    try {
      const result = await computeUCIForUnit(sampleUnit._id, latestDate, 4, false);
      if (result) {
        console.log('✅ UCI 계산 성공:');
        console.log(JSON.stringify(result, null, 2));
      } else {
        console.log('❌ UCI 계산 결과: null');
        console.log('   원인: 모든 신호 점수가 null이거나 데이터 부족');
      }
    } catch (error) {
      console.error('❌ UCI 계산 오류:', error.message);
      console.error(error.stack);
    }
  } else {
    console.log(`❌ unit_id ${sampleUnit._id}에 대한 데이터가 없습니다.`);
  }
  
  await mongoose.connection.close();
  process.exit(0);
}

debug().catch(error => {
  console.error('❌ Error:', error);
  process.exit(1);
});

