import express from 'express';
import { settings } from '../config/settings.js';

const router = express.Router();

/**
 * @swagger
 * /api/v1/uci-info:
 *   get:
 *     summary: UCI 계산 로직 설명 조회
 *     tags: [UCI Info]
 *     description: Urban Comfort Index 계산 방식 및 가중치 정보를 반환합니다.
 *     responses:
 *       200:
 *         description: UCI 계산 로직 설명
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 description:
 *                   type: string
 *                 formula:
 *                   type: string
 *                 signal_groups:
 *                   type: array
 *                 weights:
 *                   type: object
 *                 grades:
 *                   type: array
 *                 window:
 *                   type: object
 *             examples:
 *               uciInfo:
 *                 value:
 *                   description: "Urban Comfort Index는 도시 환경 문제를 조기에 감지하고 행정 자원 투입 우선순위를 추천하는 지표입니다."
 *                   formula: "UCI = (HumanScore × 0.5) + (GeoScore × 0.3) + (PopulationScore × 0.2) × 100"
 *                   signal_groups:
 *                     - name: "Human Signal"
 *                       weight: 0.5
 *                       description: "민원 기반 신호"
 *                       components:
 *                         - name: "민원 총량"
 *                           weight: 0.15
 *                         - name: "서울시 평균 대비 상대적 비율"
 *                           weight: 0.20
 *                         - name: "초과 증가율"
 *                           weight: 0.15
 *                         - name: "악취/쓰레기/불법투기 비율"
 *                           weight: 0.39
 *                         - name: "야간 집중도"
 *                           weight: 0.11
 *                     - name: "Geo Signal"
 *                       weight: 0.3
 *                       description: "공간 취약성 신호"
 *                       components:
 *                         - name: "골목 밀도"
 *                           weight: 0.25
 *                         - name: "후면 도로 비율"
 *                           weight: 0.20
 *                         - name: "상습 무단투기 위험도"
 *                           weight: 0.20
 *                         - name: "환기/접근성 proxy"
 *                           weight: 0.27
 *                         - name: "토지이용 혼합도"
 *                           weight: 0.08
 *                     - name: "Population Signal"
 *                       weight: 0.2
 *                       description: "생활인구 신호"
 *                       components:
 *                         - name: "생활인구 규모"
 *                           weight: 0.30
 *                         - name: "야간 인구 비중"
 *                           weight: 0.40
 *                         - name: "인구 증가율"
 *                           weight: 0.30
 *                   weights:
 *                     human: 0.5
 *                     geo: 0.3
 *                     population: 0.2
 *                     pigeon: 0.0
 *                   grades:
 *                     - grade: "A"
 *                       range: "0-20"
 *                       description: "매우 양호"
 *                       color: "#10b981"
 *                     - grade: "B"
 *                       range: "20-40"
 *                       description: "양호"
 *                       color: "#3b82f6"
 *                     - grade: "C"
 *                       range: "40-60"
 *                       description: "보통"
 *                       color: "#f59e0b"
 *                     - grade: "D"
 *                       range: "60-80"
 *                       description: "주의 필요"
 *                       color: "#ef4444"
 *                     - grade: "E"
 *                       range: "80-100"
 *                       description: "즉시 조치 필요"
 *                       color: "#dc2626"
 *                   window:
 *                     weeks: 4
 *                     days: 28
 *                     description: "최근 4주간 데이터를 집계하여 계산합니다."
 *                   note: "높을수록 위험/불편 신호가 강함을 의미합니다."
 */
