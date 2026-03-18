const express = require('express');
const bcrypt = require('bcrypt');
const db = require('../db/connection');
const auth = require('../middleware/auth');

const router = express.Router();

// List all staffs
router.get('/', auth, (req, res) => {
  const staffs = db.prepare(`
    SELECT s.id, s.username, s.name, s.active, s.created_at,
      (SELECT GROUP_CONCAT(e.name, ', ')
       FROM staff_events se JOIN events e ON e.id = se.event_id
       WHERE se.staff_id = s.id) as assigned_events,
      (SELECT COUNT(*) FROM checkins WHERE staff_id = s.id) as total_checkins
    FROM staffs s ORDER BY s.name
  `).all();
  res.json(staffs);
});

// Create staff
router.post('/', auth, (req, res) => {
  const { username, name, pin } = req.body;
  if (!username || !name || !pin) {
    return res.status(400).json({ error: 'username, name, pin là bắt buộc' });
  }
  if (pin.length < 4 || pin.length > 6) {
    return res.status(400).json({ error: 'PIN phải từ 4-6 ký tự' });
  }

  const hashedPin = bcrypt.hashSync(pin, 10);
  try {
    const result = db.prepare(
      'INSERT INTO staffs (username, name, pin) VALUES (?, ?, ?)'
    ).run(username, name, hashedPin);
    const staff = db.prepare('SELECT id, username, name, active, created_at FROM staffs WHERE id = ?').get(result.lastInsertRowid);
    res.status(201).json(staff);
  } catch (err) {
    if (err.code === 'SQLITE_CONSTRAINT_UNIQUE') {
      return res.status(409).json({ error: 'Username đã tồn tại' });
    }
    throw err;
  }
});

// Update staff
router.put('/:id', auth, (req, res) => {
  const { name, pin, active } = req.body;
  const staff = db.prepare('SELECT * FROM staffs WHERE id = ?').get(req.params.id);
  if (!staff) return res.status(404).json({ error: 'Staff not found' });

  if (pin) {
    const hashedPin = bcrypt.hashSync(pin, 10);
    db.prepare('UPDATE staffs SET name = ?, pin = ?, active = ? WHERE id = ?')
      .run(name || staff.name, hashedPin, active ?? staff.active, req.params.id);
  } else {
    db.prepare('UPDATE staffs SET name = ?, active = ? WHERE id = ?')
      .run(name || staff.name, active ?? staff.active, req.params.id);
  }

  const updated = db.prepare('SELECT id, username, name, active FROM staffs WHERE id = ?').get(req.params.id);
  res.json(updated);
});

// Delete staff
router.delete('/:id', auth, (req, res) => {
  db.prepare('DELETE FROM staffs WHERE id = ?').run(req.params.id);
  res.json({ success: true });
});

// Assign staff to event
router.post('/:id/events', auth, (req, res) => {
  const { event_id } = req.body;
  if (!event_id) return res.status(400).json({ error: 'event_id required' });

  try {
    db.prepare('INSERT OR IGNORE INTO staff_events (staff_id, event_id) VALUES (?, ?)')
      .run(req.params.id, event_id);
  } catch {}

  const events = db.prepare(`
    SELECT e.id, e.name, e.event_date
    FROM staff_events se JOIN events e ON e.id = se.event_id
    WHERE se.staff_id = ?
  `).all(req.params.id);

  res.json(events);
});

// Remove staff from event
router.delete('/:id/events/:eventId', auth, (req, res) => {
  db.prepare('DELETE FROM staff_events WHERE staff_id = ? AND event_id = ?')
    .run(req.params.id, req.params.eventId);
  res.json({ success: true });
});

// Get staff's assigned events
router.get('/:id/events', auth, (req, res) => {
  const events = db.prepare(`
    SELECT e.id, e.name, e.event_date, e.location
    FROM staff_events se JOIN events e ON e.id = se.event_id
    WHERE se.staff_id = ?
  `).all(req.params.id);
  res.json(events);
});

module.exports = router;
