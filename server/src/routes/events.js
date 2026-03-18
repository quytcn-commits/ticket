const express = require('express');
const db = require('../db/connection');
const auth = require('../middleware/auth');

const router = express.Router();

// List all events
router.get('/', auth, (req, res) => {
  const events = db.prepare(`
    SELECT e.*,
      (SELECT COUNT(*) FROM students WHERE event_id = e.id) as student_count,
      (SELECT COUNT(*) FROM checkins WHERE event_id = e.id) as checkin_count
    FROM events e
    ORDER BY e.event_date DESC
  `).all();
  res.json(events);
});

// Create event
router.post('/', auth, (req, res) => {
  const { name, description, location, event_date } = req.body;
  if (!name || !event_date) {
    return res.status(400).json({ error: 'Name and event_date required' });
  }
  const result = db.prepare(
    'INSERT INTO events (name, description, location, event_date) VALUES (?, ?, ?, ?)'
  ).run(name, description || '', location || '', event_date);

  const event = db.prepare('SELECT * FROM events WHERE id = ?').get(result.lastInsertRowid);
  res.status(201).json(event);
});

// Get event detail
router.get('/:id', auth, (req, res) => {
  const event = db.prepare(`
    SELECT e.*,
      (SELECT COUNT(*) FROM students WHERE event_id = e.id) as student_count,
      (SELECT COUNT(*) FROM checkins WHERE event_id = e.id) as checkin_count
    FROM events e WHERE e.id = ?
  `).get(req.params.id);

  if (!event) return res.status(404).json({ error: 'Event not found' });
  res.json(event);
});

// Update event
router.put('/:id', auth, (req, res) => {
  const { name, description, location, event_date } = req.body;
  db.prepare(
    'UPDATE events SET name = ?, description = ?, location = ?, event_date = ? WHERE id = ?'
  ).run(name, description, location, event_date, req.params.id);

  const event = db.prepare('SELECT * FROM events WHERE id = ?').get(req.params.id);
  res.json(event);
});

// Delete event
router.delete('/:id', auth, (req, res) => {
  db.prepare('DELETE FROM events WHERE id = ?').run(req.params.id);
  res.json({ success: true });
});

module.exports = router;
