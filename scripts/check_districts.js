import mongoose from 'mongoose';
import dotenv from 'dotenv';
import SignalHuman from '../models/SignalHuman.js';
import SignalPopulation from '../models/SignalPopulation.js';
import SpatialUnit from '../models/SpatialUnit.js';
import { connectDB } from '../config/database.js';

dotenv.config();

// 서울시 행정동 코드 -> 자치구 매핑
const DONG_CODE_TO_DISTRICT = {
  '11110': '종로구',
  '11111': '종로구',
  '11140': '중구',
  '11141': '중구',
  '11170': '용산구',
  '11171': '용산구',
  '11200': '성동구',
  '11201': '성동구',
  '11215': '광진구',
  '11230': '동대문구',
  '11231': '동대문구',
  '11260': '중랑구',
  '11290': '성북구',
  '11291': '성북구',
  '11305': '강북구',
  '11320': '도봉구',
  '11350': '노원구',
  '11380': '은평구',
  '11410': '서대문구',
  '11411': '서대문구',
  '11440': '마포구',
  '11441': '마포구',
  '11470': '양천구',
  '11500': '강서구',
  '11501': '강서구',
  '11530': '구로구',
  '11545': '금천구',
  '11560': '영등포구',
  '11561': '영등포구',
  '11590': '동작구',
  '11620': '관악구',
  '11650': '서초구',
  '11651': '서초구',
  '11680': '강남구',
  '11681': '강남구',
  '11710': '송파구',
  '11711': '송파구',
  '11740': '강동구',
  '11741': '강동구'
};

function getDistrict(unitId) {
  if (!unitId) return '알 수 없음';
  const prefix = unitId.substring(0, 5);
  return DONG_CODE_TO_DISTRICT[prefix] || '알 수 없음';
}

async function main() {
  await connectDB();

  console.log('\n📊 데이터에 포함된 구(자치구) 현황:\n');

  // signals_human
  const humanUnits = await SignalHuman.distinct('unit_id');
  const humanDistrictCount = {};
  humanUnits.forEach(unitId => {
    const district = getDistrict(unitId);
    humanDistrictCount[district] = (humanDistrictCount[district] || 0) + 1;
  });

  console.log('🔹 signals_human:');
  console.log(`  총 지역 수: ${humanUnits.length}개`);
  Object.keys(humanDistrictCount).sort().forEach(district => {
    console.log(`  ${district}: ${humanDistrictCount[district]}개`);
  });
  console.log('');

  // signals_population
  const popUnits = await SignalPopulation.distinct('unit_id');
  const popDistrictCount = {};
  popUnits.forEach(unitId => {
    const district = getDistrict(unitId);
    popDistrictCount[district] = (popDistrictCount[district] || 0) + 1;
  });

  console.log('🔹 signals_population:');
  console.log(`  총 지역 수: ${popUnits.length}개`);
  Object.keys(popDistrictCount).sort().forEach(district => {
    console.log(`  ${district}: ${popDistrictCount[district]}개`);
  });
  console.log('');

  // spatial_units
  const spatialUnits = await SpatialUnit.distinct('_id');
  const spatialDistrictCount = {};
  spatialUnits.forEach(unitId => {
    const district = getDistrict(unitId);
    spatialDistrictCount[district] = (spatialDistrictCount[district] || 0) + 1;
  });

  console.log('🔹 spatial_units:');
  console.log(`  총 지역 수: ${spatialUnits.length}개`);
  Object.keys(spatialDistrictCount).sort().forEach(district => {
    console.log(`  ${district}: ${spatialDistrictCount[district]}개`);
  });
  console.log('');

  // 전체 통합
  const allUnits = [...new Set([...humanUnits, ...popUnits, ...spatialUnits])];
  const allDistrictCount = {};
  allUnits.forEach(unitId => {
    const district = getDistrict(unitId);
    allDistrictCount[district] = (allDistrictCount[district] || 0) + 1;
  });

  console.log('🔹 전체 통합:');
  console.log(`  총 지역 수: ${allUnits.length}개`);
  const sortedDistricts = Object.keys(allDistrictCount).sort();
  sortedDistricts.forEach(district => {
    console.log(`  ${district}: ${allDistrictCount[district]}개`);
  });

  const distinctDistricts = sortedDistricts.filter(d => d !== '알 수 없음');
  console.log(`\n  ✅ 총 ${distinctDistricts.length}개 구 확인\n`);

  // 종로구만 있는지 확인
  if (distinctDistricts.length === 1 && distinctDistricts[0] === '종로구') {
    console.log('⚠️  종로구만 데이터가 있습니다.\n');
  } else if (distinctDistricts.includes('종로구')) {
    console.log('✅ 종로구 외에도 다른 구의 데이터가 있습니다.\n');
  }

  await mongoose.connection.close();
  process.exit(0);
}

main().catch(error => {
  console.error('❌ 오류:', error);
  process.exit(1);
});

