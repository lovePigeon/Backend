import mongoose from 'mongoose';
import dotenv from 'dotenv';

dotenv.config();

// MongoDB Atlas 또는 로컬 MongoDB 연결
const MONGODB_URI = process.env.MONGODB_URI || 
  (process.env.MONGODB_USER && process.env.MONGODB_PASSWORD
    ? `mongodb+srv://${process.env.MONGODB_USER}:${process.env.MONGODB_PASSWORD}@${process.env.MONGODB_CLUSTER}/${process.env.MONGODB_DATABASE || 'living_lab'}?retryWrites=true&w=majority`
    : 'mongodb://localhost:27017/living_lab');

export const connectDB = async () => {
  try {
    const options = {
      serverApi: {
        version: '1',
        strict: false, // text 인덱스 생성을 위해 false로 설정
        deprecationErrors: true,
      }
    };

    await mongoose.connect(MONGODB_URI, options);
    const maskedUri = MONGODB_URI.replace(/:[^:@]+@/, ':****@');
    console.log('✅ MongoDB Connected to:', maskedUri);

    // 인덱스 생성
    await createIndexes();
  } catch (error) {
    console.error('❌ MongoDB connection error:', error.message);
    process.exit(1);
  }
};

const createIndexes = async () => {
  const db = mongoose.connection.db;

  // spatial_units
  await db.collection('spatial_units').createIndex({ geom: '2dsphere' });
  // text 인덱스는 strict 모드에서 지원되지 않으므로 일반 인덱스로 대체
  try {
    await db.collection('spatial_units').createIndex({ name: 1 });
  } catch (error) {
    // 이미 존재하거나 오류가 발생해도 계속 진행
    console.log('Note: name index may already exist');
  }

  // signals_human
  await db.collection('signals_human').createIndex(
    { unit_id: 1, date: 1 },
    { unique: true }
  );

  // signals_population
  await db.collection('signals_population').createIndex(
    { unit_id: 1, date: 1 },
    { unique: true }
  );

  // pigeon_signals
  await db.collection('pigeon_signals').createIndex(
    { unit_id: 1, date: 1 },
    { unique: true }
  );

  // comfort_index
  await db.collection('comfort_index').createIndex(
    { unit_id: 1, date: 1 },
    { unique: true }
  );
  await db.collection('comfort_index').createIndex({ date: 1, uci_score: -1 });

  // interventions
  await db.collection('interventions').createIndex({ unit_id: 1, start_date: -1 });

  console.log('✅ MongoDB indexes created');
};

