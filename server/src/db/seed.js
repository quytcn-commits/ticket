const bcrypt = require('bcrypt');
const config = require('../config');

module.exports = function seed(db) {
  const admin = db.prepare('SELECT id FROM admins LIMIT 1').get();
  if (!admin) {
    const hash = bcrypt.hashSync(config.ADMIN_PASS, 10);
    db.prepare('INSERT INTO admins (username, password) VALUES (?, ?)').run(config.ADMIN_USER, hash);
    console.log(`Default admin created: ${config.ADMIN_USER}`);
  }
};
