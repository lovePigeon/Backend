import mongoose from 'mongoose';

const SignalGeoSchema = new mongoose.Schema({
  _id: {
    type: String,
    required: true
  },
  alley_density: Number,
  backroad_ratio: {
    type: Number,
    min: 0,
    max: 1
  },
  ventilation_proxy: Number,
  accessibility_proxy: Number,
  landuse_mix: {
    type: Number,
    min: 0,
    max: 1
  },
  // 상습 무단투기 지역 정보 (신규)
  habitual_dumping_risk: {
    type: Number,
    // 상습 무단투기 위험도 (0-1)
    min: 0,
    max: 1
  },
  habitual_dumping_count: {
    type: Number,
    // 상습 지역 지정 횟수
    min: 0,
    default: 0
  },
  habitual_dumping_locations: [{
    lat: Number,
    lng: Number,
    address: String,
    risk_level: {
      type: String,
      enum: ['high', 'medium', 'low']
    }
  }],
  source: {
    type: String,
    required: true
  },
  raw: {
    type: Map,
    of: mongoose.Schema.Types.Mixed,
    default: {}
  }
}, {
  _id: false,
  collection: 'signals_geo'
});

export default mongoose.model('SignalGeo', SignalGeoSchema);

