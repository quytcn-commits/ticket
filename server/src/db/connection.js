const Database = require('better-sqlite3');
const fs = require('fs');
const path = require('path');
const config = require('../config');

// Ensure data directory exists
const dataDir = path.dirname(config.DB_PATH);
if (!fs.existsSync(dataDir)) {
  fs.mkdirSync(dataDir, { recursive: true });
}

const db = new Database(config.DB_PATH);

// Performance optimizations
db.pragma('journal_mode = WAL');
db.pragma('foreign_keys = ON');

// Run schema
const schema = fs.readFileSync(path.join(__dirname, 'schema.sql'), 'utf-8');
db.exec(schema);

// Migrations: add columns if not exist
const migrations = [
  "ALTER TABLE students ADD COLUMN email_sent_at TEXT DEFAULT NULL",
  "ALTER TABLE students ADD COLUMN phone TEXT DEFAULT ''",
  "ALTER TABLE students ADD COLUMN category TEXT DEFAULT 'guest'",
  "ALTER TABLE students ADD COLUMN position TEXT DEFAULT ''",
  "ALTER TABLE students ADD COLUMN organization TEXT DEFAULT ''",
  "ALTER TABLE students ADD COLUMN mssv TEXT DEFAULT ''",
  "ALTER TABLE students ADD COLUMN program TEXT DEFAULT ''",
  "ALTER TABLE students ADD COLUMN image_consent INTEGER DEFAULT 0",
  "ALTER TABLE students ADD COLUMN relationship TEXT DEFAULT ''",
];
for (const sql of migrations) {
  try { db.exec(sql); } catch {}
}

// Seed default admin
const seed = require('./seed');
seed(db);

module.exports = db;
