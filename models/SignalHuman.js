import mongoose from 'mongoose';

const SignalHumanSchema = new mongoose.Schema({
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
  complaint_total: {
    type: Number,
    required: true,
    min: 0
  },
  complaint_odor: Number,
  complaint_trash: Number,
  complaint_illegal_dump: Number,
  night_ratio: {
    type: Number,
    min: 0,
    max: 1
  },
  repeat_ratio: {
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
  collection: 'signals_human'
});

SignalHumanSchema.index({ unit_id: 1, date: 1 }, { unique: true });

export default mongoose.model('SignalHuman', SignalHumanSchema);

