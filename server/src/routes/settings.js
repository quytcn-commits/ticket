const express = require('express');
const nodemailer = require('nodemailer');
const db = require('../db/connection');
const auth = require('../middleware/auth');

const router = express.Router();

const SMTP_KEYS = ['smtp_host', 'smtp_port', 'smtp_user', 'smtp_pass', 'smtp_from_name'];

const PRESETS = {
  gmail: { smtp_host: 'smtp.gmail.com', smtp_port: '587' },
  outlook: { smtp_host: 'smtp-mail.outlook.com', smtp_port: '587' },
  yahoo: { smtp_host: 'smtp.mail.yahoo.com', smtp_port: '587' },
  custom: {},
};

// Get SMTP settings
router.get('/smtp', auth, (req, res) => {
  const settings = {};
  for (const key of SMTP_KEYS) {
    const row = db.prepare('SELECT value FROM settings WHERE key = ?').get(key);
    // Mask password
    if (key === 'smtp_pass' && row?.value) {
      settings[key] = '••••••••';
    } else {
      settings[key] = row?.value || '';
    }
  }
  // Check if configured
  settings.configured = !!(settings.smtp_host && settings.smtp_user);
  res.json(settings);
});

// Save SMTP settings
router.post('/smtp', auth, (req, res) => {
  const { preset, smtp_host, smtp_port, smtp_user, smtp_pass, smtp_from_name } = req.body;

  // Apply preset defaults
  const presetValues = PRESETS[preset] || {};
  const values = {
    smtp_host: smtp_host || presetValues.smtp_host || '',
    smtp_port: smtp_port || presetValues.smtp_port || '587',
    smtp_user: smtp_user || '',
    smtp_pass: smtp_pass || '',
    smtp_from_name: smtp_from_name || 'Event Check-in',
  };

  // Don't overwrite password if masked value sent
  if (values.smtp_pass === '••••••••') {
    delete values.smtp_pass;
  }

  const upsert = db.prepare('INSERT INTO settings (key, value) VALUES (?, ?) ON CONFLICT(key) DO UPDATE SET value = ?');
  const transaction = db.transaction(() => {
    for (const [key, value] of Object.entries(values)) {
      upsert.run(key, value, value);
    }
  });
  transaction();

  res.json({ success: true, message: 'Đã lưu cấu hình SMTP' });
});

// Test SMTP connection
router.post('/smtp/test', auth, async (req, res) => {
  const { test_email } = req.body;

  if (!test_email) {
    return res.status(400).json({ error: 'Vui lòng nhập email nhận thử' });
  }

  // Read current settings from DB
  const getVal = (key) => {
    const row = db.prepare('SELECT value FROM settings WHERE key = ?').get(key);
    return row?.value || '';
  };

  const host = getVal('smtp_host');
  const port = parseInt(getVal('smtp_port')) || 587;
  const user = getVal('smtp_user');
  const pass = getVal('smtp_pass');
  const fromName = getVal('smtp_from_name') || 'Event Check-in';

  if (!host || !user || !pass) {
    return res.status(400).json({ error: 'Vui lòng cấu hình SMTP trước khi test' });
  }

  try {
    const transport = nodemailer.createTransport({
      host,
      port,
      secure: port === 465,
      auth: { user, pass },
      connectionTimeout: 10000,
    });

    // Verify connection
    await transport.verify();

    // Send test email
    await transport.sendMail({
      from: `"${fromName}" <${user}>`,
      to: test_email,
      subject: 'Test email từ QR Check-in System',
      html: `
        <div style="font-family: Arial, sans-serif; max-width: 400px; margin: 0 auto; padding: 20px;">
          <h2 style="color: #2563eb;">Cấu hình email thành công!</h2>
          <p>Đây là email test từ hệ thống QR Check-in.</p>
          <p>Nếu bạn nhận được email này, cấu hình SMTP đã hoạt động.</p>
          <hr />
          <p style="color: #888; font-size: 12px;">SMTP: ${host}:${port} | User: ${user}</p>
        </div>
      `,
    });

    res.json({ success: true, message: `Email test đã gửi đến ${test_email}` });
  } catch (err) {
    let hint = '';
    if (err.code === 'EAUTH') {
      hint = ' (Sai mật khẩu hoặc chưa bật App Password)';
    } else if (err.code === 'ESOCKET' || err.code === 'ECONNECTION') {
      hint = ' (Không kết nối được SMTP server)';
    }
    res.status(400).json({ error: `Lỗi: ${err.message}${hint}` });
  }
});

// Get presets
router.get('/smtp/presets', auth, (req, res) => {
  res.json(PRESETS);
});

// ===== Webhook Settings =====

// Get webhook secret
router.get('/webhook', auth, (req, res) => {
  const row = db.prepare("SELECT value FROM settings WHERE key = 'webhook_secret'").get();
  res.json({ webhook_secret: row?.value || '' });
});

// Save webhook secret
router.post('/webhook', auth, (req, res) => {
  const { webhook_secret } = req.body;
  if (!webhook_secret) {
    return res.status(400).json({ error: 'webhook_secret required' });
  }
  db.prepare("INSERT INTO settings (key, value) VALUES ('webhook_secret', ?) ON CONFLICT(key) DO UPDATE SET value = ?")
    .run(webhook_secret, webhook_secret);
  res.json({ success: true });
});

// ===== Email Template Settings =====
const { getTemplate, renderTemplate, DEFAULT_QR_TEMPLATE, DEFAULT_REMIND_TEMPLATE } = require('../services/emailService');

// Get email template for event
router.get('/email-template/:eventId/:type', auth, (req, res) => {
  const template = getTemplate(req.params.eventId, req.params.type);
  res.json(template);
});

// Save email template for event
router.post('/email-template/:eventId/:type', auth, (req, res) => {
  const { subject, body } = req.body;
  const key = `event_${req.params.eventId}_email_${req.params.type}`;
  const value = JSON.stringify({ subject, body });
  db.prepare('INSERT INTO settings (key, value) VALUES (?, ?) ON CONFLICT(key) DO UPDATE SET value = ?')
    .run(key, value, value);
  res.json({ success: true });
});

// Reset template to default
router.delete('/email-template/:eventId/:type', auth, (req, res) => {
  const key = `event_${req.params.eventId}_email_${req.params.type}`;
  db.prepare('DELETE FROM settings WHERE key = ?').run(key);
  res.json({ success: true });
});

// Preview template with sample data
router.post('/email-template/preview', auth, (req, res) => {
  const { subject, body } = req.body;
  const rendered = renderTemplate({ subject, body }, {
    studentName: 'Nguyễn Văn An',
    studentCode: 'SV2021001',
    email: 'an.nv@gmail.com',
    school: 'ĐH Sư phạm Kỹ thuật',
    eventName: 'Ngày hội Công nghệ 2026',
    eventDate: '2026-03-20',
    eventLocation: 'Hội trường A',
  });
  res.json(rendered);
});

module.exports = router;
