import mongoose from 'mongoose';
import dotenv from 'dotenv';
import { format, parseISO } from 'date-fns';
import SignalHuman from '../models/SignalHuman.js';
import SignalGeo from '../models/SignalGeo.js';
import SignalPopulation from '../models/SignalPopulation.js';
import SpatialUnit from '../models/SpatialUnit.js';
import { connectDB } from '../config/database.js';

dotenv.config();

/**
 * Blind Spots 생성: 민원 낮은데 geo/pop/pigeon이 튀는 곳(사각지대)
 */
async function generateBlindSpots(date = null, riskLevel = 'high') {
  console.log('\n🚀 Generating blind spots...\n');
  
  await connectDB();
  
  const targetDate = date ? parseISO(date) : new Date();
  const dateStr = format(targetDate, 'yyyy-MM-dd');
  
  // 모든 spatial_unit 조회
  const units = await SpatialUnit.find({});
  console.log(`📊 Analyzing ${units.length} spatial units\n`);
  
  const blindSpots = [];
  
  for (const unit of units) {
    try {
      // 최근 민원 데이터 조회
      const recentHumanSignals = await SignalHuman.find({
        unit_id: unit._id,
        date: { $lte: dateStr },
        signal_type: 'total'
      })
      .sort({ date: -1 })
      .limit(30)
      .lean();
      
      const totalComplaints = recentHumanSignals.reduce((sum, s) => sum + (s.value || 0), 0);
      const avgComplaints = recentHumanSignals.length > 0 ? totalComplaints / recentHumanSignals.length : 0;
      
      // Geo 신호 조회
      const geoData = await SignalGeo.findById(unit._id).lean();
      
      // Population 신호 조회
      const popData = await SignalPopulation.find({
        unit_id: unit._id,
        date: { $lte: dateStr }
      })
      .sort({ date: -1 })
      .limit(30)
      .lean();
      
      // 사각지대 판단 로직
      const isBlindSpot = detectBlindSpot(avgComplaints, geoData, popData);
      
      if (isBlindSpot.detected) {
        const riskLevel = calculateRiskLevel(isBlindSpot);
        
        if (riskLevel === 'high' || (riskLevel === 'medium' && riskLevel === 'medium')) {
          blindSpots.push({
            id: `bs-${unit._id}-${dateStr}`,
            unit_id: unit._id,
            location: unit.name || `지역 ${unit._id}`,
            lat: extractLat(unit.geom),
            lng: extractLng(unit.geom),
            risk_level: riskLevel,
            detection_reason: isBlindSpot.reason,
            signals: {
              human: {
                value: avgComplaints,
                status: avgComplaints < 1 ? 'low' : avgComplaints < 3 ? 'normal' : 'high'
              },
              geo: {
                value: geoData ? calculateGeoVulnerability(geoData) : null,
                status: geoData && calculateGeoVulnerability(geoData) > 6 ? 'high' : 'normal'
              },
              population: {
                value: popData.length > 0 ? calculatePopChange(popData) : null,
                status: popData.length > 0 && calculatePopChange(popData) > 0.15 ? 'high' : 'normal'
              }
            },
            recommended_action: generateRecommendation(isBlindSpot)
          });
        }
      }
    } catch (error) {
      console.error(`  Error processing ${unit._id}:`, error.message);
    }
  }
  
  // 위험도 순으로 정렬
  blindSpots.sort((a, b) => {
    const riskOrder = { high: 3, medium: 2, low: 1 };
    return riskOrder[b.risk_level] - riskOrder[a.risk_level];
  });
  
  console.log(`✅ Found ${blindSpots.length} blind spots\n`);
  
  // 결과 출력
  blindSpots.slice(0, 10).forEach((spot, idx) => {
    console.log(`${idx + 1}. ${spot.location} (${spot.unit_id})`);
    console.log(`   위험도: ${spot.risk_level}`);
    console.log(`   이유: ${spot.detection_reason}`);
    console.log('');
  });
  
  await mongoose.connection.close();
  process.exit(0);
}

function detectBlindSpot(avgComplaints, geoData, popData) {
  // 민원이 낮은지 확인 (평균 1건 이하)
  const lowComplaints = avgComplaints < 1;
  
  // Geo 취약도 확인
  const geoVulnerable = geoData && calculateGeoVulnerability(geoData) > 6;
  
  // Population 변화 확인
  const popChange = popData.length > 0 ? calculatePopChange(popData) : 0;
  const popSurge = popChange > 0.15;
  
  // 사각지대 조건: 민원 낮은데 geo 또는 pop이 튀는 경우
  if (lowComplaints && (geoVulnerable || popSurge)) {
    const reasons = [];
    if (geoVulnerable) reasons.push('지리 취약도 높음');
    if (popSurge) reasons.push(`생활인구 급증 ${Math.round(popChange * 100)}%`);
    
    return {
      detected: true,
      reason: `민원은 적으나 ${reasons.join(', ')}하여 사각지대 가능성`,
      geoVulnerable,
      popSurge
    };
  }
  
  return { detected: false };
}

function calculateGeoVulnerability(geoData) {
  const factors = [
    (geoData.alley_density || 0) / 10,
    (geoData.backroad_ratio || 0) * 10,
    (1 - (geoData.ventilation_proxy || 0) / 10) * 10,
    (1 - (geoData.accessibility_proxy || 0) / 10) * 10
  ];
  return factors.reduce((sum, f) => sum + f, 0) / factors.length;
}

function calculatePopChange(popData) {
  if (popData.length < 2) return 0;
  const changeRates = popData.filter(d => d.pop_change_rate !== null && d.pop_change_rate !== undefined)
    .map(d => d.pop_change_rate);
  return changeRates.length > 0 
    ? changeRates.reduce((a, b) => a + b, 0) / changeRates.length 
    : 0;
}

function calculateRiskLevel(blindSpot) {
  let risk = 0;
  if (blindSpot.geoVulnerable) risk += 2;
  if (blindSpot.popSurge) risk += 2;
  
  if (risk >= 3) return 'high';
  if (risk >= 2) return 'medium';
  return 'low';
}

function generateRecommendation(blindSpot) {
  const actions = [];
  if (blindSpot.geoVulnerable) {
    actions.push('현장 점검 및 추가 모니터링 필요');
  }
  if (blindSpot.popSurge) {
    actions.push('생활인구 변화 추적 및 원인 분석');
  }
  return actions.length > 0 ? actions.join(', ') : '현장 확인 권고';
}

function extractLat(geom) {
  if (geom && geom.type === 'Polygon' && geom.coordinates && geom.coordinates[0]) {
    const lats = geom.coordinates[0].map(c => c[1]);
    return (Math.min(...lats) + Math.max(...lats)) / 2;
  }
  return 37.5665;
}

function extractLng(geom) {
  if (geom && geom.type === 'Polygon' && geom.coordinates && geom.coordinates[0]) {
    const lngs = geom.coordinates[0].map(c => c[0]);
    return (Math.min(...lngs) + Math.max(...lngs)) / 2;
  }
  return 126.9780;
}

// 명령줄 인자 처리
const dateArg = process.argv[2] || null;
const riskLevelArg = process.argv[3] || 'high';

generateBlindSpots(dateArg, riskLevelArg).catch(error => {
  console.error('❌ Error:', error);
  process.exit(1);
});

