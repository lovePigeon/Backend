import mongoose from 'mongoose';

/**
 * 베이스라인 메트릭 (서울시 전체 평균/증가율 기준선)
 * 
 * 목적:
 * - Human-signal의 "베이스라인"과 "증가율 판단 기준" 제공
 * - Priority Score 계산 시 상대적 비교 기준
 * - Action Card 설명 강화
 */
const BaselineMetricSchema = new mongoose.Schema({
  period: {
    type: String,
    required: true,
    index: true,
    // YYYY-MM 형식 (예: "2025-08")
    match: /^\d{4}-\d{2}$/
  },
  category: {
    type: String,
    required: true,
    index: true,
    enum: ['전체', '청소', '환경', '도로', '교통', '주택건축', '가로정비', '보건', '공원녹지', '기타']
  },
  citywide_total: {
    type: Number,
    required: true,
    min: 0
  },
  citywide_avg_per_unit: {
    type: Number,
    // 단위당 평균 (citywide_total / spatial_units_count)
    // 계산 시 동적으로 사용 가능하므로 선택적
  },
  growth_rate: {
    type: Number,
    // 전월 대비 증가율 (예: 0.15 = 15% 증가)
    default: 0
  },
  source: {
    type: String,
    default: 'smart_complaint'
  },
  meta: {
    type: Map,
    of: mongoose.Schema.Types.Mixed,
    default: {}
  },
  created_at: {
    type: Date,
    default: Date.now
  }
}, {
  collection: 'baseline_metrics',
  timestamps: true
});

// period + category 조합이 unique
BaselineMetricSchema.index({ period: 1, category: 1 }, { unique: true });
BaselineMetricSchema.index({ period: -1 });

export default mongoose.model('BaselineMetric', BaselineMetricSchema);

