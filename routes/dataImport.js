import express from 'express';
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';
import csv from 'csv-parser';
import SignalHuman from '../models/SignalHuman.js';
import SignalGeo from '../models/SignalGeo.js';
import SignalPopulation from '../models/SignalPopulation.js';
import SpatialUnit from '../models/SpatialUnit.js';
import { computeUCIForUnit } from '../services/uciCompute.js';
import ComfortIndex from '../models/ComfortIndex.js';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const router = express.Router();

/**
 * @swagger
 * /api/v1/data/import/{type}:
 *   post:
 *     summary: CSV 데이터 임포트 (MongoDB 저장)
 *     tags: [Data]
 *     parameters:
 *       - in: path
 *         name: type
 *         required: true
 *         schema:
 *           type: string
 *           enum: [human, geo, population, spatial_units]
 *         description: 데이터 타입
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             required:
 *               - filename
 *             properties:
 *               filename:
 *                 type: string
 *               type:
 *                 type: string
 *                 enum: [raw, processed, uploads]
 *                 default: raw
 *     responses:
 *       200:
 *         description: 데이터 임포트 완료
 *         content:
 *           application/json:
 *             examples:
 *               importResult:
 *                 value:
 *                   success: true
 *                   message: "CSV 파일이 성공적으로 임포트되었습니다."
 *                   total_rows: 100
 *                   success_count: 98
 *                   error_count: 2
 *                   results:
 *                     - row: 1
 *                       status: "success"
 *                     - row: 2
 *                       status: "error"
 *                       error: "Duplicate key error"
 */
router.post('/import/:type', async (req, res) => {
  try {
    const { type } = req.params; // human, geo, population, spatial_units
    const { filename, type: fileType = 'raw' } = req.body;

    if (!filename) {
      return res.status(400).json({
        success: false,
        message: 'filename이 필요합니다.'
      });
    }

    const filePath = path.join(__dirname, '..', 'data', fileType, filename);

    if (!fs.existsSync(filePath)) {
      return res.status(404).json({
        success: false,
        message: '파일을 찾을 수 없습니다.'
      });
    }

    const results = [];
    let rowCount = 0;
    let errorCount = 0;

    // CSV 파싱 및 저장
    const stream = fs.createReadStream(filePath)
      .pipe(csv())
      .on('data', async (row) => {
        try {
          rowCount++;
          
          switch (type) {
            case 'human':
              await importHumanSignal(row);
              break;
            case 'geo':
              await importGeoSignal(row);
              break;
            case 'population':
              await importPopulationSignal(row);
              break;
            case 'spatial_units':
              await importSpatialUnit(row);
              break;
            default:
              throw new Error(`알 수 없는 타입: ${type}`);
          }
          
          results.push({ row: rowCount, status: 'success' });
        } catch (error) {
          errorCount++;
          results.push({ row: rowCount, status: 'error', error: error.message });
        }
      })
      .on('end', () => {
        res.json({
          success: true,
          message: `CSV 파일이 성공적으로 임포트되었습니다.`,
          total_rows: rowCount,
          success_count: rowCount - errorCount,
          error_count: errorCount,
          results: results.slice(0, 10) // 처음 10개만 반환
        });
      })
      .on('error', (error) => {
        res.status(500).json({
          success: false,
          message: 'CSV 파일 읽기 중 오류가 발생했습니다.',
          error: error.message
        });
      });

  } catch (error) {
    res.status(500).json({
      success: false,
      message: '데이터 임포트 중 오류가 발생했습니다.',
      error: error.message
    });
  }
});

