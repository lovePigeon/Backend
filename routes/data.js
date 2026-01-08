import express from 'express';
import multer from 'multer';
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';
import csv from 'csv-parser';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const router = express.Router();

// Multer 설정 - CSV 파일 업로드
const storage = multer.diskStorage({
  destination: (req, file, cb) => {
    const uploadType = req.body.type || 'raw'; // raw, processed, uploads
    const uploadDir = path.join(__dirname, '..', 'data', uploadType);
    
    // 디렉토리가 없으면 생성
    if (!fs.existsSync(uploadDir)) {
      fs.mkdirSync(uploadDir, { recursive: true });
    }
    
    cb(null, uploadDir);
  },
  filename: (req, file, cb) => {
    // 원본 파일명 유지하거나 타임스탬프 추가
    const timestamp = Date.now();
    const originalName = file.originalname.replace(/\s+/g, '_');
    cb(null, `${timestamp}_${originalName}`);
  }
});

const upload = multer({
  storage: storage,
  fileFilter: (req, file, cb) => {
    // CSV 파일만 허용
    if (file.mimetype === 'text/csv' || file.originalname.endsWith('.csv')) {
      cb(null, true);
    } else {
      cb(new Error('CSV 파일만 업로드 가능합니다.'), false);
    }
  },
  limits: {
    fileSize: 100 * 1024 * 1024 // 100MB 제한
  }
});

/**
 * @swagger
 * /api/v1/data/upload:
 *   post:
 *     summary: CSV 파일 업로드
 *     tags: [Data]
 *     consumes:
 *       - multipart/form-data
 *     parameters:
 *       - in: formData
 *         name: file
 *         type: file
 *         required: true
 *         description: CSV 파일
 *       - in: formData
 *         name: type
 *         type: string
 *         enum: [raw, processed, uploads]
 *         default: raw
 *     responses:
 *       200:
 *         description: 파일 업로드 성공
 *         content:
 *           application/json:
 *             examples:
 *               uploaded:
 *                 value:
 *                   success: true
 *                   message: "파일이 성공적으로 업로드되었습니다."
 *                   file:
 *                     filename: "1704700800000_signals_human_20260108.csv"
 *                     originalname: "signals_human_20260108.csv"
 *                     path: "data/raw/1704700800000_signals_human_20260108.csv"
 *                     size: 15234
 *                     type: "raw"
 */
router.post('/upload', upload.single('file'), (req, res) => {
  try {
    if (!req.file) {
      return res.status(400).json({
        success: false,
        message: '파일이 업로드되지 않았습니다.'
      });
    }

    res.json({
      success: true,
      message: '파일이 성공적으로 업로드되었습니다.',
      file: {
        filename: req.file.filename,
        originalname: req.file.originalname,
        path: req.file.path,
        size: req.file.size,
        type: req.body.type || 'raw'
      }
    });
  } catch (error) {
    res.status(500).json({
      success: false,
      message: '파일 업로드 중 오류가 발생했습니다.',
      error: error.message
    });
  }
});

/**
 * @swagger
 * /api/v1/data/files:
 *   get:
 *     summary: 업로드된 파일 목록 조회
 *     tags: [Data]
 *     parameters:
 *       - in: query
 *         name: type
 *         schema:
 *           type: string
 *           enum: [raw, processed, uploads]
 *           default: raw
 *     responses:
 *       200:
 *         description: 파일 목록
 *         content:
 *           application/json:
 *             examples:
 *               files:
 *                 value:
 *                   success: true
 *                   type: "raw"
 *                   count: 3
 *                   files:
 *                     - filename: "1704700800000_signals_human_20260108.csv"
 *                       size: 15234
 *                       created: "2026-01-08T00:00:00.000Z"
 *                       modified: "2026-01-08T00:00:00.000Z"
 *                     - filename: "1704700900000_signals_population_20260108.csv"
 *                       size: 23456
 *                       created: "2026-01-08T01:00:00.000Z"
 *                       modified: "2026-01-08T01:00:00.000Z"
 */
router.get('/files', (req, res) => {
  try {
    const { type = 'raw' } = req.query;
    const dirPath = path.join(__dirname, '..', 'data', type);

    if (!fs.existsSync(dirPath)) {
      return res.json({
        success: true,
        files: []
      });
    }

    const files = fs.readdirSync(dirPath)
      .filter(file => file.endsWith('.csv'))
      .map(file => {
        const filePath = path.join(dirPath, file);
        const stats = fs.statSync(filePath);
        return {
          filename: file,
          size: stats.size,
          created: stats.birthtime,
          modified: stats.mtime
        };
      })
      .sort((a, b) => b.modified - a.modified);

    res.json({
      success: true,
      type,
      count: files.length,
      files
    });
  } catch (error) {
    res.status(500).json({
      success: false,
      message: '파일 목록 조회 중 오류가 발생했습니다.',
      error: error.message
    });
  }
});

/**
 * @swagger
 * /api/v1/data/files/{filename}:
 *   get:
 *     summary: CSV 파일 읽기 (미리보기)
 *     tags: [Data]
 *     parameters:
 *       - in: path
 *         name: filename
 *         required: true
 *         schema:
 *           type: string
 *       - in: query
 *         name: type
 *         schema:
 *           type: string
 *           enum: [raw, processed, uploads]
 *           default: raw
 *       - in: query
 *         name: limit
 *         schema:
 *           type: integer
 *           default: 100
 *     responses:
 *       200:
 *         description: CSV 파일 미리보기
 *         content:
 *           application/json:
 *             examples:
 *               preview:
 *                 value:
 *                   success: true
 *                   filename: "signals_human_20260108.csv"
 *                   total_rows: 100
 *                   preview_rows: 100
 *                   data:
 *                     - unit_id: "11110515"
 *                       date: "2026-01-08"
 *                       complaint_total: "5"
 *                       complaint_odor: "2"
 *                       complaint_trash: "2"
 *                       night_ratio: "0.65"
 *                       repeat_ratio: "0.45"
 *       404:
 *         description: 파일을 찾을 수 없음
 */
router.get('/files/:filename', (req, res) => {
  try {
    const { filename } = req.params;
    const { type = 'raw', limit = 100 } = req.query;
    const filePath = path.join(__dirname, '..', 'data', type, filename);

    if (!fs.existsSync(filePath)) {
      return res.status(404).json({
        success: false,
        message: '파일을 찾을 수 없습니다.'
      });
    }

    const results = [];
    let rowCount = 0;

    fs.createReadStream(filePath)
      .pipe(csv())
      .on('data', (data) => {
        if (rowCount < parseInt(limit)) {
          results.push(data);
          rowCount++;
        }
      })
      .on('end', () => {
        res.json({
          success: true,
          filename,
          total_rows: rowCount,
          preview_rows: results.length,
          data: results
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
      message: '파일 조회 중 오류가 발생했습니다.',
      error: error.message
    });
  }
});

// CSV 파일 삭제
router.delete('/files/:filename', (req, res) => {
  try {
    const { filename } = req.params;
    const { type = 'raw' } = req.query;
    const filePath = path.join(__dirname, '..', 'data', type, filename);

    if (!fs.existsSync(filePath)) {
      return res.status(404).json({
        success: false,
        message: '파일을 찾을 수 없습니다.'
      });
    }

    fs.unlinkSync(filePath);

    res.json({
      success: true,
      message: '파일이 삭제되었습니다.'
    });
  } catch (error) {
    res.status(500).json({
      success: false,
      message: '파일 삭제 중 오류가 발생했습니다.',
      error: error.message
    });
  }
});

export default router;

