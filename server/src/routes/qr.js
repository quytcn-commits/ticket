const express = require('express');
const db = require('../db/connection');
const auth = require('../middleware/auth');
const { generateQRBuffer } = require('../services/qrService');
const { sendQREmail } = require('../services/emailService');

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

// Send QR email to one student
router.post('/email/:studentId', auth, async (req, res) => {
  const student = db.prepare(`
    SELECT s.*, e.name as event_name
    FROM students s JOIN events e ON e.id = s.event_id
    WHERE s.id = ?
  `).get(req.params.studentId);

  if (!student) return res.status(404).json({ error: 'Student not found' });
  if (!student.email) return res.status(400).json({ error: 'Student has no email' });

  const buffer = await generateQRBuffer(student.qr_token);
  await sendQREmail(student, student.event_name, buffer);
  res.json({ success: true, message: `Email sent to ${student.email}` });
});

// Send QR email to all students of an event
router.post('/event/:eventId/email-all', auth, async (req, res) => {
  const students = db.prepare(`
    SELECT s.*, e.name as event_name
    FROM students s JOIN events e ON e.id = s.event_id
    WHERE s.event_id = ? AND s.email != '' AND s.email IS NOT NULL
  `).all(req.params.eventId);

  let sent = 0;
  let failed = 0;
  const errors = [];

  for (const student of students) {
    try {
      const buffer = await generateQRBuffer(student.qr_token);
      await sendQREmail(student, student.event_name, buffer);
      sent++;
    } catch (err) {
      failed++;
      errors.push(`${student.student_code}: ${err.message}`);
    }
  }

  res.json({ sent, failed, total: students.length, errors });
});

module.exports = router;
