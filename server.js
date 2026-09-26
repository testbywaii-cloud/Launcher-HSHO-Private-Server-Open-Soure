'use strict';

require('module-alias/register');
require('dotenv').config();

const express = require('express');
const mongoose = require('mongoose');
const config = require('@config');
const routes = require('@routes');
const Health = require('@src/Health');

const app = express();

// Middleware สำหรับ parse request body (ขยาย limit เป็น 100mb ตามไฟล์ที่สอง)
app.use(express.json({ limit: '100mb' }));
app.use(express.urlencoded({ limit: '100mb', extended: true }));

// --- Custom Mock Log APIs ---

// 1. เช็คบทลงโทษ/โดนแบนชั่วคราวหรือไม่
app.post('/logapi/v1/check/penalty', (req, res) => {
  const gsid = req.body?.Player?.GSID || req.body?.GSID || req.body?.steamId || '';

  return res.status(200).json({
    data: {
      BanInSecond: 0,        // บังคับคืนค่า 0 คือไม่โดนแบนเวลา
      count: 243,
      GSID: gsid,
      PenaltyLevel: 0,       // ระดับโทษเป็น 0
      UnbannedDateTime: '2026-09-27T15:37:20.557Z',
      UnBannedIn: 0
    },
    hasUnBannedIn: 0,
    message: 'All transaction success',
    status: 1
  });
});

// 2. บันทึก Log ของแมตช์
app.post('/logapi/v1/add/matchlog', (_req, res) => {
  return res.status(200).json({
    data: null,
    error: null,
    status: 1
  });
});

// 3. เช็คการตรวจจับเซิร์ฟเวอร์ก่อนเริ่มหาห้อง
app.post('/logapi/v1/check/serverdetect', (req, res) => {
  const playerIds = req.body?.playerIds || [];
  const gsid = playerIds.length > 0 ? playerIds[0] : '';

  return res.status(200).json({
    data: {
      GSID: gsid
    },
    error: null,
    status: 1
  });
});

// --- Dynamic Routes & Health Checks ---
app.use('/', routes);
app.use('/', Health);

// --- 404 Handler ---
app.use((_req, res) => {
  res.status(404).json({
    status: 0,
    data: null,
    error: 'Not found'
  });
});

// --- Global Error Handler ---
app.use((err, _req, res, _next) => {
  console.error('[Error]', err);
  res.status(500).json({
    status: 0,
    data: null,
    error: 'Internal server error'
  });
});

function printBanner() {
  const text = 'A P I   B Y   M A L A K O R';
  const width = text.length + 6;
  const top = '+' + '-'.repeat(width) + '+';
  const empty = '|' + ' '.repeat(width) + '|';
  const pad = Math.floor((width - text.length) / 2);
  const line = '|' + ' '.repeat(pad) + text + ' '.repeat(width - pad - text.length) + '|';

  console.log('');
  console.log(top);
  console.log(empty);
  console.log(line);
  console.log(empty);
  console.log(top);
  console.log('');
}

let server;

async function start() {
  try {
    printBanner();

    await mongoose.connect(config.mongo.uri, {
      dbName: config.mongo.dbName
    });
    console.log(`[Database] MongoDB connected to: ${config.mongo.dbName}`);

    server = app.listen(config.port, () => {
      console.log(`[Server] Running on port ${config.port}`);
      if (config.env) {
        console.log(`[Environment] ${config.env}`);
      }
    });
  } catch (err) {
    console.error('[Startup Error]', err.message);
    process.exit(1);
  }
}

async function shutdown(signal) {
  console.log(`\n[Shutdown] Received ${signal}. Closing HTTP server and database connections...`); //All Code From Malakor And Waii
  try {
    if (server) {
      await new Promise((resolve) => server.close(resolve));
    }

    await mongoose.connection.close();
    console.log('[Shutdown] Completed successfully.');
    process.exit(0);
  } catch (err) {
    console.error('[Shutdown Error]', err.message);
    process.exit(1);
  }
}

// Graceful Shutdown & Unhandled Exception Handling
process.on('SIGINT', () => shutdown('SIGINT'));
process.on('SIGTERM', () => shutdown('SIGTERM'));

process.on('uncaughtException', (err) => {
  console.error('[Uncaught Exception]', err);
  shutdown('uncaughtException');
});

process.on('unhandledRejection', (reason) => {
  console.error('[Unhandled Rejection]', reason);
});

start();