const jwt = require('jsonwebtoken');
const config = require('../config');

module.exports = function staffAuth(req, res, next) {
  const header = req.headers.authorization;
  if (!header || !header.startsWith('Bearer ')) {
    return res.status(401).json({ error: 'Vui lòng đăng nhập' });
  }
  try {
    const token = header.slice(7);
    const decoded = jwt.verify(token, config.JWT_SECRET);
    if (decoded.role !== 'staff') {
      return res.status(403).json({ error: 'Không có quyền truy cập' });
    }
    req.staff = decoded;
    next();
  } catch {
    return res.status(401).json({ error: 'Phiên đăng nhập hết hạn' });
  }
};
