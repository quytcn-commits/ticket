const express = require('express');
const multer = require('multer');
const db = require('../db/connection');
const auth = require('../middleware/auth');
const { parseStudentExcel } = require('../services/excelService');
const { generateToken } = require('../services/qrService');

const router = express.Router();
const upload = multer({ storage: multer.memoryStorage() });

// List students for an event (with optional category filter)
router.get('/:eventId/students', auth, (req, res) => {
  const { category } = req.query;
  let sql = `
    SELECT s.*, c.checked_at
    FROM students s
    LEFT JOIN checkins c ON c.student_id = s.id AND c.event_id = s.event_id
    WHERE s.event_id = ?
  `;
  const params = [req.params.eventId];

  if (category && category !== 'all') {
    sql += ' AND s.category = ?';
    params.push(category);
  }
  sql += ' ORDER BY s.category, s.name ASC';

  const students = db.prepare(sql).all(...params);

  // Category stats
  const stats = db.prepare(`
    SELECT category, COUNT(*) as count
    FROM students WHERE event_id = ?
    GROUP BY category
  `).all(req.params.eventId);

  res.json({ students, categoryStats: stats });
});

// Add single student
router.post('/:eventId/students', auth, (req, res) => {
  const { student_code, name, email, school } = req.body;
  const eventId = req.params.eventId;

  if (!student_code || !name) {
    return res.status(400).json({ error: 'student_code and name required' });
  }

  const result = db.prepare(
    'INSERT INTO students (event_id, student_code, name, email, school, qr_token) VALUES (?, ?, ?, ?, ?, ?)'
  ).run(eventId, student_code, name, email || '', school || '', 'temp');

  const token = generateToken(eventId, result.lastInsertRowid, student_code);
  db.prepare('UPDATE students SET qr_token = ? WHERE id = ?').run(token, result.lastInsertRowid);

  const student = db.prepare('SELECT * FROM students WHERE id = ?').get(result.lastInsertRowid);
  res.status(201).json(student);
});

// Import from Excel
router.post('/:eventId/students/import', auth, upload.single('file'), (req, res) => {
  if (!req.file) {
    return res.status(400).json({ error: 'No file uploaded' });
  }

  const eventId = req.params.eventId;
  const { students, errors } = parseStudentExcel(req.file.buffer);

  let imported = 0;
  let skipped = 0;

  const insertStmt = db.prepare(
    'INSERT OR IGNORE INTO students (event_id, student_code, name, email, school, qr_token) VALUES (?, ?, ?, ?, ?, ?)'
  );
  const updateToken = db.prepare('UPDATE students SET qr_token = ? WHERE id = ?');

  const transaction = db.transaction(() => {
    for (const s of students) {
      const result = insertStmt.run(eventId, s.student_code, s.name, s.email, s.school, 'temp');
      if (result.changes > 0) {
        const token = generateToken(eventId, result.lastInsertRowid, s.student_code);
        updateToken.run(token, result.lastInsertRowid);
        imported++;
      } else {
        skipped++;
      }
    }
  });

  transaction();

  res.json({ imported, skipped, errors, total: students.length });
});

// Delete student
router.delete('/:eventId/students/:id', auth, (req, res) => {
  db.prepare('DELETE FROM students WHERE id = ? AND event_id = ?').run(req.params.id, req.params.eventId);
  res.json({ success: true });
});

module.exports = router;
