const db = require('../db/connection');
const hmac = require('../utils/hmac');
const EventEmitter = require('events');

const checkinEmitter = new EventEmitter();

function processCheckin(token, staffId = null) {
  // 1. Verify HMAC
  const { valid, payload } = hmac.verify(token);
  if (!valid) {
    return { success: false, error: 'Mã QR không hợp lệ hoặc bị giả mạo' };
  }

  // 2. Parse payload: eventId:studentId:studentCode
  const parts = payload.split(':');
  if (parts.length !== 3) {
    return { success: false, error: 'Mã QR không đúng định dạng' };
  }

  const [eventId, studentId] = parts;

  // 3. Find student
  const student = db.prepare(`
    SELECT s.*, e.name as event_name
    FROM students s
    JOIN events e ON e.id = s.event_id
    WHERE s.id = ? AND s.event_id = ?
  `).get(studentId, eventId);

  if (!student) {
    return { success: false, error: 'Không tìm thấy sinh viên' };
  }

  // 3b. Verify staff is assigned to this event (if staffId provided)
  if (staffId) {
    const assigned = db.prepare(
      'SELECT id FROM staff_events WHERE staff_id = ? AND event_id = ?'
    ).get(staffId, student.event_id);
    if (!assigned) {
      return { success: false, error: 'Bạn không được phân công cho sự kiện này' };
    }
  }

  // 4. Check duplicate
  const existing = db.prepare(
    'SELECT id, checked_at FROM checkins WHERE student_id = ? AND event_id = ?'
  ).get(student.id, student.event_id);

  if (existing) {
    return {
      success: false,
      error: `Sinh viên đã check-in lúc ${existing.checked_at}`,
      student: {
        name: student.name,
        student_code: student.student_code,
        school: student.school,
        checked_at: existing.checked_at,
      },
      duplicate: true,
    };
  }

  // 5. Insert check-in (with staff_id if available)
  db.prepare(
    'INSERT INTO checkins (student_id, event_id, staff_id) VALUES (?, ?, ?)'
  ).run(student.id, student.event_id, staffId);

  const checkin = db.prepare(
    'SELECT checked_at FROM checkins WHERE student_id = ? AND event_id = ?'
  ).get(student.id, student.event_id);

  // 6. Emit event for realtime updates
  checkinEmitter.emit('checkin', { eventId: student.event_id });

  return {
    success: true,
    student: {
      name: student.name,
      student_code: student.student_code,
      school: student.school,
      event_name: student.event_name,
      checked_at: checkin.checked_at,
    },
  };
}

module.exports = { processCheckin, checkinEmitter };
