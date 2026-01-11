import express from 'express';
import ComfortIndex from '../models/ComfortIndex.js';
import SpatialUnit from '../models/SpatialUnit.js';
import SignalGeo from '../models/SignalGeo.js';
import AnomalySignal from '../models/AnomalySignal.js';

const router = express.Router();

// 구 코드 -> 구 이름 매핑
const DISTRICT_NAME_MAP = {
  '11110': '종로구',
  '11140': '중구',
  '11170': '용산구',
  '11200': '성동구',
  '11215': '광진구',
  '11230': '동대문구',
  '11260': '중랑구',
  '11290': '성북구',
  '11305': '강북구',
  '11320': '도봉구',
  '11350': '노원구',
  '11380': '은평구',
  '11410': '서대문구',
  '11440': '마포구',
  '11470': '양천구',
  '11500': '강서구',
  '11530': '구로구',
  '11545': '금천구',
  '11560': '영등포구',
  '11590': '동작구',
  '11620': '관악구',
  '11650': '서초구',
  '11680': '강남구',
  '11710': '송파구',
  '11740': '강동구'
};

// unit_id로 구 이름 가져오기
function getDistrictName(unitId) {
  if (!unitId) return unitId;
  // 구 단위 코드인지 확인 (5자리 코드)
  if (unitId.length === 5 && DISTRICT_NAME_MAP[unitId]) {
    return DISTRICT_NAME_MAP[unitId];
  }
  // 행정동 코드인 경우 (8자리 이상)
  if (unitId.length >= 8) {
    const districtCode = unitId.substring(0, 5);
    if (DISTRICT_NAME_MAP[districtCode]) {
      return DISTRICT_NAME_MAP[districtCode]; // 일단 구 이름 반환, 나중에 행정동 이름으로 업데이트 가능
    }
  }
  return unitId; // 매핑 없으면 원본 반환
}

/**
 * @swagger
 * /api/v1/priority-queue:
 *   get:
 *     summary: Priority Queue 조회 (UCI 점수 높은 순)
 *     tags: [Priority Queue]
 *     parameters:
 *       - in: query
 *         name: date
 *         required: true
 *         schema:
 *           type: string
 *           format: date
 *         description: 날짜 (YYYY-MM-DD)
 *       - in: query
 *         name: top_n
 *         schema:
 *           type: integer
 *           default: 20
 *           minimum: 1
 *           maximum: 100
 *         description: 상위 N개
 *     responses:
 *       200:
 *         description: Priority queue 목록
 *         content:
 *           application/json:
 *             schema:
 *               type: array
 *               items:
 *                 type: object
 *                 properties:
 *                   rank:
 *                     type: integer
 *                   unit_id:
 *                     type: string
 *                   name:
 *                     type: string
 *                   uci_score:
 *                     type: number
 *                   uci_grade:
 *                     type: string
 *                   status:
 *                     type: string
 *                     enum: [low, medium, high]
 *                     description: 상태 (영어)
 *                   status_kr:
 *                     type: string
 *                     enum: [낮음, 보통, 높음]
 *                     description: 상태 (한국어)
 *                   comfort_index:
 *                     type: number
 *                     description: 편의성 지수 (100 - UCI)
 *                   why_summary:
 *                     type: string
 *                   key_drivers:
 *                     type: array
 *                   habitual_dumping_risk:
 *                     type: number
 *                     description: 상습 무단투기 위험도 (0-1)
 *                   anomaly_score:
 *                     type: number
 *                     description: AI 이상 탐지 점수 (0-1, 높을수록 이상)
 *                   anomaly_flag:
 *                     type: boolean
 *                     description: AI 이상 탐지 플래그 (true면 급격한 악화 신호)
 *                   anomaly_explanation:
 *                     type: string
 *                     description: AI 이상 탐지 설명
 *             examples:
 *               priorityQueue:
 *                 value:
 *                   - rank: 1
 *                     unit_id: "11110515"
 *                     name: "필운동"
 *                     uci_score: 63.14
 *                     uci_grade: "D"
 *                     status: "high"
 *                     status_kr: "높음"
 *                     comfort_index: 36.86
 *                     why_summary: "총 민원 1,878건, 서울시 평균 대비 1.2배 높은 신고량"
 *                     key_drivers:
 *                       - signal: "total_complaints"
 *                         value: 1878
 *                       - signal: "relative_to_baseline"
 *                         value: 1.2
 *                     habitual_dumping_risk: 0.75
 *                     anomaly_score: 0.85
 *                     anomaly_flag: true
 *                     anomaly_explanation: "최근 4주 민원이 45% 증가, 통계적 이상치 감지 (Z-score: 3.2) - 급격한 악화 신호"
 *                   - rank: 2
 *                     unit_id: "11110540"
 *                     name: "종로동"
 *                     uci_score: 44.6
 *                     uci_grade: "C"
 *                     status: "medium"
 *                     status_kr: "보통"
 *                     comfort_index: 55.4
 *                     why_summary: "최근 4주간 신호 분석"
 *                     key_drivers:
 *                       - signal: "total_complaints"
 *                         value: 850
 *                     habitual_dumping_risk: null
 *                     anomaly_score: null
 *                     anomaly_flag: false
 *                     anomaly_explanation: null
 *                   - rank: 3
 *                     unit_id: "11110"
 *                     name: "종로구"
 *                     uci_score: 35.0
 *                     uci_grade: "B"
 *                     status: "low"
 *                     status_kr: "낮음"
 *                     comfort_index: 65.0
 *                     why_summary: "총 민원 1,878건"
 *                     key_drivers:
 *                       - signal: "total_complaints"
 *                         value: 1878
 *                     habitual_dumping_risk: null
 */
