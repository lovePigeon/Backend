import mongoose from 'mongoose';

/**
 * 시간 패턴 템플릿
 * 
 * 역할: 시간 패턴(시간대·요일·야간/주말)을 정의하기 위한 템플릿 데이터
 * - 전주시 데이터에서 추출한 시간 패턴
 * - Action Card 룰 생성용
 * - 예측용이 아닌 행동 패턴 레퍼런스
 */
const TimePatternTemplateSchema = new mongoose.Schema({
  pattern_type: {
    type: String,
    required: true,
    index: true,
    enum: ['illegal_dumping', 'waste_complaint', 'odor_complaint', 'other']
  },
  violation_type: {
    type: String,
    // 위반 유형 (예: "담배꽁초 등 휴대쓰레기투기", "종량제봉투 미사용")
    index: true
  },
  time_pattern: {
    hour_distribution: {
      type: [Number],
      // 24시간별 분포 (0-23), 각 인덱스가 시간대
      default: Array(24).fill(0)
    },
    day_of_week_distribution: {
      월: { type: Number, default: 0 },
      화: { type: Number, default: 0 },
      수: { type: Number, default: 0 },
      목: { type: Number, default: 0 },
      금: { type: Number, default: 0 },
      토: { type: Number, default: 0 },
      일: { type: Number, default: 0 }
    },
    night_ratio: {
      type: Number,
      // 야간 비중 (20-06시)
      min: 0,
      max: 1,
      default: 0
    },
    weekend_ratio: {
      type: Number,
      // 주말 비중
      min: 0,
      max: 1,
      default: 0
    },
    peak_hours: {
      type: [Number],
      // 피크 시간대 (0-23)
      default: []
    },
    peak_days: {
      type: [String],
      // 피크 요일
      enum: ['월', '화', '수', '목', '금', '토', '일'],
      default: []
    }
  },
  sample_size: {
    type: Number,
    // 분석한 사건 수
    min: 0,
    required: true
  },
  source: {
    type: String,
    default: 'jeonju_illegal_dumping'
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
  collection: 'time_pattern_templates',
  timestamps: true
});

// 인덱스
TimePatternTemplateSchema.index({ pattern_type: 1, violation_type: 1 });
TimePatternTemplateSchema.index({ 'time_pattern.night_ratio': -1 });
TimePatternTemplateSchema.index({ 'time_pattern.weekend_ratio': -1 });

export default mongoose.model('TimePatternTemplate', TimePatternTemplateSchema);