// Human Signal 임포트
async function importHumanSignal(row) {
  const data = {
    unit_id: row.unit_id || row.동코드 || row.location_id,
    date: row.date || row.날짜 || row.일자,
    complaint_total: parseInt(row.complaint_total || row.민원건수 || row.총민원 || 0),
    complaint_odor: row.complaint_odor ? parseInt(row.complaint_odor) : (row.악취민원 ? parseInt(row.악취민원) : null),
    complaint_trash: row.complaint_trash ? parseInt(row.complaint_trash) : (row.쓰레기민원 ? parseInt(row.쓰레기민원) : null),
    complaint_illegal_dump: row.complaint_illegal_dump ? parseInt(row.complaint_illegal_dump) : (row.무단투기 ? parseInt(row.무단투기) : null),
    night_ratio: row.night_ratio ? parseFloat(row.night_ratio) : (row.야간비율 ? parseFloat(row.야간비율) : null),
    repeat_ratio: row.repeat_ratio ? parseFloat(row.repeat_ratio) : (row.재발비율 ? parseFloat(row.재발비율) : null),
    source: 'csv_import',
    raw: row
  };

  await SignalHuman.findOneAndUpdate(
    { unit_id: data.unit_id, date: data.date },
    data,
    { upsert: true, new: true }
  );
}

// Geo Signal 임포트
async function importGeoSignal(row) {
  const data = {
    _id: row.unit_id || row.동코드 || row.location_id,
    alley_density: row.alley_density ? parseFloat(row.alley_density) : (row.골목밀도 ? parseFloat(row.골목밀도) : null),
    backroad_ratio: row.backroad_ratio ? parseFloat(row.backroad_ratio) : (row.후면도로비율 ? parseFloat(row.후면도로비율) : null),
    ventilation_proxy: row.ventilation_proxy ? parseFloat(row.ventilation_proxy) : (row.환기지수 ? parseFloat(row.환기지수) : null),
    accessibility_proxy: row.accessibility_proxy ? parseFloat(row.accessibility_proxy) : (row.접근성지수 ? parseFloat(row.접근성지수) : null),
    landuse_mix: row.landuse_mix ? parseFloat(row.landuse_mix) : (row.용도혼합도 ? parseFloat(row.용도혼합도) : null),
    source: 'csv_import',
    raw: row
  };

  await SignalGeo.findByIdAndUpdate(data._id, data, { upsert: true, new: true });
}

// Population Signal 임포트
async function importPopulationSignal(row) {
  const data = {
    unit_id: row.unit_id || row.동코드 || row.location_id,
    date: row.date || row.날짜 || row.일자,
    pop_total: row.pop_total ? parseInt(row.pop_total) : (row.총생활인구 ? parseInt(row.총생활인구) : null),
    pop_night: row.pop_night ? parseInt(row.pop_night) : (row.야간생활인구 ? parseInt(row.야간생활인구) : null),
    pop_change_rate: row.pop_change_rate ? parseFloat(row.pop_change_rate) : (row.변화율 ? parseFloat(row.변화율) : null),
    source: 'csv_import',
    raw: row
  };

  await SignalPopulation.findOneAndUpdate(
    { unit_id: data.unit_id, date: data.date },
    data,
    { upsert: true, new: true }
  );
}

// Spatial Unit 임포트
async function importSpatialUnit(row) {
  // GeoJSON 형식으로 변환 필요
  const geom = row.geom ? JSON.parse(row.geom) : {
    type: 'Polygon',
    coordinates: [[
      [parseFloat(row.경도 || row.lng || 0), parseFloat(row.위도 || row.lat || 0)],
      [parseFloat(row.경도 || row.lng || 0) + 0.01, parseFloat(row.위도 || row.lat || 0)],
      [parseFloat(row.경도 || row.lng || 0) + 0.01, parseFloat(row.위도 || row.lat || 0) + 0.01],
      [parseFloat(row.경도 || row.lng || 0), parseFloat(row.위도 || row.lat || 0) + 0.01],
      [parseFloat(row.경도 || row.lng || 0), parseFloat(row.위도 || row.lat || 0)]
    ]]
  };

  const data = {
    _id: row.unit_id || row.동코드 || row.location_id,
    name: row.name || row.동이름 || row.지역명,
    geom: geom,
    meta: {
      ...row,
      imported_at: new Date()
    }
  };

  await SpatialUnit.findByIdAndUpdate(data._id, data, { upsert: true, new: true });
}

export default router;

