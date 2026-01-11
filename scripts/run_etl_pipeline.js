import { exec } from 'child_process';
import { promisify } from 'util';

const execAsync = promisify(exec);

/**
 * 전체 ETL 파이프라인 실행
 * 1. CSV → signals_human (signal_type별 분리)
 * 2. comfort_index 계산
 * 3. priority_queue 생성
 * 4. action_cards 생성 (자동)
 * 5. blind_spots 생성
 */
async function runPipeline() {
  console.log('🚀 Starting ETL Pipeline...\n');
  
  try {
    // 1. ETL Human Signals
    console.log('📥 Step 1: ETL Human Signals (CSV → signals_human)...');
    await execAsync('node scripts/etl_human_signals.js');
    console.log('✅ Step 1 completed\n');
    
    // 2. Compute Comfort Index
    console.log('📊 Step 2: Computing comfort_index...');
    await execAsync('node scripts/compute_comfort_index.js');
    console.log('✅ Step 2 completed\n');
    
    // 3. Generate Priority Queue
    console.log('🎯 Step 3: Generating priority_queue...');
    await execAsync('node scripts/generate_priority_queue.js');
    console.log('✅ Step 3 completed\n');
    
    // 4. Generate Blind Spots
    console.log('🔍 Step 4: Generating blind_spots...');
    await execAsync('node scripts/generate_blind_spots.js');
    console.log('✅ Step 4 completed\n');
    
    console.log('🎉 ETL Pipeline completed successfully!');
    console.log('\n📝 Note: action_cards are generated on-demand via API');
    
  } catch (error) {
    console.error('❌ Pipeline error:', error.message);
    process.exit(1);
  }
}

runPipeline();

