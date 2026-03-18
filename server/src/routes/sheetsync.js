const express = require('express');
const db = require('../db/connection');
const auth = require('../middleware/auth');
const { syncSheet, startAutoSync, stopAutoSync } = require('../services/sheetSyncService');

const router = express.Router();

// Get sync config for an event
router.get('/:eventId', auth, (req, res) => {
  const eventId = req.params.eventId;
  const sheetUrl = db.prepare("SELECT value FROM settings WHERE key = ?")
    .get(`event_${eventId}_sheet_url`);
  const interval = db.prepare("SELECT value FROM settings WHERE key = ?")
    .get(`event_${eventId}_sync_interval`);
  const autoSync = db.prepare("SELECT value FROM settings WHERE key = ?")
    .get(`event_${eventId}_auto_sync`);
  const lastSync = db.prepare("SELECT value FROM settings WHERE key = ?")
    .get(`event_${eventId}_last_sync`);

  const autoEmail = db.prepare("SELECT value FROM settings WHERE key = ?")
    .get(`event_${eventId}_auto_email`);

  res.json({
    sheet_url: sheetUrl?.value || '',
    sync_interval: parseInt(interval?.value) || 2,
    auto_sync: autoSync?.value === '1',
    auto_email: autoEmail ? autoEmail.value === '1' : true,
    last_sync: lastSync?.value || null,
  });
});

// Save sync config
router.post('/:eventId', auth, (req, res) => {
  const eventId = req.params.eventId;
  const { sheet_url, sync_interval, auto_sync, auto_email } = req.body;

  const upsert = db.prepare(
    'INSERT INTO settings (key, value) VALUES (?, ?) ON CONFLICT(key) DO UPDATE SET value = ?'
  );

  if (sheet_url !== undefined) {
    upsert.run(`event_${eventId}_sheet_url`, sheet_url, sheet_url);
  }
  if (sync_interval !== undefined) {
    upsert.run(`event_${eventId}_sync_interval`, String(sync_interval), String(sync_interval));
  }
  if (auto_sync !== undefined) {
    upsert.run(`event_${eventId}_auto_sync`, auto_sync ? '1' : '0', auto_sync ? '1' : '0');
    if (auto_sync) {
      startAutoSync(sync_interval || 2);
    }
  }
  if (auto_email !== undefined) {
    upsert.run(`event_${eventId}_auto_email`, auto_email ? '1' : '0', auto_email ? '1' : '0');
  }

  res.json({ success: true });
});

// Manual sync now
router.post('/:eventId/sync', auth, async (req, res) => {
  const eventId = parseInt(req.params.eventId);
  try {
    const result = await syncSheet(eventId);

    // Save last sync time
    const now = new Date().toLocaleString('vi-VN', { timeZone: 'Asia/Ho_Chi_Minh' });
    db.prepare(
      "INSERT INTO settings (key, value) VALUES (?, ?) ON CONFLICT(key) DO UPDATE SET value = ?"
    ).run(`event_${eventId}_last_sync`, now, now);

    res.json(result);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

module.exports = router;
