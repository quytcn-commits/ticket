const express = require('express');
const db = require('../db/connection');
const auth = require('../middleware/auth');
const { generateQRBuffer } = require('../services/qrService');
const { sendQREmail, markEmailSent } = require('../services/emailService');

const router = express.Router();

// Get QR image for a student
router.get('/:studentId/image', auth, async (req, res) => {
  const student = db.prepare('SELECT * FROM students WHERE id = ?').get(req.params.studentId);
  if (!student) return res.status(404).json({ error: 'Student not found' });
  const buffer = await generateQRBuffer(student.qr_token);
  res.type('image/png').send(buffer);
});

// Download QR image
router.get('/:studentId/download', auth, async (req, res) => {
  const student = db.prepare('SELECT * FROM students WHERE id = ?').get(req.params.studentId);
  if (!student) return res.status(404).json({ error: 'Student not found' });
  const buffer = await generateQRBuffer(student.qr_token);
  res.set('Content-Disposition', `attachment; filename="QR_${student.student_code}.png"`);
  res.type('image/png').send(buffer);
});

// Send QR email to one student (or resend/remind)
router.post('/email/:studentId', auth, async (req, res) => {
  const { remind } = req.body;
  const student = db.prepare(`
    SELECT s.*, e.name as event_name
    FROM students s JOIN events e ON e.id = s.event_id
    WHERE s.id = ?
  `).get(req.params.studentId);

  if (!student) return res.status(404).json({ error: 'Student not found' });
  if (!student.email) return res.status(400).json({ error: 'Student has no email' });

  const buffer = await generateQRBuffer(student.qr_token);
  await sendQREmail(student, student.event_name, buffer, !!remind);
  markEmailSent(student.id);
  res.json({ success: true, message: `Email sent to ${student.email}` });
});

// Send QR email to NEW students only (chưa gửi)
router.post('/event/:eventId/email-new', auth, async (req, res) => {
  const students = db.prepare(`
    SELECT s.*, e.name as event_name
    FROM students s JOIN events e ON e.id = s.event_id
    WHERE s.event_id = ? AND s.email != '' AND s.email IS NOT NULL
      AND s.email_sent_at IS NULL
  `).all(req.params.eventId);

  let sent = 0, failed = 0;
  const errors = [];

  for (const student of students) {
    try {
      const buffer = await generateQRBuffer(student.qr_token);
      await sendQREmail(student, student.event_name, buffer);
      markEmailSent(student.id);
      sent++;
    } catch (err) {
      failed++;
      errors.push(`${student.student_code}: ${err.message}`);
    }
  }

  res.json({ sent, failed, total: students.length, errors });
});

// Send REMIND email to all who already received
router.post('/event/:eventId/email-remind', auth, async (req, res) => {
  const students = db.prepare(`
    SELECT s.*, e.name as event_name
    FROM students s JOIN events e ON e.id = s.event_id
    WHERE s.event_id = ? AND s.email != '' AND s.email IS NOT NULL
      AND s.email_sent_at IS NOT NULL
  `).all(req.params.eventId);

  let sent = 0, failed = 0;
  const errors = [];

  for (const student of students) {
    try {
      const buffer = await generateQRBuffer(student.qr_token);
      await sendQREmail(student, student.event_name, buffer, true);
      markEmailSent(student.id);
      sent++;
    } catch (err) {
      failed++;
      errors.push(`${student.student_code}: ${err.message}`);
    }
  }

  res.json({ sent, failed, total: students.length, errors });
});

// Email stats for an event
router.get('/event/:eventId/email-stats', auth, (req, res) => {
  const eventId = req.params.eventId;

  const total = db.prepare(
    "SELECT COUNT(*) as c FROM students WHERE event_id = ? AND email != '' AND email IS NOT NULL"
  ).get(eventId).c;

  const sent = db.prepare(
    "SELECT COUNT(*) as c FROM students WHERE event_id = ? AND email_sent_at IS NOT NULL"
  ).get(eventId).c;

  const notSent = total - sent;

  const recentSent = db.prepare(`
    SELECT id, student_code, name, email, email_sent_at
    FROM students
    WHERE event_id = ? AND email_sent_at IS NOT NULL
    ORDER BY email_sent_at DESC
    LIMIT 50
  `).all(eventId);

  const notSentList = db.prepare(`
    SELECT id, student_code, name, email
    FROM students
    WHERE event_id = ? AND email != '' AND email IS NOT NULL AND email_sent_at IS NULL
    ORDER BY name
  `).all(eventId);

  res.json({ total, sent, notSent, recentSent, notSentList });
});

module.exports = router;