router.get('/', async (req, res) => {
  try {
    const { date, top_n = 20 } = req.query;

    // 날짜가 없거나 해당 날짜에 데이터가 없으면 최신 날짜 사용
    let targetDate = date;
    let comfortIndices = [];

    // 요청된 날짜로 먼저 조회 (.lean()으로 일반 객체로 변환)
    if (targetDate) {
      comfortIndices = await ComfortIndex.find({ date: targetDate })
        .sort({ uci_score: -1 })
        .limit(parseInt(top_n))
        .lean();
    }

    // 해당 날짜에 데이터가 없으면 최신 날짜 조회
    if (!targetDate || comfortIndices.length === 0) {
      const latestComfortIndex = await ComfortIndex.findOne()
        .sort({ date: -1 })
        .lean();
      
      if (latestComfortIndex) {
        targetDate = latestComfortIndex.date;
        comfortIndices = await ComfortIndex.find({ date: targetDate })
          .sort({ uci_score: -1 })
          .limit(parseInt(top_n))
          .lean();
      }
    }

    // 데이터가 없으면 빈 배열 반환
    if (comfortIndices.length === 0) {
      console.log(`[Priority Queue] No data found. Requested date: ${date}, Target date: ${targetDate}`);
      return res.json([]);
    }

    console.log(`[Priority Queue] Found ${comfortIndices.length} items for date: ${targetDate}`);

    // unit_id 추출 및 units 조회
    const unitIds = comfortIndices.map(ci => ci.unit_id).filter(id => id); // null/undefined 제거
    
    if (unitIds.length === 0) {
      return res.json([]);
    }

    const units = await SpatialUnit.find({ _id: { $in: unitIds } });
    const unitsMap = {};
    units.forEach(u => { 
      unitsMap[u._id] = u.name; 
    });

    // 상습지역 정보 조회 (Priority Queue 가중치 강화용)
    const geoSignals = await SignalGeo.find({ _id: { $in: unitIds } }).lean();
    const geoMap = {};
    geoSignals.forEach(geo => {
      geoMap[geo._id] = geo;
    });

    // AI 이상 탐지 정보 조회
    const anomalySignals = await AnomalySignal.find({ 
      unit_id: { $in: unitIds },
      date: targetDate
    }).lean();
    const anomalyMap = {};
    anomalySignals.forEach(anomaly => {
      anomalyMap[anomaly.unit_id] = anomaly;
    });

    // items 생성 (unit이 없어도 unit_id로 표시)
    // AI 이상 탐지 결과를 반영하여 우선순위 부스팅
    const itemsWithAnomaly = comfortIndices
      .filter(ci => ci.unit_id) // unit_id가 있는 것만
      .map((ci) => {
        // 상습지역 정보 확인
        const geoSignal = geoMap[ci.unit_id];
        const isHabitualArea = geoSignal && geoSignal.habitual_dumping_risk > 0.5;
        
        // AI 이상 탐지 정보 확인
        const anomalySignal = anomalyMap[ci.unit_id];
        const hasAnomaly = anomalySignal && anomalySignal.anomaly_flag === true;
        
        // 우선순위 부스팅: anomaly_flag가 true면 UCI 점수에 가산점 부여
        // (UCI 점수가 높을수록 우선순위가 높으므로, anomaly가 있으면 점수를 높임)
        let boostedUciScore = ci.uci_score;
        if (hasAnomaly && anomalySignal.anomaly_score > 0.7) {
          // anomaly_score가 높을수록 더 큰 가산점 (최대 10점)
          const boostAmount = anomalySignal.anomaly_score * 10;
          boostedUciScore = Math.min(100, ci.uci_score + boostAmount);
        }
        
        return {
          ...ci,
          boostedUciScore,
          anomalySignal
        };
      });
    
    // 부스팅된 UCI 점수로 재정렬
    itemsWithAnomaly.sort((a, b) => b.boostedUciScore - a.boostedUciScore);
    
    const items = itemsWithAnomaly
      .slice(0, parseInt(top_n)) // top_n만큼만 선택
      .map((ci, index) => {
        const geoSignal = geoMap[ci.unit_id];
        const isHabitualArea = geoSignal && geoSignal.habitual_dumping_risk > 0.5;
        const anomalySignal = ci.anomalySignal;
        const hasAnomaly = anomalySignal && anomalySignal.anomaly_flag === true;
        
        // key_drivers에서 _id 필드 제거 (MongoDB 객체 직렬화 문제 해결)
        const cleanKeyDrivers = (ci.explain?.key_drivers || []).map(driver => {
          if (driver && typeof driver === 'object') {
            // 객체 복사 및 _id 제거
            const clean = JSON.parse(JSON.stringify(driver));
            delete clean._id;
            // 필요한 필드만 반환
            return {
              signal: clean.signal,
              value: clean.value
            };
          }
          return driver;
        }).filter(d => d && d.signal && d.value !== undefined); // signal과 value가 있는 것만
        
        // why_summary에 상습지역 정보 및 AI 이상 탐지 정보 추가
        let whySummary = ci.explain?.why_summary || '';
        if (isHabitualArea && geoSignal) {
          const habitualInfo = `상습 무단투기 지역 (위험도: ${Math.round(geoSignal.habitual_dumping_risk * 100)}%)`;
          whySummary = whySummary 
            ? `${whySummary}, ${habitualInfo}`
            : habitualInfo;
        }
        // AI 이상 탐지 결과 추가 (급격한 악화 신호)
        if (hasAnomaly && anomalySignal.explanation) {
          const anomalyInfo = `[AI 이상 탐지] ${anomalySignal.explanation}`;
          whySummary = whySummary 
            ? `${whySummary}. ${anomalyInfo}`
            : anomalyInfo;
        }
        
        // 지역 이름 결정: spatial_unit에 있으면 그것 사용, 없으면 구 이름 매핑 사용
        let regionName = unitsMap[ci.unit_id];
        if (!regionName) {
          regionName = getDistrictName(ci.unit_id);
        }
        
        // 프론트엔드 표시용 status/level 추가
        // UCI 점수: 0-100 (높을수록 위험/불편)
        // 프론트엔드 "낮음/보통/높음" 표시용
        const uciScore = Math.round(ci.uci_score * 100) / 100;
        
        // Status 판단 로직 (UCI 점수 기반)
        // UCI >= 60: 높음 (D, E 등급) - 위험도 높음
        // UCI >= 40: 보통 (C 등급) - 위험도 중간
        // UCI < 40: 낮음 (A, B 등급) - 위험도 낮음
        let statusLevel = 'low'; // 기본값: 낮음
        if (uciScore >= 60) {
          statusLevel = 'high'; // 높음
        } else if (uciScore >= 40) {
          statusLevel = 'medium'; // 보통
        }
        
        // 프론트엔드가 사용할 "편의성 지수" (0-100, 높을수록 편의)
        // UCI 점수는 높을수록 위험이므로, 편의성 지수는 반대로 계산
        const comfortIndex = Math.round((100 - uciScore) * 100) / 100; // 편의성 지수 (높을수록 좋음)
        
        // 한국어 상태 문자열
        const statusKr = statusLevel === 'high' ? '높음' : statusLevel === 'medium' ? '보통' : '낮음';
        
        return {
          rank: index + 1,
          unit_id: ci.unit_id,
          name: regionName,
          uci_score: uciScore, // 원본 UCI 점수 (0-100, 높을수록 위험)
          uci_grade: ci.uci_grade,
          why_summary: whySummary,
          key_drivers: cleanKeyDrivers,
          // 프론트엔드 표시용 필드 (명시적으로 제공)
          status: statusLevel, // 'low' | 'medium' | 'high'
          status_kr: statusKr, // '낮음' | '보통' | '높음'
          // 프론트엔드가 혼동할 수 있으므로 명확히 구분
          level: statusLevel, // status와 동일 (프론트엔드 호환성)
          level_kr: statusKr, // status_kr과 동일 (프론트엔드 호환성)
          comfort_index: comfortIndex, // 편의성 지수 (100 - UCI)
          // 상습지역 정보 추가 (신규)
          habitual_dumping_risk: geoSignal ? geoSignal.habitual_dumping_risk : null,
          // AI 이상 탐지 정보 추가
          anomaly_score: anomalySignal ? anomalySignal.anomaly_score : null,
          anomaly_flag: hasAnomaly,
          anomaly_explanation: anomalySignal ? anomalySignal.explanation : null
        };
      });

    // items가 비어있으면 빈 배열 반환
    if (items.length === 0) {
      console.log(`[Priority Queue] Items array is empty after processing. comfortIndices: ${comfortIndices.length}, units: ${units.length}`);
      return res.json([]);
    }

    console.log(`[Priority Queue] Returning ${items.length} items`);
    res.json(items);
  } catch (error) {
    console.error('Priority queue error:', error);
    res.status(500).json({
      success: false,
      message: 'Priority queue 조회 중 오류가 발생했습니다.',
      error: error.message
    });
  }
});

export default router;
