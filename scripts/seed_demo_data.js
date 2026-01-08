import mongoose from 'mongoose';
import dotenv from 'dotenv';
import { subDays, format } from 'date-fns';
import SpatialUnit from '../models/SpatialUnit.js';
import SignalHuman from '../models/SignalHuman.js';
import SignalGeo from '../models/SignalGeo.js';
import SignalPopulation from '../models/SignalPopulation.js';
import { connectDB } from '../config/database.js';

dotenv.config();

function createSimplePolygon(lngBase, latBase, size = 0.01) {
  return {
    type: 'Polygon',
    coordinates: [[
      [lngBase, latBase],
      [lngBase + size, latBase],
      [lngBase + size, latBase + size],
      [lngBase, latBase + size],
      [lngBase, latBase]
    ]]
  };
}

async function seedSpatialUnits(count = 50) {
  console.log(`Creating ${count} spatial units...`);

  const baseLng = 126.9780;
  const baseLat = 37.5665;

  const units = [];
  for (let i = 0; i < count; i++) {
    const unitId = `11110${500 + i}`.padEnd(8, '0');
    const lngOffset = (i % 10) * 0.02;
    const latOffset = Math.floor(i / 10) * 0.02;

    units.push({
      _id: unitId,
      name: `테스트동${i + 1}`,
      geom: createSimplePolygon(
        baseLng + lngOffset,
        baseLat + latOffset,
        0.01
      ),
      meta: {
        created_by: 'seed_script',
        demo: true
      }
    });
  }

  if (units.length > 0) {
    await SpatialUnit.insertMany(units);
    console.log(`✓ Created ${units.length} spatial units`);
  }

  return units.map(u => u._id);
}

async function seedSignalsHuman(unitIds, weeks = 8) {
  console.log(`Creating ${weeks * 7} days of human signals...`);

  const endDate = new Date();
  const startDate = subDays(endDate, weeks * 7);

  const signals = [];

  for (const unitId of unitIds) {
    let currentDate = new Date(startDate);
    const isHighRisk = Math.random() < 0.2; // 20%가 고위험

    while (currentDate <= endDate) {
      const dateStr = format(currentDate, 'yyyy-MM-dd');
      let baseTotal = Math.floor(Math.random() * 6);
      
      if (isHighRisk) {
        const daysPassed = Math.floor((currentDate - startDate) / (1000 * 60 * 60 * 24));
        baseTotal = Math.floor(baseTotal + daysPassed * 0.1);
      }

      const complaintTotal = Math.max(0, baseTotal + Math.floor(Math.random() * 3) - 1);
      const complaintOdor = complaintTotal > 0 ? Math.floor(Math.random() * complaintTotal) : 0;
      const complaintTrash = complaintTotal > complaintOdor ? Math.floor(Math.random() * (complaintTotal - complaintOdor)) : 0;
      const complaintIllegalDump = complaintTotal - complaintOdor - complaintTrash;

      const nightRatio = isHighRisk ? 0.3 + Math.random() * 0.5 : 0.2 + Math.random() * 0.3;
      const repeatRatio = isHighRisk ? 0.4 + Math.random() * 0.3 : 0.1 + Math.random() * 0.3;

      signals.push({
        unit_id: unitId,
        date: dateStr,
        complaint_total: complaintTotal,
        complaint_odor: complaintOdor > 0 ? complaintOdor : null,
        complaint_trash: complaintTrash > 0 ? complaintTrash : null,
        complaint_illegal_dump: complaintIllegalDump > 0 ? complaintIllegalDump : null,
        night_ratio: Math.round(nightRatio * 100) / 100,
        repeat_ratio: Math.round(repeatRatio * 100) / 100,
        source: 'demo_seed',
        raw: {}
      });

      currentDate = new Date(currentDate.getTime() + 24 * 60 * 60 * 1000);
    }
  }

  if (signals.length > 0) {
    const batchSize = 1000;
    for (let i = 0; i < signals.length; i += batchSize) {
      const batch = signals.slice(i, i + batchSize);
      try {
        await SignalHuman.insertMany(batch, { ordered: false });
      } catch (error) {
        // 중복은 무시
      }
    }
    console.log(`✓ Created ${signals.length} human signals`);
  }
}

