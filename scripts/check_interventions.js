import mongoose from 'mongoose';
import dotenv from 'dotenv';
import Intervention from '../models/Intervention.js';
import { connectDB } from '../config/database.js';

dotenv.config();

async function main() {
  try {
    await connectDB();
    
    const count = await Intervention.countDocuments();
    console.log(`\n📊 interventions: ${count}개\n`);
    
    if (count === 0) {
      console.log('✅ 정상: interventions는 관리자가 직접 입력하는 조치 기록입니다.');
      console.log('   초기에는 비어있는 것이 정상입니다.\n');
      console.log('📝 사용 방법:');
      console.log('   1. POST /api/v1/interventions로 조치 등록');
      console.log('      예시:');
      console.log('      {');
      console.log('        "unit_id": "11110500",');
      console.log('        "intervention_type": "night_cleanup",');
      console.log('        "start_date": "2023-01-15",');
      console.log('        "created_by": "admin",');
      console.log('        "note": "야간 집중 청소 실시"');
      console.log('      }\n');
      console.log('   2. GET /api/v1/dashboard/interventions로 조회');
      console.log('   3. GET /api/v1/dashboard/interventions/{id}/effect로 효과 분석\n');
    } else {
      const sample = await Intervention.findOne();
      console.log('샘플 데이터:');
      console.log(JSON.stringify(sample, null, 2));
    }
    
    await mongoose.connection.close();
    process.exit(0);
  } catch (error) {
    console.error('❌ Error:', error);
    await mongoose.connection.close();
    process.exit(1);
  }
}

main();

