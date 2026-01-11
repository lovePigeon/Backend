import mongoose from 'mongoose';
import dotenv from 'dotenv';
import SignalHuman from '../models/SignalHuman.js';
import SpatialUnit from '../models/SpatialUnit.js';
import { connectDB } from '../config/database.js';

dotenv.config();

async function main() {
  try {
    await connectDB();
    
    const totalHuman = await SignalHuman.countDocuments();
    const nonZeroHuman = await SignalHuman.countDocuments({ complaint_total: { $gt: 0 } });
    const totalSpatial = await SpatialUnit.countDocuments();
    
    console.log('\n📊 MongoDB 데이터 현황:\n');
    console.log(`  signals_human: ${totalHuman}개 (complaint_total > 0: ${nonZeroHuman}개)`);
    console.log(`  spatial_units: ${totalSpatial}개\n`);
    
    if (nonZeroHuman > 0) {
      const sample = await SignalHuman.findOne({ complaint_total: { $gt: 0 } });
      console.log('✅ 샘플 데이터 (complaint_total > 0):');
      console.log(`  unit_id: ${sample.unit_id}`);
      console.log(`  date: ${sample.date}`);
      console.log(`  complaint_total: ${sample.complaint_total}\n`);
    } else {
      const sample = await SignalHuman.findOne();
      console.log('⚠️  모든 데이터의 complaint_total이 0입니다.');
      console.log('샘플 데이터:');
      console.log(JSON.stringify(sample, null, 2));
    }
    
    await mongoose.connection.close();
    process.exit(0);
  } catch (error) {
    console.error('❌ Error:', error);
    await mongoose.connection.close();
    process.exit(1);
  }
}

main();