async function seedSignalsGeo(unitIds) {
  console.log(`Creating geo signals for ${unitIds.length} units...`);

  const signals = [];

  for (const unitId of unitIds) {
    const isVulnerable = Math.random() < 0.2;

    signals.push({
      _id: unitId,
      alley_density: isVulnerable ? 30 + Math.random() * 50 : 10 + Math.random() * 40,
      backroad_ratio: isVulnerable ? 0.4 + Math.random() * 0.4 : 0.1 + Math.random() * 0.4,
      ventilation_proxy: isVulnerable ? 3 + Math.random() * 5 : 1 + Math.random() * 4,
      accessibility_proxy: isVulnerable ? 2 + Math.random() * 5 : 1 + Math.random() * 3,
      landuse_mix: 0.3 + Math.random() * 0.4,
      source: 'demo_seed',
      raw: {}
    });
  }

  if (signals.length > 0) {
    for (const signal of signals) {
      await SignalGeo.findByIdAndUpdate(signal._id, signal, { upsert: true, new: true });
    }
    console.log(`✓ Created ${signals.length} geo signals`);
  }
}

async function seedSignalsPopulation(unitIds, weeks = 8) {
  console.log(`Creating ${weeks * 7} days of population signals...`);

  const endDate = new Date();
  const startDate = subDays(endDate, weeks * 7);

  const signals = [];

  for (const unitId of unitIds) {
    let currentDate = new Date(startDate);
    const basePop = 5000 + Math.floor(Math.random() * 10000);

    while (currentDate <= endDate) {
      const dateStr = format(currentDate, 'yyyy-MM-dd');
      const isWeekend = currentDate.getDay() >= 5;
      const popTotal = basePop + Math.floor(Math.random() * 1500) - 500 + (isWeekend ? 500 : 0);
      const popNight = Math.floor(popTotal * (0.1 + Math.random() * 0.2));

      const daysPassed = Math.floor((currentDate - startDate) / (1000 * 60 * 60 * 24));
      const changeRate = daysPassed > 14
        ? -0.05 + Math.random() * 0.2
        : -0.02 + Math.random() * 0.07;

      signals.push({
        unit_id: unitId,
        date: dateStr,
        pop_total: popTotal,
        pop_night: popNight,
        pop_change_rate: Math.round(changeRate * 1000) / 1000,
        source: 'demo_seed',
        raw: {}
      });

      currentDate = new Date(currentDate.getTime() + 24 * 60 * 60 * 1000);
    }
  }

  if (signals.length > 0) {
    const batchSize = 1000;
    for (let i = 0; i < signals.length; i += batchSize) {
      const batch = signals.slice(i, i + batchSize);
      try {
        await SignalPopulation.insertMany(batch, { ordered: false });
      } catch (error) {
        // 중복은 무시
      }
    }
    console.log(`✓ Created ${signals.length} population signals`);
  }
}

async function main() {
  console.log('Starting demo data seed...\n');

  try {
    await connectDB();

    const unitIds = await seedSpatialUnits(50);
    await seedSignalsHuman(unitIds, 8);
    await seedSignalsGeo(unitIds);
    await seedSignalsPopulation(unitIds, 8);

    console.log('\n✓ Demo data seed completed!');
    console.log(`  - ${unitIds.length} spatial units`);
    console.log('  - 8 weeks of signals data');
    console.log('\nNext steps:');
    console.log('  1. Run UCI computation: POST /api/v1/comfort-index/compute');
    console.log('  2. Check priority queue: GET /api/v1/priority-queue?date=YYYY-MM-DD');
    console.log('  3. Generate action cards: POST /api/v1/action-cards/generate');

    process.exit(0);
  } catch (error) {
    console.error('Error:', error);
    process.exit(1);
  }
}

main();

