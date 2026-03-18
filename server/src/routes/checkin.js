const express = require('express');
const jwt = require('jsonwebtoken');
const config = require('../config');
const { processCheckin } = require('../services/checkinService');

const router = express.Router();

// Check-in endpoint - requires staff login
router.post('/', (req, res) => {
  const { token } = req.body;

  if (!token) {
    return res.status(400).json({ success: false, error: 'Token required' });
  }

  // Extract staff info from Authorization header (optional but recommended)
  let staffId = null;
  const authHeader = req.headers.authorization;
  if (authHeader && authHeader.startsWith('Bearer ')) {
    try {
      const decoded = jwt.verify(authHeader.slice(7), config.JWT_SECRET);
      if (decoded.role === 'staff') {
        staffId = decoded.id;
      }
    } catch {
      // Invalid token - continue without staff tracking
    }
  }

  const result = processCheckin(token, staffId);
  const status = result.success ? 200 : result.duplicate ? 409 : 400;
  res.status(status).json(result);
});

module.exports = router;
