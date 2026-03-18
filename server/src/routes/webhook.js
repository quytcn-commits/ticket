const express = require('express');
const db = require('../db/connection');
const { generateToken, generateQRBuffer } = require('../services/qrService');
const { sendQREmail } = require('../services/emailService');

const router = express.Router();

/**
 * Webhook nhận dữ liệu từ Google Sheets (Apps Script)
 * Mỗi khi có SV mới điền Google Form → Apps Script gọi API này
 *
 * POST /api/webhook/register
 * Body: {
 *   secret: "webhook-secret-key",
 *   event_id: 1,
 *   student_code: "SV2021001",
 *   name: "Nguyễn Văn An",
 *   email: "an@gmail.com",
 *   school: "ĐH Sư phạm KT",
 *   phone: "0901234567"          // optional
 * }
 */
router.post('/register', async (req, res) => {
  const { secret, event_id, student_code, name, email, school, phone } = req.body;

  // 1. Verify webhook secret
  const webhookSecret = db.prepare("SELECT value FROM settings WHERE key = 'webhook_secret'").get();
  if (!webhookSecret || secret !== webhookSecret.value) {
    return res.status(401).json({ error: 'Invalid webhook secret' });
  }

  // 2. Validate
  if (!event_id || !student_code || !name || !email) {
    return res.status(400).json({ error: 'event_id, student_code, name, email là bắt buộc' });
  }

  // 3. Check event exists
  const event = db.prepare('SELECT * FROM events WHERE id = ?').get(event_id);
  if (!event) {
    return res.status(404).json({ error: 'Sự kiện không tồn tại' });
  }

  // 4. Check duplicate
  const existing = db.prepare(
    'SELECT id FROM students WHERE event_id = ? AND student_code = ?'
  ).get(event_id, student_code);

  if (existing) {
    return res.status(409).json({ error: 'Sinh viên đã đăng ký', student_code });
  }

  // 5. Create student + QR token
  const result = db.prepare(
    'INSERT INTO students (event_id, student_code, name, email, school, qr_token) VALUES (?, ?, ?, ?, ?, ?)'
  ).run(event_id, student_code, name, email, school || '', 'temp');

  const studentId = result.lastInsertRowid;
  const token = generateToken(event_id, studentId, student_code);
  db.prepare('UPDATE students SET qr_token = ? WHERE id = ?').run(token, studentId);

  // 6. Generate QR + Send email
  let emailSent = false;
  let emailError = null;
  try {
    const student = db.prepare('SELECT * FROM students WHERE id = ?').get(studentId);
    const qrBuffer = await generateQRBuffer(token);
    await sendQREmail(student, event.name, qrBuffer);
    emailSent = true;
  } catch (err) {
    emailError = err.message;
  }

  console.log(`[Webhook] New registration: ${name} (${student_code}) → email ${emailSent ? 'sent' : 'failed'}`);

  res.status(201).json({
    success: true,
    student_code,
    name,
    email,
    emailSent,
    emailError,
  });
});

module.exports = router;
