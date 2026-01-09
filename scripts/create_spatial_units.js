import mongoose from 'mongoose';
import dotenv from 'dotenv';
import SignalHuman from '../models/SignalHuman.js';
import SpatialUnit from '../models/SpatialUnit.js';
import { connectDB } from '../config/database.js';

dotenv.config();

async function main() {
  try {
    console.log('🚀 Creating spatial units from imported data...\n');
    
    await connectDB();
    
    // signals_human에서 고유한 unit_id 추출
    const uniqueUnits = await SignalHuman.distinct('unit_id');
    console.log(`📊 Found ${uniqueUnits.length} unique unit_ids\n`);
    
    const baseLng = 126.9780;
    const baseLat = 37.5665;
    const units = [];
    
    uniqueUnits.forEach((unitId, i) => {
      const lngOffset = (i % 10) * 0.02;
      const latOffset = Math.floor(i / 10) * 0.02;
      
      units.push({
        _id: unitId,
        name: `지역${i + 1}`,
        geom: {
          type: 'Polygon',
          coordinates: [[
            [baseLng + lngOffset, baseLat + latOffset],
            [baseLng + lngOffset + 0.01, baseLat + latOffset],
            [baseLng + lngOffset + 0.01, baseLat + latOffset + 0.01],
            [baseLng + lngOffset, baseLat + latOffset + 0.01],
            [baseLng + lngOffset, baseLat + latOffset]
          ]]
        },
        meta: {
          created_by: 'import_script',
          imported: true
        }
      });
    });
    
    // 기존 데이터가 있어도 에러 없이 처리
    const result = await SpatialUnit.insertMany(units, { ordered: false })
      .catch(e => {
        if (e.code === 11000) {
          console.log('  ⚠️  Some units already exist, skipping duplicates...');
          return { insertedCount: units.length - e.writeErrors.length };
        }
        throw e;
      });
    
    console.log(`✅ Created ${units.length} spatial units\n`);
    
    await mongoose.connection.close();
    process.exit(0);
  } catch (error) {
    console.error('❌ Error:', error);
    await mongoose.connection.close();
    process.exit(1);
  }
}

main();

