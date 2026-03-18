const nodemailer = require('nodemailer');
const db = require('../db/connection');
const config = require('../config');

function getSmtpConfig() {
  const getVal = (key) => {
    const row = db.prepare('SELECT value FROM settings WHERE key = ?').get(key);
    return row?.value || '';
  };

  // Priority: DB settings > .env
  const host = getVal('smtp_host') || config.SMTP_HOST;
  const port = parseInt(getVal('smtp_port') || config.SMTP_PORT) || 587;
  const user = getVal('smtp_user') || config.SMTP_USER;
  const pass = getVal('smtp_pass') || config.SMTP_PASS;
  const fromName = getVal('smtp_from_name') || 'Event Check-in';

  return { host, port, user, pass, fromName };
}

function createTransporter() {
  const { host, port, user, pass } = getSmtpConfig();
  return nodemailer.createTransport({
    host,
    port,
    secure: port === 465,
    auth: { user, pass },
  });
}

async function sendQREmail(student, eventName, qrBuffer, isRemind = false) {
  const smtp = getSmtpConfig();

  if (!smtp.user || !smtp.pass) {
    throw new Error('Chưa cấu hình SMTP. Vào Cài đặt → Email để cấu hình.');
  }

  const transport = createTransporter();

  await transport.sendMail({
    from: `"${smtp.fromName}" <${smtp.user}>`,
    to: student.email,
    subject: `${isRemind ? '[Nhắc nhở] ' : ''}QR Check-in: ${eventName}`,
    html: `
      <div style="font-family: Arial, sans-serif; max-width: 500px; margin: 0 auto;">
        <h2>Xin chào ${student.name},</h2>
        <p>Bạn đã được đăng ký tham gia sự kiện <strong>${eventName}</strong>.</p>
        <p>Vui lòng mang theo mã QR bên dưới để check-in tại cổng sự kiện:</p>
        <div style="text-align: center; margin: 20px 0;">
          <img src="cid:qrcode" alt="QR Code" style="width: 300px; height: 300px;" />
        </div>
        <p><strong>Mã sinh viên:</strong> ${student.student_code}</p>
        <p><strong>Trường:</strong> ${student.school || 'N/A'}</p>
        <hr />
        <p style="color: #888; font-size: 12px;">Vui lòng không chia sẻ mã QR này cho người khác.</p>
      </div>
    `,
    attachments: [
      {
        filename: 'qrcode.png',
        content: qrBuffer,
        cid: 'qrcode',
      },
      {
        filename: `QR_${student.student_code}.png`,
        content: qrBuffer,
      },
    ],
  });
}

// Mark student as email sent
function markEmailSent(studentId) {
  db.prepare("UPDATE students SET email_sent_at = datetime('now', '+7 hours') WHERE id = ?").run(studentId);
}

module.exports = { sendQREmail, markEmailSent };
