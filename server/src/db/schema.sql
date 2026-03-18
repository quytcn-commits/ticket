CREATE TABLE IF NOT EXISTS admins (
  id          INTEGER PRIMARY KEY AUTOINCREMENT,
  username    TEXT    NOT NULL UNIQUE,
  password    TEXT    NOT NULL,
  created_at  TEXT    DEFAULT (datetime('now', '+7 hours'))
);

CREATE TABLE IF NOT EXISTS events (
  id          INTEGER PRIMARY KEY AUTOINCREMENT,
  name        TEXT    NOT NULL,
  description TEXT,
  location    TEXT,
  event_date  TEXT    NOT NULL,
  created_at  TEXT    DEFAULT (datetime('now', '+7 hours'))
);

CREATE TABLE IF NOT EXISTS students (
  id            INTEGER PRIMARY KEY AUTOINCREMENT,
  event_id      INTEGER NOT NULL REFERENCES events(id) ON DELETE CASCADE,
  student_code  TEXT    NOT NULL,
  name          TEXT    NOT NULL,
  email         TEXT,
  school        TEXT,
  qr_token      TEXT    NOT NULL UNIQUE,
  email_sent_at TEXT    DEFAULT NULL,
  created_at    TEXT    DEFAULT (datetime('now', '+7 hours')),
  UNIQUE(event_id, student_code)
);

CREATE TABLE IF NOT EXISTS staffs (
  id          INTEGER PRIMARY KEY AUTOINCREMENT,
  username    TEXT    NOT NULL UNIQUE,
  name        TEXT    NOT NULL,
  pin         TEXT    NOT NULL,
  active      INTEGER DEFAULT 1,
  created_at  TEXT    DEFAULT (datetime('now', '+7 hours'))
);

CREATE TABLE IF NOT EXISTS staff_events (
  id          INTEGER PRIMARY KEY AUTOINCREMENT,
  staff_id    INTEGER NOT NULL REFERENCES staffs(id) ON DELETE CASCADE,
  event_id    INTEGER NOT NULL REFERENCES events(id) ON DELETE CASCADE,
  UNIQUE(staff_id, event_id)
);

CREATE TABLE IF NOT EXISTS settings (
  key         TEXT PRIMARY KEY,
  value       TEXT NOT NULL
);

CREATE TABLE IF NOT EXISTS checkins (
  id          INTEGER PRIMARY KEY AUTOINCREMENT,
  student_id  INTEGER NOT NULL REFERENCES students(id),
  event_id    INTEGER NOT NULL REFERENCES events(id),
  staff_id    INTEGER REFERENCES staffs(id),
  checked_at  TEXT    DEFAULT (datetime('now', '+7 hours')),
  UNIQUE(student_id, event_id)
);
