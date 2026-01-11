import mongoose from 'mongoose';

const InterventionSchema = new mongoose.Schema({
  unit_id: {
    type: String,
    required: true,
    index: true
  },
  intervention_type: {
    type: String,
    required: true
  },
  start_date: {
    type: String,
    required: true,
    index: true
  },
  end_date: String,
  note: String,
  created_by: {
    type: String,
    required: true
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
  collection: 'interventions'
});

InterventionSchema.index({ unit_id: 1, start_date: -1 });

export default mongoose.model('Intervention', InterventionSchema);

