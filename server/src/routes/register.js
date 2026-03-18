const express = require('express');
const db = require('../db/connection');
const { generateToken, generateQRBuffer } = require('../services/qrService');
const { sendQREmail } = require('../services/emailService');

const router = express.Router();

// Get event info for registration page (public)
router.get('/:eventId', (req, res) => {
  const event = db.prepare(`
    SELECT id, name, description, location, event_date
    FROM events WHERE id = ?
  `).get(req.params.eventId);

  if (!event) return res.status(404).json({ error: 'Sự kiện không tồn tại' });

  // Check if registration is open
  const setting = db.prepare("SELECT value FROM settings WHERE key = ?")
    .get(`event_${event.id}_registration`);
  const registrationOpen = setting ? setting.value === '1' : false;

  if (!registrationOpen) {
    return res.status(403).json({ error: 'Đăng ký đã đóng cho sự kiện này' });
  }

  const studentCount = db.prepare(
    'SELECT COUNT(*) as count FROM students WHERE event_id = ?'
  ).get(event.id).count;

  res.json({ ...event, studentCount, registrationOpen });
});

// Register student (public - no auth)
router.post('/:eventId', async (req, res) => {
  const { student_code, name, email, school } = req.body;
  const eventId = req.params.eventId;

  // Validate required fields
  if (!student_code || !name || !email) {
    return res.status(400).json({ error: 'Mã SV, họ tên và email là bắt buộc' });
  }

  // Check event exists
  const event = db.prepare('SELECT * FROM events WHERE id = ?').get(eventId);
  if (!event) return res.status(404).json({ error: 'Sự kiện không tồn tại' });

  // Check registration is open
  const setting = db.prepare("SELECT value FROM settings WHERE key = ?")
    .get(`event_${eventId}_registration`);
  const registrationOpen = setting ? setting.value === '1' : false;

  if (!registrationOpen) {
    return res.status(403).json({ error: 'Đăng ký đã đóng cho sự kiện này' });
  }

  // Check duplicate
  const existing = db.prepare(
    'SELECT id FROM students WHERE event_id = ? AND student_code = ?'
  ).get(eventId, student_code);

  if (existing) {
    return res.status(409).json({ error: 'Mã SV này đã đăng ký sự kiện rồi' });
  }

  // Insert student
  const result = db.prepare(
    'INSERT INTO students (event_id, student_code, name, email, school, qr_token) VALUES (?, ?, ?, ?, ?, ?)'
  ).run(eventId, student_code, name, email, school || '', 'temp');

  const studentId = result.lastInsertRowid;
  const token = generateToken(eventId, studentId, student_code);
  db.prepare('UPDATE students SET qr_token = ? WHERE id = ?').run(token, studentId);

  // Send QR email automatically
  let emailSent = false;
  let emailError = null;
  try {
    const qrBuffer = await generateQRBuffer(token);
    const student = db.prepare('SELECT * FROM students WHERE id = ?').get(studentId);
    await sendQREmail(student, event.name, qrBuffer);
    emailSent = true;
  } catch (err) {
    emailError = err.message;
  }

  res.status(201).json({
    success: true,
    message: 'Đăng ký thành công!',
    student: { name, student_code, email, school },
    emailSent,
    emailError,
  });
});

module.exports = router;
