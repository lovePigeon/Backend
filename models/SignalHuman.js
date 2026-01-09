import mongoose from 'mongoose';

// signal_type별로 분리된 구조
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
  signal_type: {
    type: String,
    required: true,
    enum: ['total', 'odor', 'trash', 'illegal_dumping', 'night_ratio', 'repeat_ratio', 'other'],
    index: true
  },
  value: {
    type: Number,
    required: true
  },
  meta: {
    source: {
      type: String,
      default: 'csv_import'
    },
    category: String,
    raw: {
      type: Map,
      of: mongoose.Schema.Types.Mixed,
      default: {}
    }
  }
}, {
  collection: 'signals_human',
  timestamps: true
});

// unit_id, date, signal_type 조합이 unique하도록
SignalHumanSchema.index({ unit_id: 1, date: 1, signal_type: 1 }, { unique: true });
SignalHumanSchema.index({ unit_id: 1, date: 1 });
SignalHumanSchema.index({ signal_type: 1, date: 1 });

export default mongoose.model('SignalHuman', SignalHumanSchema);
