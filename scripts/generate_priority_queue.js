import mongoose from 'mongoose';
import dotenv from 'dotenv';
import ComfortIndex from '../models/ComfortIndex.js';
import SpatialUnit from '../models/SpatialUnit.js';
import { connectDB } from '../config/database.js';

dotenv.config();

/**
 * Priority Queue 생성 및 확인 스크립트
 * 
 * 최신 날짜의 comfort_index를 조회하여 Priority Queue를 생성하고 요약 정보를 출력합니다.
 */
async function main() {
  try {
    console.log('🚀 Starting Priority Queue generation...\n');
    
    await connectDB();
    
    // 최신 날짜 조회
    const latestComfortIndex = await ComfortIndex.findOne()
      .sort({ date: -1 });
    
    if (!latestComfortIndex) {
      console.log('⚠️  No comfort index data found.');
      console.log('   Please run: npm run compute-uci\n');
      await mongoose.connection.close();
      process.exit(0);
    }
    
    const targetDate = latestComfortIndex.date;
    console.log(`📅 Target date: ${targetDate}\n`);
    
    // Priority Queue 조회 (UCI 점수 높은 순)
    const comfortIndices = await ComfortIndex.find({ date: targetDate })
      .sort({ uci_score: -1 })
      .limit(20);
    
    if (comfortIndices.length === 0) {
      console.log(`⚠️  No comfort index found for date: ${targetDate}\n`);
      await mongoose.connection.close();
      process.exit(0);
    }
    
    // Spatial units 조회
    const unitIds = comfortIndices.map(ci => ci.unit_id);
    const units = await SpatialUnit.find({ _id: { $in: unitIds } });
    const unitsMap = {};
    units.forEach(u => { unitsMap[u._id] = u.name; });
    
    // Priority Queue 생성
    const priorityQueue = comfortIndices.map((ci, index) => ({
      rank: index + 1,
      unit_id: ci.unit_id,
      name: unitsMap[ci.unit_id] || ci.unit_id,
      uci_score: ci.uci_score,
      uci_grade: ci.uci_grade,
      why_summary: ci.explain?.why_summary || '',
      key_drivers: ci.explain?.key_drivers || []
    }));
    
    console.log(`✅ Priority Queue generated: ${priorityQueue.length} items\n`);
    console.log('📊 Top 10 Priority Items:\n');
    
    priorityQueue.slice(0, 10).forEach(item => {
      console.log(`  ${item.rank}. ${item.name} (${item.unit_id})`);
      console.log(`     UCI: ${item.uci_score.toFixed(1)} (${item.uci_grade})`);
      console.log(`     이유: ${item.why_summary || 'N/A'}`);
      if (item.key_drivers && item.key_drivers.length > 0) {
        const drivers = item.key_drivers.slice(0, 3).map(d => 
          `${d.signal}: ${typeof d.value === 'number' ? d.value.toFixed(2) : d.value}`
        ).join(', ');
        console.log(`     주요 신호: ${drivers}`);
      }
      console.log('');
    });
    
    // 통계
    const gradeCounts = {};
    priorityQueue.forEach(item => {
      gradeCounts[item.uci_grade] = (gradeCounts[item.uci_grade] || 0) + 1;
    });
    
    console.log('📈 Statistics:');
    console.log(`   Total items: ${priorityQueue.length}`);
    console.log(`   Average UCI: ${(priorityQueue.reduce((sum, item) => sum + item.uci_score, 0) / priorityQueue.length).toFixed(1)}`);
    console.log(`   Grade distribution:`);
    Object.entries(gradeCounts).sort().forEach(([grade, count]) => {
      console.log(`     ${grade}: ${count}개`);
    });
    
    console.log('\n✅ Priority Queue generation completed!\n');
    console.log('💡 Use API to query:');
    console.log(`   GET /api/v1/priority-queue?date=${targetDate}&top_n=20\n`);
    
    await mongoose.connection.close();
    process.exit(0);
  } catch (error) {
    console.error('❌ Error:', error);
    await mongoose.connection.close();
    process.exit(1);
  }
}

main();

