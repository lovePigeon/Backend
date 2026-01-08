import mongoose from 'mongoose';

const SignalPopulationSchema = new mongoose.Schema({
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
  pop_total: Number,
  pop_night: Number,
  pop_change_rate: Number,
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
  collection: 'signals_population'
});

SignalPopulationSchema.index({ unit_id: 1, date: 1 }, { unique: true });

export default mongoose.model('SignalPopulation', SignalPopulationSchema);

