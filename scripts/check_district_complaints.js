import mongoose from 'mongoose';
import dotenv from 'dotenv';
import SignalHuman from '../models/SignalHuman.js';
import { connectDB } from '../config/database.js';

dotenv.config();

async function main() {
  await connectDB();

  console.log('\n✅ 구 단위 불편신고 데이터 최종 확인:\n');

  const count = await SignalHuman.countDocuments({
    'meta.source': 'seoul_district_complaints'
  });
  
  const districts = await SignalHuman.distinct('unit_id', {
    'meta.source': 'seoul_district_complaints'
  });
  
  const dates = await SignalHuman.distinct('date', {
    'meta.source': 'seoul_district_complaints'
  }).then(d => d.sort());
  
  const sample = await SignalHuman.findOne({
    'meta.source': 'seoul_district_complaints'
  }).lean();

  console.log(`  총 문서 수: ${count.toLocaleString()}개`);
  console.log(`  지역 수: ${districts.length}개 구`);
  console.log(`  날짜 범위: ${dates[0]} ~ ${dates[dates.length - 1]}`);
  console.log(`  고유 날짜 수: ${dates.length}일\n`);

  if (sample) {
    console.log('  샘플 데이터:');
    console.log(`    unit_id: ${sample.unit_id}`);
    console.log(`    date: ${sample.date}`);
    console.log(`    signal_type: ${sample.signal_type}`);
    console.log(`    value: ${sample.value}`);
    console.log(`    구 이름: ${sample.meta?.district_name || '없음'}\n`);
  }

  // 구별 통계
  const districtCounts = {};
  for (const districtId of districts) {
    const districtCount = await SignalHuman.countDocuments({
      unit_id: districtId,
      'meta.source': 'seoul_district_complaints'
    });
    const sampleDoc = await SignalHuman.findOne({
      unit_id: districtId,
      'meta.source': 'seoul_district_complaints'
    }).lean();
    districtCounts[sampleDoc?.meta?.district_name || districtId] = districtCount;
  }

  console.log('  구별 데이터 수:\n');
  Object.keys(districtCounts).sort().forEach(district => {
    console.log(`    ${district}: ${districtCounts[district]}개`);
  });

  await mongoose.connection.close();
  process.exit(0);
}

main().catch(error => {
  console.error('❌ 오류:', error);
  process.exit(1);
});

