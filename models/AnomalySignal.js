import mongoose from 'mongoose';

/**
 * AnomalySignal Model
 * 
 * AI Component: Unsupervised Anomaly Detection
 * 
 * This collection stores anomaly detection results computed using statistical methods
 * (Z-score, rolling deviation) without requiring labeled training data.
 * 
 * Why this is AI:
 * - Unsupervised learning: No labeled examples needed
 * - Pattern recognition: Detects unusual patterns in time-series data
 * - Adaptive: Learns normal patterns from historical data per unit
 * 
 * Why no labels needed:
 * - Uses statistical deviation from historical baseline
 * - Compares recent patterns to past patterns for the same unit
 * - Flags deviations beyond statistical thresholds (e.g., 2-3 standard deviations)
 * 
 * Why this fits Early Warning:
 * - Detects rapid deterioration before it becomes a major problem
 * - Focuses on "change rate" rather than absolute values
 * - Identifies areas where complaints are spiking unexpectedly
 */
const AnomalySignalSchema = new mongoose.Schema({
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
  // AI Output: Anomaly Score (0-1, higher = more anomalous)
  anomaly_score: {
    type: Number,
    required: true,
    min: 0,
    max: 1
  },
  // AI Output: Binary flag (true if anomaly detected)
  anomaly_flag: {
    type: Boolean,
    required: true,
    default: false
  },
  // Input features used for anomaly detection
  features: {
    complaint_change_4w: {
      type: Number,
      description: "4-week change in total complaints (recent vs baseline)"
    },
    complaint_growth_rate: {
      type: Number,
      description: "Complaint growth rate vs city-wide baseline"
    },
    night_ratio_change: {
      type: Number,
      description: "Change in night_ratio (recent vs historical average)"
    },
    population_change_rate: {
      type: Number,
      description: "Population change rate (recent vs historical)"
    }
  },
  // Statistical metrics used for detection
  stats: {
    z_score: {
      type: Number,
      description: "Z-score of combined features (standard deviations from mean)"
    },
    rolling_mean: {
      type: Number,
      description: "Rolling mean of historical values"
    },
    rolling_std: {
      type: Number,
      description: "Rolling standard deviation"
    }
  },
  // Explanation for anomaly (if detected)
  explanation: {
    type: String,
    description: "Human-readable explanation of why anomaly was detected"
  },
  created_at: {
    type: Date,
    default: Date.now
  }
}, {
  collection: 'anomaly_signals'
});

// Indexes for efficient querying
AnomalySignalSchema.index({ unit_id: 1, date: 1 }, { unique: true });
AnomalySignalSchema.index({ date: 1, anomaly_flag: 1 });
AnomalySignalSchema.index({ anomaly_flag: 1, anomaly_score: -1 });

export default mongoose.model('AnomalySignal', AnomalySignalSchema);

