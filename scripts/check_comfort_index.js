import mongoose from 'mongoose';
import dotenv from 'dotenv';
import ComfortIndex from '../models/ComfortIndex.js';
import { connectDB } from '../config/database.js';

dotenv.config();

async function main() {
  try {
    await connectDB();
    
    const count = await ComfortIndex.countDocuments();
    console.log(`\n✅ comfort_index: ${count}개\n`);
    
    if (count > 0) {
      const sample = await ComfortIndex.findOne();
      console.log('샘플:');
      console.log(`  unit_id: ${sample.unit_id}`);
      console.log(`  date: ${sample.date}`);
      console.log(`  uci_score: ${sample.uci_score}`);
      console.log(`  uci_grade: ${sample.uci_grade}\n`);
      
      // 날짜별 통계
      const dateStats = await ComfortIndex.aggregate([
        { $group: { _id: '$date', count: { $sum: 1 } } },
        { $sort: { _id: -1 } }
      ]);
      
      console.log('날짜별 통계:');
      dateStats.forEach(d => {
        console.log(`  ${d._id}: ${d.count}개`);
      });
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

