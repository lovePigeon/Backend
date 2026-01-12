/**
 * Grade Mismatch 수정 스크립트
 * 
 * UCI 점수와 등급이 일치하지 않는 레코드를 찾아서 수정합니다.
 * - 등급 경계값 처리: A(0-20), B(20-40), C(40-60), D(60-80), E(80-100)
 * - 점수 20은 B, 40은 C, 60은 D, 80은 E로 처리
 */

import dotenv from 'dotenv';
import mongoose from 'mongoose';
import { connectDB } from '../config/database.js';
import ComfortIndex from '../models/ComfortIndex.js';

dotenv.config();

/**
 * UCI 점수로 등급 계산 (일관된 로직)
 */
function getGradeFromScore(score) {
  if (score < 20) return 'A';
  if (score < 40) return 'B';
  if (score < 60) return 'C';
  if (score < 80) return 'D';
  return 'E';
}

/**
 * Grade mismatch 수정
 */
async function fixGradeMismatches() {
  try {
    await connectDB();
    console.log('✅ MongoDB connected\n');

    // 모든 ComfortIndex 조회
    const allIndices = await ComfortIndex.find({}).lean();
    console.log(`📊 Total ComfortIndex records: ${allIndices.length}\n`);

    const mismatches = [];
    let fixedCount = 0;

    for (const index of allIndices) {
      const expectedGrade = getGradeFromScore(index.uci_score);
      if (expectedGrade !== index.uci_grade) {
        mismatches.push({
          _id: index._id,
          unit_id: index.unit_id,
          date: index.date,
          uci_score: index.uci_score,
          old_grade: index.uci_grade,
          new_grade: expectedGrade
        });
      }
    }

    if (mismatches.length === 0) {
      console.log('✅ No grade mismatches found!');
      await mongoose.connection.close();
      process.exit(0);
    }

    console.log(`⚠️  Found ${mismatches.length} grade mismatches:\n`);
    mismatches.forEach((m, i) => {
      console.log(`  ${i + 1}. Unit: ${m.unit_id}, Date: ${m.date}`);
      console.log(`     Score: ${m.uci_score}, Old: ${m.old_grade} → New: ${m.new_grade}`);
    });

    console.log(`\n🔧 Fixing ${mismatches.length} records...\n`);

    // 일괄 수정
    for (const mismatch of mismatches) {
      await ComfortIndex.updateOne(
        { _id: mismatch._id },
        { $set: { uci_grade: mismatch.new_grade } }
      );
      fixedCount++;
      console.log(`  ✅ Fixed: ${mismatch.unit_id} (${mismatch.date}) - ${mismatch.old_grade} → ${mismatch.new_grade}`);
    }

    console.log(`\n✅ Successfully fixed ${fixedCount} grade mismatches!`);
    console.log(`\n📋 Summary:`);
    console.log(`   Total records: ${allIndices.length}`);
    console.log(`   Mismatches found: ${mismatches.length}`);
    console.log(`   Fixed: ${fixedCount}`);

    await mongoose.connection.close();
    process.exit(0);
  } catch (error) {
    console.error('❌ Error fixing grade mismatches:', error);
    process.exit(1);
  }
}

// 실행
fixGradeMismatches();

