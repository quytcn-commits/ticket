const express = require('express');
const db = require('../db/connection');
const auth = require('../middleware/auth');
const { generateReport } = require('../services/excelService');
const { checkinEmitter } = require('../services/checkinService');

const router = express.Router();

// Dashboard stats
router.get('/:eventId/stats', auth, (req, res) => {
  const eventId = req.params.eventId;
  res.json(getStats(eventId));
});

// Export Excel report
router.get('/:eventId/export', auth, (req, res) => {
  const eventId = req.params.eventId;
  const event = db.prepare('SELECT * FROM events WHERE id = ?').get(eventId);
  if (!event) return res.status(404).json({ error: 'Event not found' });

  const students = db.prepare(`
    SELECT s.student_code, s.name, s.email, s.school, c.checked_at
    FROM students s
    LEFT JOIN checkins c ON c.student_id = s.id AND c.event_id = s.event_id
    WHERE s.event_id = ?
    ORDER BY s.school, s.name
  `).all(eventId);

  const buffer = generateReport(students, event.name);
  res.set('Content-Disposition', `attachment; filename="report_${event.name}.xlsx"`);
  res.type('application/vnd.openxmlformats-officedocument.spreadsheetml.sheet');
  res.send(buffer);
});

// SSE realtime stats
router.get('/:eventId/stats/realtime', auth, (req, res) => {
  const eventId = req.params.eventId;

  res.set({
    'Content-Type': 'text/event-stream',
    'Cache-Control': 'no-cache',
    'Connection': 'keep-alive',
  });
  res.flushHeaders();

  // Send initial stats
  res.write(`data: ${JSON.stringify(getStats(eventId))}\n\n`);

  // Listen for check-in events
  const onCheckin = (data) => {
    if (String(data.eventId) === String(eventId)) {
      res.write(`data: ${JSON.stringify(getStats(eventId))}\n\n`);
    }
  };

  checkinEmitter.on('checkin', onCheckin);

  req.on('close', () => {
    checkinEmitter.off('checkin', onCheckin);
  });
});

function getStats(eventId) {
  const totalRegistered = db.prepare(
    'SELECT COUNT(*) as count FROM students WHERE event_id = ?'
  ).get(eventId).count;

  const checkedIn = db.prepare(
    'SELECT COUNT(*) as count FROM checkins WHERE event_id = ?'
  ).get(eventId).count;

  const bySchool = db.prepare(`
    SELECT s.school,
      COUNT(*) as registered,
      COUNT(c.id) as checked_in
    FROM students s
    LEFT JOIN checkins c ON c.student_id = s.id AND c.event_id = s.event_id
    WHERE s.event_id = ?
    GROUP BY s.school
    ORDER BY s.school
  `).all(eventId);

  const byHour = db.prepare(`
    SELECT strftime('%H:00', checked_at) as hour, COUNT(*) as count
    FROM checkins
    WHERE event_id = ?
    GROUP BY hour
    ORDER BY hour
  `).all(eventId);

  const byStaff = db.prepare(`
    SELECT COALESCE(st.name, 'Không rõ') as staff_name,
      COUNT(*) as count
    FROM checkins c
    LEFT JOIN staffs st ON st.id = c.staff_id
    WHERE c.event_id = ?
    GROUP BY c.staff_id
    ORDER BY count DESC
  `).all(eventId);

  return {
    totalRegistered,
    checkedIn,
    percentage: totalRegistered > 0 ? Math.round((checkedIn / totalRegistered) * 1000) / 10 : 0,
    bySchool,
    byHour,
    byStaff,
  };
}

module.exports = router;
