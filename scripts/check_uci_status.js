import mongoose from 'mongoose';
import dotenv from 'dotenv';
import ComfortIndex from '../models/ComfortIndex.js';
import SignalHuman from '../models/SignalHuman.js';
import { connectDB } from '../config/database.js';

dotenv.config();

const DONG_CODE_MAP = {
  '11110': '종로구', '11140': '중구', '11170': '용산구', '11200': '성동구',
  '11215': '광진구', '11230': '동대문구', '11260': '중랑구', '11290': '성북구',
  '11305': '강북구', '11320': '도봉구', '11350': '노원구', '11380': '은평구',
  '11410': '서대문구', '11440': '마포구', '11470': '양천구', '11500': '강서구',
  '11530': '구로구', '11545': '금천구', '11560': '영등포구', '11590': '동작구',
  '11620': '관악구', '11650': '서초구', '11680': '강남구', '11710': '송파구',
  '11740': '강동구'
};

function getDistrict(unitId) {
  if (!unitId) return '알 수 없음';
  const prefix = unitId.substring(0, 5);
  return DONG_CODE_MAP[prefix] || prefix;
}

async function main() {
  await connectDB();

  console.log('\n📊 현재 UCI 계산 상태:\n');

  // UCI 계산된 지역
  const uciUnits = await ComfortIndex.distinct('unit_id');
  console.log(`  UCI 계산된 지역 수: ${uciUnits.length}개\n`);

  const uciByDistrict = {};
  uciUnits.forEach(id => {
    const district = getDistrict(id);
    uciByDistrict[district] = (uciByDistrict[district] || 0) + 1;
  });

  console.log('  구별 UCI 계산 지역:');
  Object.keys(uciByDistrict).sort().forEach(d => {
    console.log(`    ${d}: ${uciByDistrict[d]}개`);
  });

  // 구 단위 데이터 현황
  const districtUnits = await SignalHuman.distinct('unit_id', {
    'meta.source': 'seoul_district_complaints'
  });

  console.log(`\n  구 단위 신호 데이터: ${districtUnits.length}개 구\n`);

  const missingDistricts = [];
  for (const unitId of districtUnits) {
    const district = getDistrict(unitId);
    if (!uciByDistrict[district] || uciByDistrict[district] === 0) {
      missingDistricts.push({ unitId, district });
    }
  }

  if (missingDistricts.length > 0) {
    console.log(`  ⚠️  UCI 미계산 구 (${missingDistricts.length}개):\n`);
    missingDistricts.forEach(({ unitId, district }) => {
      console.log(`    ${district} (${unitId})`);
    });
    console.log('\n  → 구 단위 데이터로도 UCI 계산이 필요합니다.\n');
  } else {
    console.log('  ✅ 모든 구의 UCI가 계산되었습니다.\n');
  }

  await mongoose.connection.close();
  process.exit(0);
}

main().catch(error => {
  console.error('❌ 오류:', error);
  process.exit(1);
});

