/**
 * Script tạo dữ liệu mẫu: 1 sự kiện + 5 sinh viên + xuất ảnh QR
 * Chạy: node server/src/seed-demo.js
 */
const path = require('path');
const fs = require('fs');
require('dotenv').config({ path: path.join(__dirname, '../../.env') });

const db = require('./db/connection');
const { generateToken, generateQRBuffer } = require('./services/qrService');

const QR_OUTPUT_DIR = path.join(__dirname, '../../qr-demo');

const DEMO_STUDENTS = [
  { student_code: 'SV2021001', name: 'Nguyễn Văn An',    email: 'an.nv@ute.edu.vn',   school: 'ĐH Sư phạm Kỹ thuật' },
  { student_code: 'SV2021002', name: 'Trần Thị Bình',    email: 'binh.tt@hcmus.edu.vn', school: 'ĐH Khoa học Tự nhiên' },
  { student_code: 'SV2021003', name: 'Lê Hoàng Cường',   email: 'cuong.lh@hcmut.edu.vn', school: 'ĐH Bách khoa' },
  { student_code: 'SV2021004', name: 'Phạm Minh Dũng',   email: 'dung.pm@ueh.edu.vn',  school: 'ĐH Kinh tế' },
  { student_code: 'SV2021005', name: 'Võ Thị Hồng Nhung', email: 'nhung.vth@ute.edu.vn', school: 'ĐH Sư phạm Kỹ thuật' },
];

async function main() {
  // 1. Create demo event
  const event = db.prepare(
    "INSERT INTO events (name, description, location, event_date) VALUES (?, ?, ?, ?)"
  ).run('Ngày hội Công nghệ 2026', 'Sự kiện demo để test QR check-in', 'Hội trường A - Khu A', '2026-03-20');

  const eventId = event.lastInsertRowid;
  console.log(`✅ Tạo sự kiện: "Ngày hội Công nghệ 2026" (ID: ${eventId})`);

  // 2. Create output directory
  if (!fs.existsSync(QR_OUTPUT_DIR)) {
    fs.mkdirSync(QR_OUTPUT_DIR, { recursive: true });
  }

  // 3. Insert students + generate QR
  const insertStmt = db.prepare(
    'INSERT INTO students (event_id, student_code, name, email, school, qr_token) VALUES (?, ?, ?, ?, ?, ?)'
  );
  const updateToken = db.prepare('UPDATE students SET qr_token = ? WHERE id = ?');

  console.log('\n📋 Danh sách sinh viên mẫu:\n');
  console.log('┌──────┬─────────────┬──────────────────────┬──────────────────────────┐');
  console.log('│  #   │ Mã SV       │ Họ tên               │ Trường                   │');
  console.log('├──────┼─────────────┼──────────────────────┼──────────────────────────┤');

  for (let i = 0; i < DEMO_STUDENTS.length; i++) {
    const s = DEMO_STUDENTS[i];

    // Insert with temp token
    const result = insertStmt.run(eventId, s.student_code, s.name, s.email, s.school, 'temp');
    const studentId = result.lastInsertRowid;

    // Generate real token
    const token = generateToken(eventId, studentId, s.student_code);
    updateToken.run(token, studentId);

    // Generate QR image
    const qrBuffer = await generateQRBuffer(token);
    const qrPath = path.join(QR_OUTPUT_DIR, `QR_${s.student_code}.png`);
    fs.writeFileSync(qrPath, qrBuffer);

    const num = String(i + 1).padStart(4);
    const code = s.student_code.padEnd(11);
    const name = s.name.padEnd(20);
    const school = s.school.padEnd(24);
    console.log(`│ ${num} │ ${code} │ ${name} │ ${school} │`);
  }

  console.log('└──────┴─────────────┴──────────────────────┴──────────────────────────┘');
  console.log(`\n🖼️  Ảnh QR đã xuất tại: ${QR_OUTPUT_DIR}`);
  console.log(`   → ${DEMO_STUDENTS.length} file ảnh QR (mỗi file = 1 sinh viên)`);

  // List QR files
  const files = fs.readdirSync(QR_OUTPUT_DIR).filter(f => f.endsWith('.png'));
  files.forEach(f => console.log(`   📄 ${f}`));

  console.log('\n🚀 Hướng dẫn test:');
  console.log('   1. Chạy server:  npm run dev');
  console.log('   2. Đăng nhập:    http://localhost:5173/login (admin / admin123)');
  console.log(`   3. Mở Scanner:   http://localhost:5173/scan/${eventId}`);
  console.log('   4. Dùng ĐT quét ảnh QR trong thư mục qr-demo/');
  console.log('   5. Hoặc mở ảnh QR trên màn hình → chĩa camera ĐT vào quét');

  process.exit(0);
}

main().catch(err => {
  console.error('❌ Lỗi:', err.message);
  process.exit(1);
});
