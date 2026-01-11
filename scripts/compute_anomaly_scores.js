/**
 * Compute Anomaly Scores Script
 * 
 * This script runs the AI anomaly detection for all units and saves results.
 * 
 * Usage:
 *   node scripts/compute_anomaly_scores.js [date] [unit_id]
 * 
 * Examples:
 *   node scripts/compute_anomaly_scores.js                    # All units, latest date
 *   node scripts/compute_anomaly_scores.js 2025-12-01        # All units, specific date
 *   node scripts/compute_anomaly_scores.js 2025-12-01 11110  # Specific unit
 */

import dotenv from 'dotenv';
import { connectDB } from '../config/database.js';
import { detectAnomaly } from '../services/anomalyDetection.js';
import AnomalySignal from '../models/AnomalySignal.js';
import SignalHuman from '../models/SignalHuman.js';
import SpatialUnit from '../models/SpatialUnit.js';
import { format, parseISO } from 'date-fns';

dotenv.config();

async function computeAnomalyScores(targetDate, unitId = null) {
  try {
    await connectDB();
    console.log('✅ MongoDB connected');

    // Determine target date
    let dateStr = targetDate;
    if (!dateStr) {
      // Use latest date from signals_human
      const latest = await SignalHuman.findOne({ signal_type: 'total' })
        .sort({ date: -1 });
      if (latest) {
        dateStr = latest.date;
      } else {
        dateStr = format(new Date(), 'yyyy-MM-dd');
      }
    }

    console.log(`📅 Target date: ${dateStr}`);

    // Get units to process
    let unitsToProcess = [];
    if (unitId) {
      unitsToProcess = [unitId];
    } else {
      // Get all units from spatial_units and signals_human
      const spatialUnits = await SpatialUnit.find({});
      const humanUnits = await SignalHuman.distinct('unit_id', { 
        signal_type: 'total',
        date: { $lte: dateStr }
      });
      
      const allUnitIds = new Set();
      spatialUnits.forEach(u => allUnitIds.add(u._id));
      humanUnits.forEach(id => allUnitIds.add(id));
      unitsToProcess = Array.from(allUnitIds);
    }

    console.log(`📊 Processing ${unitsToProcess.length} units...`);

    const results = [];
    let successCount = 0;
    let failedCount = 0;
    let anomalyCount = 0;

    for (const currentUnitId of unitsToProcess) {
      try {
        const result = await detectAnomaly(currentUnitId, dateStr, 4, 8);
        
        // Save to MongoDB
        await AnomalySignal.findOneAndUpdate(
          { unit_id: result.unit_id, date: result.date },
          {
            unit_id: result.unit_id,
            date: result.date,
            anomaly_score: result.anomaly_score,
            anomaly_flag: result.anomaly_flag,
            features: result.features,
            stats: result.stats,
            explanation: result.explanation,
            created_at: new Date()
          },
          { upsert: true, new: true }
        );

        if (result.anomaly_flag) {
          anomalyCount++;
          console.log(`  ⚠️  ${currentUnitId}: Anomaly detected (score: ${result.anomaly_score.toFixed(3)})`);
        }

        results.push({
          unit_id: currentUnitId,
          anomaly_score: result.anomaly_score,
          anomaly_flag: result.anomaly_flag,
          status: 'success'
        });
        successCount++;
      } catch (error) {
        console.error(`  ❌ Error for unit ${currentUnitId}:`, error.message);
        results.push({
          unit_id: currentUnitId,
          status: 'failed',
          error: error.message
        });
        failedCount++;
      }
    }

    console.log('\n📈 Summary:');
    console.log(`  ✅ Success: ${successCount}`);
    console.log(`  ❌ Failed: ${failedCount}`);
    console.log(`  ⚠️  Anomalies detected: ${anomalyCount}`);
    console.log(`  📅 Date: ${dateStr}`);

    return {
      success: true,
      date: dateStr,
      total: unitsToProcess.length,
      success_count: successCount,
      failed_count: failedCount,
      anomaly_count: anomalyCount,
      results
    };
  } catch (error) {
    console.error('❌ Script error:', error);
    throw error;
  }
}

// CLI execution
const args = process.argv.slice(2);
const targetDate = args[0] || null;
const unitId = args[1] || null;

computeAnomalyScores(targetDate, unitId)
  .then(result => {
    console.log('\n✅ Anomaly detection completed');
    process.exit(0);
  })
  .catch(error => {
    console.error('❌ Script failed:', error);
    process.exit(1);
  });

