import mongoose from 'mongoose';
import dotenv from 'dotenv';
import ComfortIndex from '../models/ComfortIndex.js';
import SpatialUnit from '../models/SpatialUnit.js';
import { connectDB } from '../config/database.js';

dotenv.config();

async function test() {
  try {
    await connectDB();
    
    const latest = await ComfortIndex.findOne().sort({ date: -1 });
    if (!latest) {
      console.log('데이터 없음');
      process.exit(0);
    }
    
    const targetDate = latest.date;
    const comfortIndices = await ComfortIndex.find({ date: targetDate })
      .sort({ uci_score: -1 })
      .limit(20);
    
    console.log('\n📊 테스트 결과:\n');
    console.log('  targetDate:', targetDate);
    console.log('  comfortIndices.length:', comfortIndices.length);
    
    const unitIds = comfortIndices.map(ci => ci.unit_id).filter(id => id);
    console.log('  unitIds.length:', unitIds.length);
    console.log('  unitIds 샘플:', unitIds.slice(0, 5));
    
    const units = await SpatialUnit.find({ _id: { $in: unitIds } });
    console.log('  units.length:', units.length);
    
    const unitsMap = {};
    units.forEach(u => { 
      unitsMap[u._id] = u.name; 
    });
    
    const items = comfortIndices
      .filter(ci => ci.unit_id)
      .map((ci, index) => ({
        rank: index + 1,
        unit_id: ci.unit_id,
        name: unitsMap[ci.unit_id] || ci.unit_id,
        uci_score: ci.uci_score,
        uci_grade: ci.uci_grade,
        why_summary: ci.explain?.why_summary || '',
        key_drivers: ci.explain?.key_drivers || []
      }));
    
    console.log('  items.length:', items.length);
    
    if (items.length > 0) {
      console.log('\n  첫 번째 항목:');
      console.log(JSON.stringify(items[0], null, 2));
    } else {
      console.log('\n  ⚠️ items가 비어있습니다!');
      console.log('  comfortIndices 샘플:');
      console.log(JSON.stringify(comfortIndices[0], null, 2));
    }
    
    await mongoose.connection.close();
    process.exit(0);
  } catch (error) {
    console.error('오류:', error);
    await mongoose.connection.close();
    process.exit(1);
  }
}

test();

