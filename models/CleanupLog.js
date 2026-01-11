import mongoose from 'mongoose';

/**
 * 쓰레기 수거 현황 로그
 * 
 * 역할: 개입(행정 조치) 정보 및 Before/After 효과 추적용 데이터
 * - Before/After Tracking에만 사용
 * - Human Signal을 만드는 데이터가 아님
 */
const CleanupLogSchema = new mongoose.Schema({
  unit_id: {
    type: String,
    required: true,
    index: true
  },
  date: {
    type: String,
    required: true,
    index: true,
    // YYYY-MM-DD 형식
    match: /^\d{4}-\d{2}-\d{2}$/
  },
  cleanup_type: {
    type: String,
    enum: ['regular', 'intensive', 'emergency'],
    default: 'regular'
  },
  collection_frequency: {
    type: Number,
    // 수거 주기 (일)
    min: 0
  },
  collection_amount: {
    type: Number,
    // 수거량 (톤/일)
    min: 0
  },
  collection_rate: {
    type: Number,
    // 수거율 (%)
    min: 0,
    max: 100
  },
  processing_method: {
    landfill: Number,      // 매립 (톤/일)
    incineration: Number,  // 소각 (톤/일)
    recycling: Number,     // 재활용 (톤/일)
    other: Number          // 기타 (톤/일)
  },
  population_rate: {
    type: Number,
    // 수거지 인구율 (%)
    min: 0,
    max: 100
  },
  source: {
    type: String,
    default: 'seoul_cleanup_status'
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
  collection: 'cleanup_logs',
  timestamps: true
});

// 인덱스
CleanupLogSchema.index({ unit_id: 1, date: -1 });
CleanupLogSchema.index({ date: -1 });

export default mongoose.model('CleanupLog', CleanupLogSchema);

