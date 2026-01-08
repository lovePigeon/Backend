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

