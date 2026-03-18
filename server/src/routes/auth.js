const express = require('express');
const bcrypt = require('bcrypt');
const jwt = require('jsonwebtoken');
const db = require('../db/connection');
const config = require('../config');

const router = express.Router();

// Admin login
router.post('/login', (req, res) => {
  const { username, password } = req.body;

  if (!username || !password) {
    return res.status(400).json({ error: 'Username and password required' });
  }

  const admin = db.prepare('SELECT * FROM admins WHERE username = ?').get(username);
  if (!admin) {
    return res.status(401).json({ error: 'Sai tên đăng nhập hoặc mật khẩu' });
  }

  const valid = bcrypt.compareSync(password, admin.password);
  if (!valid) {
    return res.status(401).json({ error: 'Sai tên đăng nhập hoặc mật khẩu' });
  }

  const token = jwt.sign(
    { id: admin.id, username: admin.username, role: 'admin' },
    config.JWT_SECRET,
    { expiresIn: '24h' }
  );

  res.json({ token, username: admin.username, role: 'admin' });
});

// Staff login (username + PIN)
router.post('/staff/login', (req, res) => {
  const { username, pin } = req.body;

  if (!username || !pin) {
    return res.status(400).json({ error: 'Username và PIN là bắt buộc' });
  }

  const staff = db.prepare('SELECT * FROM staffs WHERE username = ? AND active = 1').get(username);
  if (!staff) {
    return res.status(401).json({ error: 'Sai tên đăng nhập hoặc PIN' });
  }

  const valid = bcrypt.compareSync(pin, staff.pin);
  if (!valid) {
    return res.status(401).json({ error: 'Sai tên đăng nhập hoặc PIN' });
  }

  // Get assigned events
  const events = db.prepare(`
    SELECT e.id, e.name, e.event_date
    FROM staff_events se JOIN events e ON e.id = se.event_id
    WHERE se.staff_id = ?
  `).all(staff.id);

  const token = jwt.sign(
    { id: staff.id, username: staff.username, name: staff.name, role: 'staff' },
    config.JWT_SECRET,
    { expiresIn: '12h' }
  );

  res.json({ token, name: staff.name, username: staff.username, role: 'staff', events });
});

module.exports = router;
