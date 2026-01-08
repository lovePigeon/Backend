import mongoose from 'mongoose';

const ComfortIndexSchema = new mongoose.Schema({
  unit_id: {
    type: String,
    required: true,
    index: true
  },
  date: {
    type: String,
    required: true,
    index: true
  },
  uci_score: {
    type: Number,
    required: true,
    min: 0,
    max: 100
  },
  uci_grade: {
    type: String,
    required: true,
    enum: ['A', 'B', 'C', 'D', 'E']
  },
  components: {
    human_score: Number,
    geo_score: Number,
    population_score: Number,
    pigeon_score: Number,
    human_normalized: Map,
    geo_normalized: Map,
    population_normalized: Map,
    pigeon_normalized: Map,
    weights: Map
  },
  explain: {
    why_summary: {
      type: String,
      required: true
    },
    key_drivers: [{
      signal: String,
      value: Number
    }]
  },
  created_at: {
    type: Date,
    default: Date.now
  }
}, {
  collection: 'comfort_index'
});

ComfortIndexSchema.index({ unit_id: 1, date: 1 }, { unique: true });
ComfortIndexSchema.index({ date: 1, uci_score: -1 });

export default mongoose.model('ComfortIndex', ComfortIndexSchema);