router.get('/', (req, res) => {
  try {
    const uciInfo = {
      description: "Urban Comfort Index(UCI)는 공개 가능한 도시 데이터를 활용하여 도시 환경 문제를 조기에 감지하고, 행정 자원을 어디에 먼저 투입할지 우선순위를 추천하는 Early Warning 의사결정 도구입니다.",
      
      formula: "UCI = (HumanScore × 0.5) + (GeoScore × 0.3) + (PopulationScore × 0.2) × 100",
      
      signal_groups: [
        {
          name: "Human Signal",
          weight: settings.uciWeights.human,
          weight_percent: Math.round(settings.uciWeights.human * 100),
          description: "민원 기반 신호 (최근 4주간 집계)",
          components: [
            {
              name: "민원 총량",
              weight: 0.15,
              description: "일평균 민원 건수 (정규화: 일평균 10건 = 1.0)"
            },
            {
              name: "서울시 평균 대비 상대적 비율",
              weight: 0.20,
              description: "서울시 전체 평균 대비 해당 지역의 민원 비율 (최대 3배로 제한)"
            },
            {
              name: "초과 증가율",
              weight: 0.15,
              description: "서울시 평균 증가율 대비 해당 지역의 초과 증가율"
            },
            {
              name: "악취 민원 비율",
              weight: 0.15,
              description: "전체 민원 중 악취 민원 비율"
            },
            {
              name: "쓰레기 민원 비율",
              weight: 0.12,
              description: "전체 민원 중 쓰레기 민원 비율"
            },
            {
              name: "불법투기 민원 비율",
              weight: 0.12,
              description: "전체 민원 중 불법투기 민원 비율"
            },
            {
              name: "야간 집중도",
              weight: 0.11,
              description: "야간(20시~06시) 민원 비율"
            }
          ]
        },
        {
          name: "Geo Signal",
          weight: settings.uciWeights.geo,
          weight_percent: Math.round(settings.uciWeights.geo * 100),
          description: "공간 취약성 신호 (정적 데이터)",
          components: [
            {
              name: "골목 밀도",
              weight: 0.25,
              description: "골목길 밀도 (정규화: 100 = 1.0)"
            },
            {
              name: "후면 도로 비율",
              weight: 0.20,
              description: "후면 도로 비율 (0-1)"
            },
            {
              name: "상습 무단투기 위험도",
              weight: 0.20,
              description: "상습 무단투기 지역 위험도 (0-1)"
            },
            {
              name: "환기 proxy",
              weight: 0.15,
              description: "환기 상태 proxy (낮을수록 불량, 역정규화)"
            },
            {
              name: "접근성 proxy",
              weight: 0.12,
              description: "접근성 proxy (낮을수록 제한적, 역정규화)"
            },
            {
              name: "토지이용 혼합도",
              weight: 0.08,
              description: "토지이용 혼합도 (0-1)"
            }
          ]
        },
        {
          name: "Population Signal",
          weight: settings.uciWeights.population,
          weight_percent: Math.round(settings.uciWeights.population * 100),
          description: "생활인구 신호 (최근 4주간 집계)",
          components: [
            {
              name: "생활인구 규모",
              weight: 0.30,
              description: "일평균 생활인구 (정규화: 10,000명 = 1.0)"
            },
            {
              name: "야간 인구 비중",
              weight: 0.40,
              description: "야간 인구 비율 (0-1)"
            },
            {
              name: "인구 증가율",
              weight: 0.30,
              description: "인구 변화율 (정규화: 30% 증가 = 1.0)"
            }
          ]
        }
      ],
      
      weights: {
        human: settings.uciWeights.human,
        geo: settings.uciWeights.geo,
        population: settings.uciWeights.population,
        pigeon: settings.uciWeights.pigeon,
        note: "가중치는 신호가 없는 경우 자동으로 재정규화됩니다."
      },
      
      grades: [
        {
          grade: "A",
          range: "0-20",
          range_min: 0,
          range_max: 20,
          description: "매우 양호",
          status: "low",
          status_kr: "낮음",
          color: "#10b981",
          recommendation: "현재 상태 양호, 정기 모니터링 권장"
        },
        {
          grade: "B",
          range: "20-40",
          range_min: 20,
          range_max: 40,
          description: "양호",
          status: "low",
          status_kr: "낮음",
          color: "#3b82f6",
          recommendation: "현재 상태 양호, 주기적 점검 권장"
        },
        {
          grade: "C",
          range: "40-60",
          range_min: 40,
          range_max: 60,
          description: "보통",
          status: "medium",
          status_kr: "보통",
          color: "#f59e0b",
          recommendation: "주의 깊은 모니터링 필요"
        },
        {
          grade: "D",
          range: "60-80",
          range_min: 60,
          range_max: 80,
          description: "주의 필요",
          status: "high",
          status_kr: "높음",
          color: "#ef4444",
          recommendation: "우선순위 조치 필요"
        },
        {
          grade: "E",
          range: "80-100",
          range_min: 80,
          range_max: 100,
          description: "즉시 조치 필요",
          status: "high",
          status_kr: "높음",
          color: "#dc2626",
          recommendation: "즉시 조치 및 집중 관리 필요"
        }
      ],
      
      window: {
        weeks: settings.defaultWindowWeeks,
        days: settings.defaultWindowWeeks * 7,
        description: `최근 ${settings.defaultWindowWeeks}주간(${settings.defaultWindowWeeks * 7}일) 데이터를 집계하여 계산합니다.`
      },
      
      calculation_steps: [
        "1. 최근 4주간(28일) 데이터 수집",
        "2. 각 신호 그룹별 점수 계산 (0-1 범위로 정규화)",
        "3. 가중치 적용: Human(50%) + Geo(30%) + Population(20%)",
        "4. 최종 점수 계산: 가중합 × 100 (0-100 범위)",
        "5. 등급 부여: A(0-20), B(20-40), C(40-60), D(60-80), E(80-100)"
      ],
      
      normalization: {
        method: "Min-Max 정규화",
        outlier_handling: "Winsorize (상하 5%)",
        missing_data: "해당 신호 그룹 제외 후 가중치 재정규화"
      },
      
      baseline_comparison: {
        enabled: true,
        description: "서울시 전체 평균 민원 데이터와 비교하여 상대적 위험도를 계산합니다.",
        metrics: [
          "서울시 평균 대비 상대적 비율",
          "서울시 평균 증가율 대비 초과 증가율"
        ]
      },
      
      note: "높을수록 위험/불편 신호가 강함을 의미합니다. UCI는 정확한 예측이 아닌 우선순위 추천 도구입니다.",
      
      last_updated: "2026-01-11"
    };

    res.json({
      success: true,
      data: uciInfo
    });
  } catch (error) {
    res.status(500).json({
      success: false,
      message: 'UCI 정보 조회 중 오류가 발생했습니다.',
      error: error.message
    });
  }
});

export default router;

