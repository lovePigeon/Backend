import mongoose from 'mongoose';
import dotenv from 'dotenv';
import SignalHuman from '../models/SignalHuman.js';
import { connectDB } from '../config/database.js';

dotenv.config();

async function main() {
  try {
    await connectDB();
    
    const db = mongoose.connection.db;
    
    // 이전 구조와 새 구조 확인
    const oldCount = await db.collection('signals_human').countDocuments({ complaint_total: { $exists: true } });
    const newCount = await db.collection('signals_human').countDocuments({ signal_type: { $exists: true } });
    
    console.log('\n📊 signals_human 데이터 현황:\n');
    console.log(`  이전 구조 (complaint_total): ${oldCount}개`);
    console.log(`  새 구조 (signal_type): ${newCount}개\n`);
    
    if (newCount > 0) {
      const sample = await SignalHuman.findOne({ signal_type: 'total' });
      console.log('✅ 새 구조 샘플:');
      console.log(JSON.stringify(sample, null, 2));
      
      // signal_type별 개수
      const typeCounts = await SignalHuman.aggregate([
        { $group: { _id: '$signal_type', count: { $sum: 1 } } },
        { $sort: { count: -1 } }
      ]);
      
      console.log('\n📊 signal_type별 개수:');
      typeCounts.forEach(t => {
        console.log(`  ${t._id}: ${t.count}개`);
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

